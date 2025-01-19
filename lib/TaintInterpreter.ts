import { Environment } from "./Environment";
import { ExecutionContext } from "./ExecutionContext";
import { NotImplementedException } from "./NotImplementedException";
import { ReferenceException } from "./ReferenceException";
import * as t from '@babel/types';
import { Value, get_repr } from './../utils/to_value';
export class TaintInterpreter {
    callstack: Array<ExecutionContext>;
    ast: Array<t.Node>;
    return_stmt_flag: Boolean;

    constructor(execCtx: ExecutionContext) {
        this.callstack = [execCtx];
        this.ast = [];
        this.return_stmt_flag = false; // Tells append_ast to return stmt instead of adding to AST; used for manipulating BlockStatement
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
                    return t.variableDeclarator(t.identifier(id), Value(init.value)); // Gets added to AST by VariableDeclaration or alike
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
            let expressions: Array<TaintedLiteral> = [];
            node.expressions.forEach((expression) => {
                expressions.push(
                    this.eval(expression, ctx) as TaintedLiteral
                )
            });

            for (let expression of expressions) {
                if (expression == expressions[expressions.length - 1]) return expression; // Last element returns TaintedLiteral

                this.eval(t.expressionStatement(get_repr(expression)), ctx) // Convert to expression & re-evaluate
            }
        }

        if (t.isUnaryExpression(node)) {
            // If the operand is tainted, return taint
            let operand = this.eval(node.argument) as TaintedLiteral;

            if (operand.isTainted) return {
                node: t.unaryExpression(
                    node.operator,
                    get_repr(operand)
                ),
                isTainted: true
            } // Taintness is inherited

            let right = operand.value;
            let value;
            switch (node.operator) {
                case 'void':
                    value = void value;
                    break;
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
  
        if (t.isIfStatement(node)) {
            // If the condition is tainted, run both blocks isolated & taint any variables written from outer scope
            // If the condition is not tainted, remove the redundant block
            let test = this.eval(node.test) as TaintedLiteral;

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

                ctx.environment.assign(name, {
                    value: value,
                    isTainted: false
                });

                return {
                    node: t.assignmentExpression(
                        node.operator,
                        t.identifier(name),
                        Value(right)
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
                const result = self.eval(node.body, exec_ctx);

                // Remove ExecutionContext
                self.callstack.pop()

                // @ts-ignore - Ignore `this` error
                return new.target ? this : result; // When ran with new, return this
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
                    value: t.identifier(param),
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

            const result = func(args);

            // Add to AST
            const seq_expr = t.sequenceExpression([
                node,
                result
            ])
            return this.append_ast(seq_expr);

        }

        throw new NotImplementedException(node.type)
    }
}