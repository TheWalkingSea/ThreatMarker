import { Environment } from "./Environment";
import { ExecutionContext } from "./ExecutionContext";
import { NotImplementedException } from "./NotImplementedException";
import { ReferenceException } from "./ReferenceException";
import * as t from '@babel/types';
import { Value, get_repr } from './../utils/to_value';
import { exec } from "node:child_process";
export class TaintInterpreter {
    callstack: Array<ExecutionContext>;
    ast: Array<t.Node>;
    return_stmt_flag: Boolean;
    returnValue: TaintedLiteral;

    constructor(execCtx: ExecutionContext) {
        this.callstack = [execCtx];
        this.ast = [];
        this.return_stmt_flag = false; // Tells append_ast to return stmt instead of adding to AST; used for manipulating BlockStatement
        this.returnValue = {
            value: null, 
            isTainted: false
        }; // Used for Function Runners; saves the state of the return value
    }

    append_ast(stmt: t.Node): void | t.Node {
        if (this.return_stmt_flag) return stmt;

        this.ast.push(stmt);
    }

    /** 
     * Evaluates a node recursively
     * @param {t.Node} node - The node being executed
     * @param {ExecutionContext} ctx - The context in which the node is being executed in
     * @returns {TaintedLiteral | void} - Returns a TaintedLiteral most the time, void when at the bottom of the tree. t.Node is to prevent type errors but will never be type t.Node
     */
    eval(node: t.Node, ctx: ExecutionContext = this.callstack[this.callstack.length - 1]): t.Node | TaintedLiteral | void  {
        if (t.isProgram(node)) {
            node.body.forEach((node) => {
                this.eval(node, ctx);
            })

            return;
        }

        if (t.isExpressionStatement(node)) {
            let val = this.eval(node.expression, ctx) as TaintedLiteral;
            // if (val?.value) return; // Constant untainted variable => return
            let expression = t.expressionStatement(get_repr(val));

            return this.append_ast(expression);
        }

        if (t.isLiteral(node)) {
            // Literals are constant, and therefore not tainted

            if (t.isNullLiteral(node)) {
              return {
                value: null,
                isTainted: false
              };
            }
            if (t.isRegExpLiteral(node)) {
              return {
                value: new RegExp(node.pattern, node.flags),
                isTainted: false
                }
            }

            return {
                // @ts-ignore
                // Implemented most common literals
                value: node.value,
                isTainted: false
            };
        }

        if (t.isVariableDeclaration(node)) {
            // Loops through all declarations -> Reference VariableDeclarator
            let declarations: Array<t.VariableDeclarator> = [];
            node.declarations.forEach((declaration) => {
                declarations.push(
                    this.eval(declaration, ctx) as t.VariableDeclarator
                );
            })
            return this.append_ast(t.variableDeclaration(node.kind, declarations)); // Add declarations to ast
        }

        if (t.isVariableDeclarator(node)) {
            // If the right side is tainted, make this variable tainted - Implicitly tainted
            let id = (node.id as t.Identifier).name

            ctx.environment.declare(id);
            if (node.init) {
                let init = this.eval(node.init, ctx) as TaintedLiteral;
                if (init.isTainted) { // If tainted then just add expression to ast
                    ctx.environment.assign(id, {
                        node: init.node,
                        isTainted: true
                    });
                    return t.variableDeclarator(t.identifier(id), init.node); // Gets added to AST by VariableDeclaration or alike
                } else { // If constant add to env and assign identifier to const
                    ctx.environment.assign(id, {
                        value: init.value,
                        isTainted: false
                    });
                    return t.variableDeclarator(t.identifier(id), get_repr(init)); // Gets added to AST by VariableDeclaration or alike
                }
            }

            // Gets added to AST by VariableDeclaration or alike
            return t.variableDeclarator(t.identifier(id)); // No value, just return identifier
        }

        if (t.isIdentifier(node)) {
            // Return the identifier, if it is not defined then assume it is tainted
            try {
                let val: TaintedLiteral = ctx.environment.resolve(node.name);
                if (val?.node) {
                    val.node = t.identifier(node.name); // Replace the node with the identifier, instead of its representation
                }
                return val;
            } catch (e) {
                if (e instanceof ReferenceException) {
                    return {
                        node: t.identifier(node.name),
                        isTainted: true
                    } // Tainted ! - Defined in browser, not in NodeJS
                } else {
                    throw e
                }
            }
        }

        if (t.isBinaryExpression(node)) {
            // If left or right side of expression is tainted, make the entire expression tainted
            let left_id = this.eval(node.left, ctx) as TaintedLiteral;
            let right_id = this.eval(node.right, ctx) as TaintedLiteral;

            if (left_id.isTainted || right_id.isTainted) {
                if (!left_id?.node && !right_id?.node) throw new Error('left or right node in BinaryExpression is undefined despite being tainted');
                return {
                    node: t.binaryExpression(
                        node.operator, 
                        get_repr(left_id), 
                        get_repr(right_id)
                    ),
                    isTainted: true
                } // Taintness is inherited
            }

            let left = left_id.value;
            let right = right_id.value;

            let value;
            switch (node.operator) {
                case '+':
                    value = left + right;
                    break;
                case '-':
                    value = left - right;
                    break;
                case '*':
                    value = left * right;
                    break;
                case '/':
                    value = left / right;
                    break;
                case '%':
                    value = left % right;
                    break;
                case '**':
                    value = left ** right;
                    break;
                case '&':
                    value = left & right;
                    break;
                case '|':
                    value = left | right;
                    break;
                case '>>':
                    value = left >> right;
                    break;
                case '>>>':
                    value = left >>> right;
                    break;
                case '<<':
                    value = left << right;
                    break;
                case '^':
                    value = left ^ right;
                    break;
                case '==':
                    value = left == right;
                    break;
                case '===':
                    value = left === right;
                    break;
                case '!=':
                    value = left != right;
                    break;
                case '!==':
                    value = left !== right;
                    break;
                case '>':
                    value = left > right;
                    break;
                case '<':
                    value = left < right;
                    break;
                case '>=':
                    value = left >= right;
                    break;
                case '<=':
                    value = left <= right;
                    break;
                default:
                    throw new NotImplementedException(node.operator);
            }

            
            return {
                value: value,
                isTainted: false
            }
        }

        if (t.isEmptyStatement(node)) {
            return;
        }

        if (t.isSequenceExpression(node)) {
            // Just executes every expression, if the last expression is tainted, return taint - Implicitly tainted
            let expressions: Array<t.Expression> = [];
            let finalValue;
            node.expressions.forEach((expression, index) => {
                let value = this.eval(expression, ctx) as TaintedLiteral;
                expressions.push(
                    get_repr(value)
                )

                // Last element -> return
                if (index == (node.expressions.length - 1)) {
                    const seq_expr = t.sequenceExpression(expressions)
                    value.node = seq_expr;
                    finalValue = value;
                }
            });

            return finalValue;
        }

        if (t.isUnaryExpression(node)) {
            // If the operand is tainted, return taint
            const operand = this.eval(node.argument, ctx) as TaintedLiteral;

            if (operand.isTainted) return {
                node: t.unaryExpression(
                    node.operator,
                    get_repr(operand),
                    node.prefix
                ),
                isTainted: true
            } // Taintness is inherited

            let right = operand.value;
            let value;
            switch (node.operator) {
                case 'void':
                    value = void operand.value;
                    // void value returns undefined so it must be returned in a different way
                    return {
                        node: t.identifier('undefined'),
                        isTainted: false
                    }
                case 'throw':
                    throw right;
                    break;
                case '!':
                    value = !right;
                    break;
                case '+':
                    value = +right;
                    break;
                case '-':
                    value = -right;
                    break;
                case '~':
                    value = ~right;
                    break;
                case 'typeof':
                    value = typeof right;
                    break;
                default:
                    throw new NotImplementedException(node.operator)
            }

            return {
                value: value,
                isTainted: false
            }
        }

        // TODO
        // Simplify left hand argument
        if (t.isUpdateExpression(node)) {
            // If the operand is tainted, return taint
            let operand = this.eval(node.argument, ctx) as TaintedLiteral;

            if (operand.isTainted) return {
                node: t.updateExpression(
                    node.operator,
                    get_repr(operand),
                    node.prefix
                ),
                isTainted: true
            } // Taintness is inherited

            // Update Step
            let value;
            if (node.operator === "++") {
                value = operand.value + (node.prefix ? 1 : 0); // Add one if ++VAR
                operand.value += 1;
            } else if (node.operator === "--") {
                value = operand.value - (node.prefix ? 1 : 0); // Add one if --VAR
                operand.value -= 1;
            }

            const update_expr = t.updateExpression(
                node.operator,
                node.argument,
                node.prefix
            )

            return {
                node: update_expr,
                value: value,
                isTainted: false
            }
        }
  
        if (t.isIfStatement(node)) {
            // If the condition is tainted, run both blocks isolated & taint any variables written from outer scope
            // If the condition is not tainted, remove the redundant block
            let test = this.eval(node.test, ctx) as TaintedLiteral;

            if (test.isTainted) { // All subsequent nodes are tainted

                const simplify_conditional_block = (block: t.BlockStatement): t.BlockStatement | t.ExpressionStatement | null => {
                    
                    if (!block) return null;

                    let isolatedCtx = new ExecutionContext(
                        ctx.thisValue,
                        new Environment(new Map(), ctx.environment, true) // taint_parent_writes = true
                    )
                    
                    // Put if statement in it's own context
                    this.callstack.push(isolatedCtx);

                    // Execute the block
                    this.return_stmt_flag = true;
                    let simplified_block = this.eval(block, isolatedCtx) as t.BlockStatement | t.ExpressionStatement;
                    this.return_stmt_flag = false;

                    // Algorithm: Any variables defined in the inner block are tainted in outer scope
                    this.callstack.pop() // Remove isolatedEnv
                    isolatedCtx.environment.record.forEach((value: TaintedLiteral, key: string, _) => {
                        // Due to the assumption all definitions use var, all variables defined in the inner block will leak into the outer block
                        
                        ctx.environment.declare(key);
                        ctx.environment.assign(key, {
                            node: t.identifier(key),
                            isTainted: true
                        });
                    })

                    return simplified_block;
                }

                let consequent = simplify_conditional_block(node.consequent as t.BlockStatement) as t.BlockStatement;
                let alternate = simplify_conditional_block(node.alternate as t.BlockStatement); // Could be null

                return this.append_ast(
                    t.ifStatement(
                        get_repr(test), 
                        consequent, 
                        alternate
                    )
                )
            } else { // Execute normally
                let block = test.value ? node.consequent : node.alternate;
                if (block) {
                    this.eval(block, ctx) as t.BlockStatement | t.ExpressionStatement;
                }
                return;
            }
        }

        if (t.isBlockStatement(node)) {
            let return_block_flag = this.return_stmt_flag; // Temp store the return_stmt_flag
            this.return_stmt_flag = true;
            let block: Array<t.Statement> = [];
            for (let i=0;i<node.body.length;i++) {
                let stmt = node.body[i];
                
                let result = this.eval(stmt, ctx);
                if (result) block.push(result as t.Statement);


                if (this.callstack[this.callstack.length - 1] !== ctx) { // Used for functions
                    break; // No longer in context - Break out of block
                }
            }
            this.return_stmt_flag = return_block_flag; // Restore state saved from earlier
            return this.append_ast(t.blockStatement(block));
        }

        if (t.isAssignmentExpression(node)) {
            // If any operands are tainted, the assignment is also tainted
            let right_id = this.eval(node.right, ctx) as TaintedLiteral;

            if (t.isIdentifier(node.left)) {
                let name = node.left.name;

                if (right_id.isTainted) { // If right is tainted, taint assignment
                    ctx.environment.assign(name, {
                        isTainted: true
                    }) // Taint is passed down
                    return {
                        node: t.assignmentExpression(
                            node.operator,
                            t.identifier(name),
                            get_repr(right_id)
                        ),
                        isTainted: true
                    };
                }

                let right = right_id.value;
                let left_id = ctx.environment.resolve(name) as TaintedLiteral;

                // If left is tainted and not '=' operator (overrides taint), then the whole statement is tainted
                if (left_id.isTainted && node.operator !== '=') {
                    return {
                        node: t.assignmentExpression(
                            node.operator,
                            t.identifier(name),
                            get_repr(right_id)
                        ),
                        isTainted: true
                    };
                }

                let value;
                let left = left_id.value; // Extract value

                // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_operators
                switch (node.operator) {
                    case '=':
                        value = right;
                        break;
                    case '+=':
                        value = left + right;
                        break;
                    case '-=':
                        value = left - right;
                        break;
                    case '*=':
                        value = left * right;
                        break;
                    case '/=':
                        value = left / right;
                        break;
                    case '%=':
                        value = left % right;
                        break;
                    case '**=':
                        value = left ** right;
                        break;
                    case '<<=':
                        value = left << right;
                        break;
                    case '>>=':
                        value = left >> right;
                        break;
                    case '>>>=':
                        value = left >>> right;
                        break;;
                    case '&=':
                        value = left & right;
                        break;
                    case '^=':
                        value = left ^ right;
                        break;
                    case '|=':
                        value = left | right;
                        break;
                    default:
                        throw new NotImplementedException(node.operator)
                }
                
                console.log(name)
                console.log(value)
                ctx.environment.assign(name, {
                    value: value,
                    isTainted: false
                });

                right_id.value = right;

                return {
                    node: t.assignmentExpression(
                        node.operator,
                        t.identifier(name),
                        get_repr(right_id)
                    ),
                    isTainted: false
                } // Will be wrapped in another expression. ExpressionStatment, for example.
            }

            if (t.isMemberExpression(node.left)) {
                throw new NotImplementedException('MemberExpression')
            }

        }

        // Function support

        // TODO: 
        // Correct implementation of `this` object
        // arguments is a list of mixed Tainted and Untainted variables
        // toString method on functions
        // Support all argument types (...args)
        if (t.isFunctionDeclaration(node)) {
            if (node.generator || node.async) throw new NotImplementedException("Generator or Async FunctionDeclaration is not supported");
            if (t.isRestElement(node.params[0]) || t.isPattern(node.params[0])) throw new NotImplementedException("RestElement and Patterns not supported for FunctionDeclarations");
            if (node.id && !t.isIdentifier(node.id)) throw new NotImplementedException(`FunctionDeclaration ID is of type ${typeof node.id} which is not supported`)

            let name = node.id ? node.id.name : null; // Return FunctionDeclaration if name is null

            // Function implementation
            const params = (node.params as Array<t.Identifier>).map((param) => param.name); // For later: Convert to TaintLiteral?
            const self = this; // Save the state of `this` beforehand, any future uses of `this` will be referenced with `self`
            const parent_env = ctx.environment; // Runner will be set in a temporary environment
            
            // This function will encapsulate the functionality of the actual function, note that this is not the code that is being simplified, but simply used to be executed
            const runner = function() {

                // Define parameters
                const activation_record: Map<string, TaintedLiteral | IArguments> = new Map();
                for (let i=0;i<params.length;i++) {
                    activation_record.set(params[i], arguments[i]) // arguments should be of type TaintLiteral when executed
                }
                activation_record.set('arguments', {
                    value: arguments,
                    isTainted: true // Assume arguments are tainted
                });

                // Add new ExecutionContext
                const env = new Environment(activation_record, parent_env, false, true);
                // @ts-ignore - Ignore `this` error
                const exec_ctx = new ExecutionContext(this, env);
                self.callstack.push(exec_ctx);

                // Run block in isolation
                self.returnValue = {
                    value: null,
                    isTainted: false
                };

                self.return_stmt_flag = true; // Enable this so that code does not dupe
                self.eval(node.body, exec_ctx); // Executes block
                self.return_stmt_flag = false;

                // Remove ExecutionContext
                self.callstack.pop()

                // @ts-ignore - Ignore `this` error
                return new.target ? this : self.returnValue; // When ran with new, return this
            }
            if (name) {
                ctx.environment.declare(name);
                ctx.environment.assign(name, {
                    value: runner,
                    isTainted: false // technically function isn't tainted, but the value when executed may be
                })
            }

            // Build body: Must be simplified - Should be ran in isolation

            // Create parameters
            const record: Map<string, TaintedLiteral> = new Map();
            for (let param of params) {
                record.set(param, {
                    node: t.identifier(param),
                    isTainted: true // parameters are tainted
                })
            }
            record.set('arguments', {
                value: arguments,
                isTainted: true // parameters are tainted
            });

            // Ran in isolation => parent_env = null
            const env = new Environment(record, null, false, false, true);
            const exec_ctx = new ExecutionContext(self, env);
            self.callstack.push(exec_ctx);

            // Run block in isolation
            self.return_stmt_flag = true; // returns the block instead of result
            const body = self.eval(node.body, exec_ctx) as t.BlockStatement;
            self.return_stmt_flag = false;

            // Remove ExecutionContext
            self.callstack.pop()

            // Adding function to AST
            const func_decl = t.functionDeclaration(
                name ? t.identifier(name) : null,
                node.params,
                body
            )
            return name ? self.append_ast(func_decl) : func_decl
        }

        if (t.isCallExpression(node)) {
            if (!t.isIdentifier(node.callee)) throw new NotImplementedException(`Function names of type ${typeof node.callee} not supported`)
            
            const func: Function = ctx.environment.resolve(node.callee.name).value as Function; // Gets the runner function

            const args = node.arguments.forEach((n) => this.eval(n, ctx));

            const result: TaintedLiteral = func(args);

            // Add to AST
            if (!result.isTainted) { // Return value is not tainted
                const seq_expr = t.sequenceExpression([
                    node,
                    get_repr(result)
                ]);
                result.node = seq_expr;
                return result;
            }

            // Return value is tainted
            return {
                node: node,
                isTainted: true
            }

        }

        if (t.isReturnStatement(node)) {
            if (node.argument) this.returnValue = this.eval(node.argument, ctx) as TaintedLiteral;
            this.callstack.pop(); // Escape function

            // Add to AST
            const return_stmt = t.returnStatement(get_repr(this.returnValue));
            return this.append_ast(return_stmt);
        }


        // Error Support
        
        // TODO:
        // Catch destructuring patterns
        // if (t.isTryStatement(node)) {
        //     try { // Will also catch any errors with the deobfuscator, so proceed with caution
        //         this.eval(node.block);
        //     } catch (error) {
        //         // Since it is a BlockStatement, it can effect outer variables
        //         // Therefore, error must be added and removed manually
        //         const handler = node.handler as t.CatchClause;

        //         let original_error_param;
        //         // Set error parameter
        //         if (handler.param) { // Assume param is an identifier
        //             let param_name = (handler.param as t.Identifier).name;
        //             try {
        //                 // Try resolving for name
        //                 original_error_param = ctx.environment.resolve(param_name);
        //             } catch (error) {
        //                 if (!(error instanceof ReferenceException)) throw error;
        //                 ctx.environment.declare(param_name); // Declare error variable if not defined
        //             }
                    
        //             // Set error as tainted
        //             ctx.environment.assign(param_name, {
        //                 node: t.identifier(param_name),
        //                 isTainted: true
        //             })
        //         }

        //         // Evaluate block
        //         this.eval(handler.body);






        //     } finally {

        //     }
        // }

        // if (t.isThrowStatement(node)) {
        //     const arg = this.eval(node.argument, ctx) as TaintedLiteral;

        //     const throw_stmt = t.throwStatement(get_repr(arg));
        //     const ret = this.append_ast(throw_stmt);

        //     throw arg;
        //     return ret;
        // }

        // Loops

        if (t.isWhile(node)) {
            // Execute loop
            let test = this.eval(node.test, ctx) as TaintedLiteral;

            // Tracks any variables that have not changed
            // true means untainted, false means tainted => ignore !!
            let unchanged_state: Map<string, boolean> = new Map();
            
            ctx.environment.get_deep_copy().forEach((value: TaintedLiteral, key: string) => {
                if (!value.isTainted) unchanged_state.set(key, true); // Push untainted variables to unchanged_state
            })

            while (!test.isTainted && test.value) { // Quit if test is taint or test is False

                // Evaluate Block
                this.eval(node.body, ctx)

                // Check for any differing variables
                ctx.environment.get_deep_copy().forEach((value: TaintedLiteral, key: string) => {
                    if (value.isTainted || unchanged_state.get(key) !== value.value) { // Tainted or value changed
                        unchanged_state.set(key, false); // Tainted !
                    }
                })
            }

            // Add loop to AST

            // Get untainted records
            const record = new Map();
            unchanged_state.forEach((value: boolean, key: string) => {
                if (value) { // If untainted
                    record.set(key, ctx.environment.resolve(key)); // Retrieve from environment; Recall that the value has not changed
                }
            })

            // Create environment
            // Ran in isolation -> parent = null
            const env = new Environment(record, null, false, false, true);
            const exec_ctx = new ExecutionContext(this, env);

            this.callstack.push(exec_ctx);

            // Run block in isolation
            this.return_stmt_flag = true; // returns the block instead of result
            const body = this.eval(node.body, exec_ctx) as t.BlockStatement;
            this.return_stmt_flag = false;

            const test_stmt = this.eval(node.test, exec_ctx) as TaintedLiteral;

            // Remove ExecutionContext
            this.callstack.pop()

            const while_stmt = t.whileStatement(
                get_repr(test_stmt), 
                body
            )

            return this.append_ast(while_stmt)

        }



        throw new NotImplementedException(node.type)
    }
}