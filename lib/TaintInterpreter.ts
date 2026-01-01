import { Environment } from "./Environment";
import { ExecutionContext } from "./ExecutionContext";
import { NotImplementedException } from "./NotImplementedException";
import { DeobfuscatorException } from "./DeobfuscatorException";
import { ReferenceException } from "./ReferenceException";
import * as t from '@babel/types';
import { get_repr, Value } from './../utils/to_value';

export class TaintInterpreter {
    callstack: Array<ExecutionContext>;
    ast: Array<t.Node>;
    return_stmt_flag: Boolean;
    returnValue: TaintedLiteral;
    flags;

    constructor(execCtx: ExecutionContext) {
        this.callstack = [execCtx];
        this.ast = [];
        this.return_stmt_flag = false; // Tells append_ast to return stmt instead of adding to AST; used for manipulating BlockStatement
        this.returnValue = {
            value: null, 
            isTainted: false
        }; // Used for Function Runners; saves the state of the return value

        this.flags = {
            'IfStatement': {
                'taint_else_block': false,
            },
            'error_state': t.blockStatement([]) // Temporarily save program state here before throwing an error - Used for Try-Except blocks
        }
    }

    /** 
     * Appends block to AST.
     * @param {t.Node} stmt - The node being appended/returned
     * @returns {void | t.Node} - void if appended to AST; returns the node instead if return_stmt_flag is set
     */
    private append_ast(stmt: t.Node): void | t.Node {
        if (this.return_stmt_flag) return stmt;

        this.ast.push(stmt);
    }

    /** 
     * Executes the function in a wrapper that temporarily sets return_stmt_flag to true
     * As a result, this wrapper will execute the passed function into a context that will return the statement instead of appending to the AST
     * @template T - A function type of the passed function
     * @param {T} fn - The function being executed in the wrapper 
     * @param {...Parameters<T>} args - The arguments to pass into the wrapped function
     * @returns {ReturnType<T>} - Returns the result from the function
     */
    private get_stmt_wrapper<T extends (...args: any[]) => any>(fn: T, ...args: Parameters<T>): ReturnType<T> {
        const initial_return_stmt_flag = this.return_stmt_flag;
        this.return_stmt_flag = true;
        const result = fn.bind(this)(...args);
        this.return_stmt_flag = initial_return_stmt_flag;

        return result;
    }

    /** 
     * Evaluates a node that is NOT guarenteed to execute (ex: ConditionalStatement). 
     * External reads will flow and external writes will be automatically tainted.
     * Code block is executed in isolation. Taint will be propogated afterwards
     * @param {t.BlockStatement} block - The node being simplified
     * @param {ExecutionContext} ctx - The context in which the node is being executed in
     * @param {Object} param - Object representing metainfo for ExecutionContext
     * @param {string} param.type - The type of function being executed in the sandbox
     * @param {string} param.name - Metainformation used primarily for labelling; implemented for support purposes
     * @returns {t.BlockStatement | t.ExpressionStatement} - Returns the simplified ambiguous BlockStatement
     */
    private simplify_ambiguous_flow(block: t.BlockStatement, ctx: ExecutionContext, { type, name }: { type?: string, name?: string } = {}): t.BlockStatement | t.ExpressionStatement | null {
        
        if (!block) return null;

        let isolatedCtx = new ExecutionContext(
            ctx.thisValue,
            new Environment(new Map(), ctx.environment, true, false), // taint_parent_writes = true
            type,
            name
        )
        
        // Put if statement in it's own context
        this.callstack.push(isolatedCtx);

        // Execute the block
        let simplified_block = this.get_stmt_wrapper(
            this.eval, block, isolatedCtx
            ) as t.BlockStatement | t.ExpressionStatement;

        if (this.callstack[this.callstack.length - 1] === isolatedCtx) this.callstack.pop(); // Remove isolatedEnv

        // Any variables defined in the inner block are tainted in outer scope
        isolatedCtx.environment.getLocalRecord().forEach((value: TaintedLiteral, key: string, _) => {
            // Due to the assumption all definitions use var, all variables defined in the inner block will leak into the outer block
            
            ctx.environment.declare(key);
            ctx.environment.assign(key, {
                node: t.identifier(key),
                isTainted: true
            });
        })

        return simplified_block;
    }

    /**
     * Safely pops an execution context from the callstack
     * Only pops if the expected context is still on top (handles cases where ReturnStatement already popped it)
     * @param {ExecutionContext} expected_ctx - The context expected to be on top of the stack
     * @returns {boolean} - Returns true if the context was popped, false if it was already gone
     */
    private safe_pop_context(expected_ctx: ExecutionContext): boolean {
        if (this.callstack[this.callstack.length - 1] === expected_ctx) {
            this.callstack.pop();
            return true;
        }
        return false;
    }

    /**
     * @param {t.MemberExpression} member_node - The unevaluated MemberExpression
     * @param {TaintedLiteral} object - The evaluated object (OBJECT[property])
     * @param {TaintedLiteral} property - The evaluated property (object[PROPERTY])
     * @returns {t.MemberExpression} - Returns a formatted MemberExpression
     */
    private format_member_expression(member_node: t.MemberExpression, object: TaintedLiteral, property: TaintedLiteral): t.MemberExpression {
        const object_repr = object.node ? object.node : (member_node.object as t.Expression);

        if (!property.isTainted && t.isValidIdentifier(property.value)) {
                return t.memberExpression(
                    object_repr,
                    t.identifier(property.value),
                    false
                )
            } else {
                return t.memberExpression(
                    object_repr,
                    get_repr(property),
                    true
                )
            }
    }

    /** 
     * Evaluates a node recursively; main entry point of the TaintInterpreter
     * @param {t.Node} node - The node being executed
     * @param {ExecutionContext} ctx - The context in which the node is being executed in
     * @returns {TaintedLiteral | void} - Returns a TaintedLiteral most the time, void when at the bottom of the tree. t.Node is to prevent type errors but will never be type t.Node
     */
    public eval(node: t.Node, ctx: ExecutionContext): t.Node | TaintedLiteral | void  {
        
        /**
         * {
         *    body: Statement[],
         *    directives: Directive[],
         *    sourceType: "script" | "module",
         *    interpreter?: InterpreterDirective | null
         * }
         */
        if (t.isProgram(node)) {
            node.body.forEach((node) => {
                this.eval(node, ctx);
            })

            return;
        }

        /**
         * {
         *     expression: Expression
         * }
         * 
         * type Expression = ArrayExpression | AssignmentExpression | BinaryExpression | CallExpression | ConditionalExpression | 
         *  FunctionExpression | Identifier | StringLiteral | NumericLiteral | NullLiteral | BooleanLiteral | RegExpLiteral | 
         *  LogicalExpression | MemberExpression | NewExpression | ObjectExpression | SequenceExpression | ParenthesizedExpression | 
         *  ThisExpression | UnaryExpression | UpdateExpression | ArrowFunctionExpression | ClassExpression | ImportExpression | 
         *  MetaProperty | Super | TaggedTemplateExpression | TemplateLiteral | YieldExpression | AwaitExpression | Import | BigIntLiteral | 
         *  OptionalMemberExpression | OptionalCallExpression | TypeCastExpression | JSXElement | JSXFragment | BindExpression | 
         *  DoExpression | RecordExpression | TupleExpression | DecimalLiteral | ModuleExpression | TopicReference | PipelineTopicExpression | 
         *  PipelineBareFunction | PipelinePrimaryTopicReference | TSInstantiationExpression | TSAsExpression | TSSatisfiesExpression | 
         *  TSTypeAssertion | TSNonNullExpression;
         */
        if (t.isExpressionStatement(node)) {
            let val = this.eval(node.expression, ctx) as TaintedLiteral;
            // if (val?.value) return; // Constant untainted variable => return
            let expression = t.expressionStatement(get_repr(val));

            return this.append_ast(expression);
        }

        /**
         * {
         *     value: number,
         *     raw: string,
         *     regex ?: {
         *         pattern: string,
         *         flags: string
         *     }
         * }
         *
         * type Literal = StringLiteral | NumericLiteral | NullLiteral | BooleanLiteral | 
         *                RegExpLiteral | TemplateLiteral | BigIntLiteral | DecimalLiteral;
         * 
         * Note: DecimalLiteral not native JS; TemplateLiteral not implemented
        */
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
            if (t.isBigIntLiteral(node)) {
                return {
                    value: BigInt(node.value),
                    isTainted: false
                }
            }
            // if (t.isTemplateLiteral(node)) {
            //     let value = "";
            //     let isTainted = false;
            //     for (let i = 0; i < node.quasis.length; i++) {
            //         value += node.quasis[i].value.raw;
                    
            //         const expr_tl = this.eval(node.expressions[i], ctx) as TaintedLiteral;
            //         if (expr_tl.isTainted) {
            //             isTainted = true;
            //             value += "${" 
            //         }
            //         value += expr_tl;
            //     }
            //     return {
            //         value: value,
            //         isTainted: isTainted
            //     }
            // }

            return {
                // @ts-ignore
                // Implemented most common literals
                value: node.value,
                isTainted: false
            };
        }

        /**
         * {
         *     kind: "var" | "let" | "const" | "using" | "await using",
         *     declarations: Array<VariableDeclarator>,
         *     declare?: boolean | null
         * }
         */
        if (t.isVariableDeclaration(node)) {
            // Loops through all declarations -> Reference VariableDeclarator
            if (["let", "const", "using", "await using"].includes(node.type)) {
                throw new NotImplementedException(`Variable Declaration '${node.type}' has not been implemented yet`);
            }

            let declarations: Array<t.VariableDeclarator> = [];
            node.declarations.forEach((declaration) => {
                declarations.push(
                    this.eval(declaration, ctx) as t.VariableDeclarator
                );
            })
            return this.append_ast(t.variableDeclaration(node.kind, declarations)); // Add declarations to ast
        }

        /**
         * {
         *     id: LVal,
         *     init?: Expression | null,
         *     definite?: boolean | null
         * }
         * 
         * type LVal = ArrayPattern | AssignmentPattern | Identifier | MemberExpression | ObjectPattern | RestElement | TSAsExpression | 
         *  TSNonNullExpression | TSParameterProperty | TSSatisfiesExpression | TSTypeAssertion;
         *  - Note: Any types with the prefix `TS` is for the TypeScript language ONLY and should be ignored for web-based applications
         */
        if (t.isVariableDeclarator(node)) {
            if (["MemberExpression", "ArrayPattern", "ObjectPattern", "RestElement", "AssignmentPattern"].includes(node.type)) {
                throw new NotImplementedException(`Variable Declarator '${node.type}' has not been implemented.`);
            }

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

        /**
         * {
         *     name: string,
         *     decorators?: Array<Decorator> | null,
         *     optional?: boolean | null,
         *     typeAnnotation?: TypeAnnotation | TSTypeAnnotation | Noop | null
         * }
         * 
         * Note: optional, TypeAnnotation, TSTypeAnnotation, Noop, decorators not used in native JS
         */
        if (t.isIdentifier(node)) {
            // `undefined` is classified as an identifier
            if (node.name === 'undefined') return {
                value: undefined,
                isTainted: false
            };

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
                    throw new DeobfuscatorException((e as Error).message);
                }
            }
        }

        /**
         * {
         *     operator: "+" | "-" | "/" | "%" | "*" | "**" | "&" | "|" | ">>" | ">>>" | "<<" | "^" | "==" | "===" | "!=" | "!==" | "in" | "instanceof" | ">" | "<" | ">=" | "<=" | "|>",
         *     left: Expression | PrivateName,
         *     right: Expression
         * }
         * 
         * Note: `|>` is not a native JS operator
         */
        if (t.isBinaryExpression(node)) {
            // If left or right side of expression is tainted, make the entire expression tainted
            let left_id = this.eval(node.left, ctx) as TaintedLiteral;
            let right_id = this.eval(node.right, ctx) as TaintedLiteral;

            if (left_id.isTainted || right_id.isTainted) {
                if (!left_id?.node && !right_id?.node) throw new DeobfuscatorException('left or right node in BinaryExpression is undefined despite being tainted');
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
                case 'instanceof':
                    value = left instanceof right;
                    break;
                case 'in':
                    value = left in right;
                    break;
                default:
                    throw new NotImplementedException(node.operator);
            }
    
            return {
                value: value,
                isTainted: false
            }
        }

        /**
         * {
         *     operator: "||" | "&&" | "??",
         *     left: Expression,
         *     right: Expression
         * }
         */
        if (t.isLogicalExpression(node)) {
            // Evaluate left operand first
            let left_id = this.eval(node.left, ctx) as TaintedLiteral;

            // Short-circuit evaluation: If left is untainted and determines the result, don't evaluate right
            if (!left_id.isTainted) {
                let shouldShortCircuit = false;

                switch (node.operator) {
                    case '&&':
                        // If left is falsy, result is left (don't evaluate right)
                        shouldShortCircuit = !left_id.value;
                        break;
                    case '||':
                        // If left is truthy, result is left (don't evaluate right)
                        shouldShortCircuit = !!left_id.value;
                        break;
                    case '??':
                        // If left is not null/undefined, result is left (don't evaluate right)
                        shouldShortCircuit = left_id.value !== null && left_id.value !== undefined;
                        break;
                }

                if (shouldShortCircuit) {
                    // Return left value without evaluating right
                    return {
                        value: left_id.value,
                        isTainted: false
                    };
                }
            }

            // Now evaluate right operand (either left is tainted, or short-circuit doesn't apply)
            let right_id = this.eval(node.right, ctx) as TaintedLiteral;

            // Special case: If left is untainted and we know the result will be right (e.g., null ?? x, false && x, true || x didn't short-circuit means we continue)
            // For ??: if left is null/undefined (untainted), result is definitely right
            // For &&: if left is truthy (untainted), result is definitely right
            // For ||: if left is falsy (untainted), result is definitely right
            if (!left_id.isTainted) {
                let rightDeterminesResult = false;

                switch (node.operator) {
                    case '&&':
                        // Left is truthy, so result is right
                        rightDeterminesResult = !!left_id.value;
                        break;
                    case '||':
                        // Left is falsy, so result is right
                        rightDeterminesResult = !left_id.value;
                        break;
                    case '??':
                        // Left is null/undefined, so result is right
                        rightDeterminesResult = left_id.value === null || left_id.value === undefined;
                        break;
                }

                if (rightDeterminesResult) {
                    // Result is definitely the right value, return it directly
                    return right_id;
                }
            }

            // Now, this is for the general case in which we do not consider short-circuits
            if (left_id.isTainted || right_id.isTainted) {
                if (!left_id?.node && !right_id?.node) throw new DeobfuscatorException('left or right node in BinaryExpression is undefined despite being tainted');
                return {
                    node: t.logicalExpression(
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
                case '&&':
                    value = left && right;
                    break
                case '||':
                    value = left || right;
                    break
                case '??':
                    value = left ?? right;
                    break
                default:
                    throw new NotImplementedException((node as t.LogicalExpression).operator);
            }

            return {
                value: value,
                isTainted: false
            }
        }

        /**
         * {}
         */
        if (t.isEmptyStatement(node)) {
            return;
        }

        /**
         * {
         *     expressions: Expression[]
         * }
         */
        if (t.isSequenceExpression(node)) {
            // Just executes every expression, if the last expression is tainted, return taint - Implicitly tainted
            let expressions: Array<t.Expression> = [];
            let ret_value; // The final result
            node.expressions.forEach((expression, index) => {
                let expr_tl = this.eval(expression, ctx) as TaintedLiteral;
                expressions.push(
                    get_repr(expr_tl)
                )

                // Last element -> return
                if (index == (node.expressions.length - 1)) {
                    const seq_expr = t.sequenceExpression(expressions)
                    ret_value = {
                        value: expr_tl.value,
                        node: seq_expr,
                        isTainted: expr_tl.isTainted
                    };
                }
            });

            // We return here since return in a forEach does not return from main scope
            return ret_value;
        }

        /**
         * }
         *     operator: "void" | "throw" | "delete" | "!" | "+" | "-" | "~" | "typeof",
         *     argument: Expression,
         *     prefix: boolean
         * }
         * 
         * Note: 
         *  - `delete` not implemented
         *  - `void` ALWAYS returns 'undefined', even when tainted.
         *      However, it is not currently implemented (requires node/value superposition) since argument is an Expression
         */
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

        /**
         * }
         *     operator: "++" | "--",
         *     argument: Expression,
         *     prefix: boolean
         * }
         * 
         * Note: Only Identifier implemented
         */
        if (t.isUpdateExpression(node)) {
            if (t.isIdentifier(node.argument)) {
                let operand = node.argument.name;
                let operand_tl = ctx.environment.resolve(operand) as TaintedLiteral;

                if (operand_tl.isTainted) {
                    // Tainted operand -> Return tainted node
                    return {
                        node: t.updateExpression(
                            node.operator,
                            t.identifier(operand),
                            node.prefix
                        ),
                        isTainted: true
                    } // Taintness is inherited
                }

                // Update Step for untainted operands
                let return_value;
                let set_value;
                if (node.operator === "++") {
                    return_value = operand_tl.value + (node.prefix ? 1 : 0); // Add one if ++VAR
                    set_value = operand_tl.value + 1;
                } else if (node.operator === "--") {
                    return_value = operand_tl.value - (node.prefix ? 1 : 0); // Subtract one if --VAR
                    set_value = operand_tl.value - 1;
                }

                ctx.environment.assign(operand, {
                    value: set_value,
                    isTainted: false
                });

                const update_expr = t.updateExpression(
                    node.operator,
                    node.argument,
                    node.prefix
                )

                return {
                    node: update_expr,
                    value: return_value,
                    isTainted: false
                }
            } else if (t.isMemberExpression(node.argument)) {
                // Handle member expression updates like arr[0]++ or obj.prop++
                const member_node = node.argument as t.MemberExpression;

                // Only support identifier objects (e.g., arr[0], not (foo())[0])
                if (!t.isIdentifier(member_node.object)) {
                    throw new NotImplementedException(`UpdateExpression for MemberExpression only supports Identifier objects, got '${member_node.object.type}'`);
                }

                const object = this.eval(member_node.object, ctx) as TaintedLiteral;
                const property = member_node.computed
                    ? this.eval(member_node.property, ctx) as TaintedLiteral
                    : { value: (member_node.property as t.Identifier).name, isTainted: false };

                const formatted_member_expr = this.format_member_expression(member_node, object, property);

                // If object or property is tainted, return tainted node
                if (object.isTainted || property.isTainted) {
                    // If property is tainted, we can't determine which element to modify
                    // so taint the entire object variable
                    if (!object.isTainted && property.isTainted) {
                        ctx.environment.setTaint(member_node.object.name, true);
                    }

                    return {
                        node: t.updateExpression(
                            node.operator,
                            formatted_member_expr,
                            node.prefix
                        ),
                        isTainted: true
                    };
                }

                // Get current value
                const current_value_tl = (object.value)[property.value] as TaintedLiteral;

                // If current value is tainted, return tainted node
                if (current_value_tl && current_value_tl.isTainted) {
                    return {
                        node: t.updateExpression(
                            node.operator,
                            formatted_member_expr,
                            node.prefix
                        ),
                        isTainted: true
                    };
                }

                // Calculate updated value
                const current_value = current_value_tl ? current_value_tl.value : undefined;
                let return_value;
                let set_value;

                if (node.operator === "++") {
                    return_value = current_value + (node.prefix ? 1 : 0);
                    set_value = current_value + 1;
                } else if (node.operator === "--") {
                    return_value = current_value - (node.prefix ? 1 : 0);
                    set_value = current_value - 1;
                }

                // Use Environment's assignMemberProperty to handle taint_parent_writes
                ctx.environment.assignMemberProperty(
                    member_node.object.name,
                    property.value,
                    { value: set_value, isTainted: false },
                    formatted_member_expr
                );

                const update_expr = t.updateExpression(
                    node.operator,
                    formatted_member_expr,
                    node.prefix
                )

                return {
                    node: update_expr,
                    value: return_value,
                    isTainted: false
                }
            } else {
                throw new NotImplementedException(`UpdateExpression has not been implemented for argument type '${node.argument.type}'`);
            }
        }
        
        // if (t.isSwitchStatement(node)) {
        //     let expression = this.eval(node.discriminant, ctx);
        // }

        /**
         * {
         *     test: Expression,
         *     consequent: Expression,
         *     alternate: Expression
         * }
         */
        if (t.isConditionalExpression(node)) {
            // AKA Ternary Expression; very similar to IfStatement but a value is returned!
            let test = this.eval(node.test, ctx) as TaintedLiteral;

            // Tainted!
            if (test.isTainted) { // All subsequent nodes are tainted

                // Executor Function
                // Very similar to IfStatement, but returns a value!
                const execute_ternary = (expr: any): TaintedLiteral => {

                    let isolatedCtx = new ExecutionContext(
                        ctx.thisValue,
                        new Environment(new Map(), ctx.environment, true, false), // taint_parent_writes = true
                        'ConditionalExpression'
                    )
                    
                    // Put ternary statement in it's own context
                    this.callstack.push(isolatedCtx);

                    // Execute the block
                    let ret = this.get_stmt_wrapper(
                        this.eval, expr, isolatedCtx
                        ) as TaintedLiteral;

                    // Note: instanceof cannot be used since TaintedLiteral is an interface
                    if (ret && !('isTainted' in ret)) {
                        throw new DeobfuscatorException('TernaryExpression Evaluated to a value that is not type TaintLiteral');
                    }

                    this.safe_pop_context(isolatedCtx); // Remove isolatedEnv

                    // Any variables defined in the inner block are tainted in outer scope
                    isolatedCtx.environment.getLocalRecord().forEach((value: TaintedLiteral, key: string, _) => {
                        // Due to the assumption all definitions use var, all variables defined in the inner block will leak into the outer block
                        
                        ctx.environment.declare(key);
                        ctx.environment.assign(key, {
                            node: t.identifier(key),
                            isTainted: true
                        });
                    })

                    return ret;
                }

                // Building the AST with the Executor Function
                let consequent = execute_ternary(node.consequent) as TaintedLiteral;
                let alternate = execute_ternary(node.alternate) as TaintedLiteral;

                return {
                    node: t.conditionalExpression(
                        get_repr(test), 
                        get_repr(consequent), 
                        get_repr(alternate)
                    ),
                    isTainted: true
                }
            } else { // Not tainted; Execute normally
                let stmt = test.value ? node.consequent : node.alternate;
                // Should add executed statement to AST
                let exec_stmt = this.get_stmt_wrapper(
                    this.eval, stmt, ctx
                ) as TaintedLiteral;

                return exec_stmt
            }
        }

        /**
         * {
         *     test: Expression,
         *     consequent: Statement,
         *     alternate?: Statement | null
         * }
         */
        if (t.isIfStatement(node)) {
            // If the condition is tainted, run both blocks isolated & taint any variables written from outer scope
            // If the condition is not tainted, remove the redundant block
            let test = this.eval(node.test, ctx) as TaintedLiteral;

            if (test.isTainted) { // All subsequent nodes are tainted

                let consequent = this.simplify_ambiguous_flow(node.consequent as t.BlockStatement, ctx, { type: "IfStatement" }) as t.BlockStatement;
                let alternate;
                if (t.isIfStatement(node.alternate)) {
                    // All blocks contained in node.alternate must be executed in a tainted environment

                    let else_stmt = node.alternate as t.IfStatement;
                    const else_test = this.eval(else_stmt.test, ctx) as TaintedLiteral

                    if (else_test.isTainted) {
                        // Case 1: Nested taint
                        alternate = this.get_stmt_wrapper(this.eval, t.ifStatement(
                            get_repr(else_test), // Tainted! so this block will execute as tainted!
                            else_stmt.consequent,
                            else_stmt.alternate
                        ), ctx) as t.IfStatement;
                    } else {
                        // Case 2: Alternate block is untainted, but environment is still tainted
                        let alternate_block = else_test.value ? else_stmt.consequent : else_stmt.alternate;
                        if (alternate_block) {
                            alternate = this.simplify_ambiguous_flow(
                                alternate_block as t.BlockStatement,
                                ctx,
                                { type: "IfStatement" }
                            );
                        } else {
                            alternate = null;
                        }
                    }
                } else if (t.isBlockStatement(node.alternate)) {
                    alternate = this.simplify_ambiguous_flow(node.alternate as t.BlockStatement, ctx, { type: "IfStatement" }); // Could be null
                } else if (!node.alternate) {
                    alternate = null;
                } else {
                    throw new NotImplementedException(`IfStatement.Alternate implementation for node type '${node.alternate?.type}' not implemented`);
                }

                return this.append_ast(
                    t.ifStatement(
                        get_repr(test), 
                        consequent, 
                        alternate
                    )
                )
            } else { // Not tainted: Execute normally
                let block = test.value ? node.consequent : node.alternate;
                if (block) {
                    // Should add executed statement to AST
                    let exec_stmt = this.get_stmt_wrapper(
                        this.eval, block, ctx
                    ) as t.BlockStatement | t.ExpressionStatement;

                    return this.append_ast(exec_stmt);
                } else {
                    return; // IfStatement is redundant and is removed completely from the code
                }
            }
        }
        
        /**
         * {
         *     body: Statement[],
         *     directives: Directive[]
         * }
         */
        // Critical Assumption: Code executed in a standard block does NOT create a new scope
        // Note: let, const, and function declarations are defined in the block-scope which does not follow the assumption
        if (t.isBlockStatement(node)) {
            let initial_return_stmt_flag = this.return_stmt_flag; // Temp store the return_stmt_flag
            this.return_stmt_flag = true;
            let block: Array<t.Statement> = [];
            for (let i = 0;i < node.body.length; i++) {
                let stmt = node.body[i];

                let result;
                
                try {
                    result = this.eval(stmt, ctx);
                } catch (err) {
                    block.push(stmt);

                    this.return_stmt_flag = initial_return_stmt_flag;
                    
                    // Temporarily save error state here
                    this.flags.error_state = t.blockStatement(block); 

                    throw err;
                }

                if (result) block.push(result as t.Statement);


                if (this.callstack[this.callstack.length - 1] !== ctx) { // Used for functions, loops
                    break; // No longer in context - Break out of block
                }
            }
            this.return_stmt_flag = initial_return_stmt_flag; // Restore state saved from earlier
            return this.append_ast(t.blockStatement(block));
        }

        /**
         * {
         *     operator: string,
         *     left: LVal | OptionalMemberExpression,
         *     right: Expression
         * }
         */
        if (t.isAssignmentExpression(node)) {
            // If any operands are tainted, the assignment is also tainted
            let right_id = this.eval(node.right, ctx) as TaintedLiteral;

            function resolveAssignmentExpression(operator: string, left: any, right: any): any {
                // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_operators
                switch (operator) {
                    case '=':
                        return right;
                    case '+=':
                        return left + right;
                    case '-=':
                        return left - right;
                    case '*=':
                        return left * right;
                    case '/=':
                        return left / right;
                    case '%=':
                        return left % right;
                    case '**=':
                        return left ** right;
                    case '<<=':
                        return left << right;
                    case '>>=':
                        return left >> right;
                    case '>>>=':
                        return left >>> right;
                    case '&=':
                        return left & right;
                    case '^=':
                        return left ^ right;
                    case '|=':
                        return left | right;
                    default:
                        throw new NotImplementedException(operator)
                }
            }

            if (t.isIdentifier(node.left)) {
                let name = node.left.name;

                if (right_id.isTainted) { // If right is tainted, taint assignment
                    ctx.environment.assign(name, {
                        node: get_repr(right_id),
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

                let left = left_id.value; // Extract value
                let value = resolveAssignmentExpression(node.operator, left, right);
                
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
            
            // Note: It is assumed that UNTAINTED[TAINTED] will taint the entire object
            if (t.isMemberExpression(node.left)) {
                const node_left = (node.left as t.MemberExpression);

                // ========== STEP 1: Extract property path and format final node ==========
                // Extract root identifier and full property path before evaluating
                // This is critical for nested member expressions like clean[0][1]
                let current_node: t.Expression = node_left;
                const property_path: TaintedLiteral[] = [];
                let root_identifier: string | null = null;

                // Walk up the MemberExpression chain to build the complete path
                while (t.isMemberExpression(current_node)) {
                    const member_expr = current_node as t.MemberExpression;
                    const prop = member_expr.computed
                        ? this.eval(member_expr.property, ctx) as TaintedLiteral
                        : { value: (member_expr.property as t.Identifier).name, isTainted: false };
                    property_path.unshift(prop);
                    current_node = member_expr.object;
                }

                // Check if the root is an identifier
                if (t.isIdentifier(current_node)) {
                    root_identifier = current_node.name;
                }

                // Build the formatted AST node (preserves original structure like clean[2 + 2][1] -> clean[4][1])
                let formatted_node;
                if (root_identifier) {
                    formatted_node = current_node as t.Identifier;
                } else {
                    let root = this.eval(current_node, ctx) as TaintedLiteral;
                    formatted_node = get_repr(root);
                }

                for (let property of property_path) {
                    formatted_node = t.memberExpression(
                        formatted_node,
                        get_repr(property),
                        true // Always use computed style for consistency
                    );
                }

                formatted_node = formatted_node as t.MemberExpression;

                // ========== STEP 2: Evaluate left side ==========
                const left_object = this.eval(node_left.object, ctx) as TaintedLiteral;
                const left_property = this.eval(node_left.property, ctx) as TaintedLiteral;

                // ========== STEP 3: Handle cases where left side is tainted ==========
                // Case 1: TAINTED[*] ?= *
                if (left_object.isTainted) {
                    // Object is already tainted, can't resolve property access
                    // Just return tainted assignment expression
                    return {
                        node: t.assignmentExpression(
                            node.operator,
                            formatted_node,
                            get_repr(right_id)
                        ),
                        isTainted: true
                    };
                }

                // Case 2: UNTAINTED[TAINTED] ?= *
                if (left_property.isTainted) {
                    // Since we don't know which property is being set, taint the target object
                    // For nested paths like arr[0][TAINTED], we need to taint arr[0], not arr
                    if (root_identifier) {
                        ctx.environment.assignNestedMemberProperty(
                            root_identifier,
                            property_path,
                            {
                                node: t.identifier(root_identifier),
                                value: undefined,
                                isTainted: true
                            },
                            formatted_node?.object
                        )

                        // Since there is a part of root_identifier that is tainted & cannot be visualized,
                        // we must set the node of root_identifier to appear tainted
                        ctx.environment.resolve(root_identifier).node = t.identifier(root_identifier);
                    }

                    // Return tainted assignment expression
                    return {
                        node: t.assignmentExpression(
                            node.operator,
                            formatted_node,
                            get_repr(right_id)
                        ),
                        isTainted: true
                    };
                }


                // ========== STEP 5: Handle UNTAINTED[UNTAINTED] ?= * ==========
                // At this point: left_object, and left_property, are all untainted

                // Retrieve the current value to evaluate the AssignmentExpression
                let current_value = (left_object.value)[left_property.value] as TaintedLiteral;

                // Case 3: UNTAINTED[UNTAINTED] -> tainted value ?= * where value at that location is tainted
                // If the stored value is tainted, we can perform the assignment
                if (current_value?.isTainted) {
                    let assigned_value: TaintedLiteral;

                    if (node.operator === '=') {
                        // Simple assignment - just use the RHS
                        assigned_value = right_id;
                    } else {
                        // Compound operator - create binary expression: tainted_value OP rhs
                        const operator_map: { [key: string]: t.BinaryExpression['operator'] } = {
                            '+=': '+', '-=': '-', '*=': '*', '/=': '/', '%=': '%', '**=': '**',
                            '<<=': '<<', '>>=': '>>', '>>>=': '>>>', '&=': '&', '^=': '^', '|=': '|'
                        };
                        const binary_op = operator_map[node.operator];
                        if (!binary_op) throw new NotImplementedException(node.operator);

                        assigned_value = {
                            node: t.binaryExpression(binary_op, get_repr(current_value), get_repr(right_id)),
                            isTainted: true
                        };
                    }

                    // Perform the assignment
                    if (root_identifier) {
                        ctx.environment.assignNestedMemberProperty(
                            root_identifier,
                            property_path,
                            assigned_value,
                            formatted_node
                        );
                    } else {
                        (left_object.value)[left_property.value] = assigned_value;
                    }

                    return {
                        node: t.assignmentExpression(
                            node.operator,
                            formatted_node,
                            get_repr(right_id)
                        ),
                        isTainted: assigned_value.isTainted
                    };
                }

                let assigned_value: TaintedLiteral;
                let is_tainted: boolean;

                // Case 4: UNTAINTED[UNTAINTED] ?= TAINTED
                if (right_id.isTainted) {
                    is_tainted = true;

                    // For simple assignment, just use the tainted RHS
                    if (node.operator === '=') {
                        assigned_value = right_id;
                    } else {
                        // For compound operators, create binary expression: current_value OP tainted_rhs
                        const operator_map: { [key: string]: t.BinaryExpression['operator'] } = {
                            '+=': '+', '-=': '-', '*=': '*', '/=': '/', '%=': '%', '**=': '**',
                            '<<=': '<<', '>>=': '>>', '>>>=': '>>>', '&=': '&', '^=': '^', '|=': '|'
                        };
                        const binary_op = operator_map[node.operator];
                        if (!binary_op) throw new NotImplementedException(node.operator);

                        assigned_value = {
                            node: t.binaryExpression(binary_op, get_repr(current_value), right_id.node as t.Expression),
                            isTainted: true
                        };
                    }
                }
                // Case 5: UNTAINTED[UNTAINTED] ?= UNTAINTED
                else {
                    is_tainted = false;

                    // Compute the new value
                    const computed_value = resolveAssignmentExpression(node.operator, current_value.value, right_id.value);
                    assigned_value = { value: computed_value, isTainted: false };
                }

                // Perform the assignment
                if (root_identifier) {
                    ctx.environment.assignNestedMemberProperty(
                        root_identifier,
                        property_path,
                        assigned_value,
                        formatted_node
                    );
                } else {
                    (left_object.value)[left_property.value] = assigned_value;
                }

                return {
                    node: t.assignmentExpression(
                        node.operator,
                        formatted_node,
                        get_repr(right_id)
                    ),
                    isTainted: is_tainted
                };
            }

        }

        // Function support

        /**
         * {
         *     id?: Identifier | null,
         *     params: Array<Identifier | Pattern | RestElement>,
         *     body: BlockStatement,
         *     generator: boolean,
         *     async: boolean,
         *     declare?: boolean | null,
         *     predicate?: DeclaredPredicate | InferredPredicate | null,
         *     returnType?: TypeAnnotation | TSTypeAnnotation | Noop | null
         * }
         */
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
            const runner = function(args: Array<TaintedLiteral>, parent_env: Environment) {

                // Define parameters
                const activation_record: Map<string, TaintedLiteral | IArguments> = new Map();
                for (let i=0;i<params.length;i++) {
                    activation_record.set(params[i], args[i]) // arguments should be of type TaintLiteral when executed
                }

                function arguments_wrapper(_: any) {return arguments;}
                activation_record.set('arguments', {
                    // Ommit value of arguments if it is assumed to be tainted; reserved for future work
                    // value: arguments_wrapper(args),
                    node: t.identifier('arguments'),
                    isTainted: true // Assume arguments are tainted
                });

                // Add new ExecutionContext
                const env = new Environment(activation_record, parent_env, false, false);

                // @ts-ignore - Ignore `this` error
                const exec_ctx = new ExecutionContext(self, env, 'FunctionExpression'); // When executed, it will be in context of a FunctionExpression
                self.callstack.push(exec_ctx);

                self.returnValue = {
                    value: null,
                    isTainted: false
                };
                
                const initial_return_stmt_flag = self.return_stmt_flag;
                self.return_stmt_flag = true; // Enable this so that code does not dupe
                self.eval(node.body, exec_ctx); // Executes block
                self.return_stmt_flag = initial_return_stmt_flag;

                // Remove ExecutionContext (only if it hasn't been popped by a return statement)
                self.safe_pop_context(exec_ctx);

                // If there was a return in a tainted environment, the return value is uncertain
                if (env.taint_parent_writes) {
                    self.returnValue.isTainted = true;
                }

                // @ts-ignore - Ignore `this` error
                return new.target ? self : self.returnValue; // When ran with new, return this
            }
            if (name) {
                ctx.environment.declare(name);
                ctx.environment.assign(name, {
                    node: t.identifier(name),
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
            const exec_ctx = new ExecutionContext(self, env, 'FunctionDeclaration');
            self.callstack.push(exec_ctx);

            // Run block in isolation
            const initial_return_stmt_flag = self.return_stmt_flag;
            self.return_stmt_flag = true; // returns the block instead of result
            const body = self.eval(node.body, exec_ctx) as t.BlockStatement;
            self.return_stmt_flag = initial_return_stmt_flag;

            // Remove ExecutionContext
            self.safe_pop_context(exec_ctx);

            // Adding function to AST
            const func_decl = t.functionDeclaration(
                name ? t.identifier(name) : null,
                node.params,
                body
            )
            return name ? self.append_ast(func_decl) : func_decl;
        }

        /**
         *    id?: Identifier | null,
         *    params: Array<Identifier | Pattern | RestElement>,
         *    body: BlockStatement,
         *    generator: boolean,
         *    async: boolean,
         *    predicate?: DeclaredPredicate | InferredPredicate | null
         *}
         */
        // TODO: 
        // Correct implementation of `this` object
        // arguments is a list of mixed Tainted and Untainted variables
        // toString method on functions
        // Support all argument types (...args)
        if (t.isFunctionExpression(node)) {
            if (node.generator || node.async) throw new NotImplementedException("Generator or Async FunctionExpression is not supported");
            if (t.isRestElement(node.params[0]) || t.isPattern(node.params[0])) throw new NotImplementedException("RestElement and Patterns not supported for FunctionExpressions");
            if (node.id && !t.isIdentifier(node.id)) throw new NotImplementedException(`FunctionExpression ID is of type ${typeof node.id} which is not supported`)

            let name = node.id ? node.id.name : null;

            // Function implementation
            const params = (node.params as Array<t.Identifier>).map((param) => param.name);
            const self = this;
            const parent_env = ctx.environment;

            // Runner function (same as FunctionDeclaration)
            const runner = function(args: Array<TaintedLiteral>, parent_env: Environment) {
                const activation_record: Map<string, TaintedLiteral | IArguments> = new Map();
                for (let i = 0;i < params.length; i++) {
                    activation_record.set(params[i], args[i]);
                }

                activation_record.set('arguments', {
                    node: t.identifier('arguments'),
                    isTainted: true
                });

                const env = new Environment(activation_record, parent_env, false, false);
                const exec_ctx = new ExecutionContext(self, env, 'FunctionExpression');
                self.callstack.push(exec_ctx);

                self.returnValue = {
                    value: null,
                    isTainted: false
                };

                const initial_return_stmt_flag = self.return_stmt_flag;
                self.return_stmt_flag = true;
                self.eval(node.body, exec_ctx);
                self.return_stmt_flag = initial_return_stmt_flag;

                // Remove ExecutionContext (only if it hasn't been popped by a return statement)
                self.safe_pop_context(exec_ctx);

                // If there was a return in a tainted environment, the return value is uncertain
                if (env.taint_parent_writes) {
                    self.returnValue.isTainted = true;
                }

                // @ts-ignore
                return new.target ? self : self.returnValue;
            }

            // Build simplified body
            const record: Map<string, TaintedLiteral> = new Map();
            for (let param of params) {
                record.set(param, {
                    node: t.identifier(param),
                    isTainted: true
                })
            }
            record.set('arguments', {
                node: t.identifier('arguments'),
                isTainted: true
            });

            const env = new Environment(record, null, false, false, true);
            const exec_ctx = new ExecutionContext(self, env, 'FunctionExpression');
            self.callstack.push(exec_ctx);

            const initial_return_stmt_flag = self.return_stmt_flag;
            self.return_stmt_flag = true;
            const body = self.eval(node.body, exec_ctx) as t.BlockStatement;
            self.return_stmt_flag = initial_return_stmt_flag;

            self.safe_pop_context(exec_ctx);

            // Return as TaintedLiteral with the runner function
            const func_expr = t.functionExpression(
                name ? t.identifier(name) : null,
                node.params,
                body
            );

            return {
                node: func_expr,
                value: runner,
                isTainted: false
            };
        }

        /**
         * {
         *     callee: Expression | Super | V8IntrinsicIdentifier,
         *     arguments: Array<Expression | SpreadElement | ArgumentPlaceholder>,
         *     optional?: boolean | null,
         *     typeArguments?: TypeParameterInstantiation | null,
         *     typeParameters?: TSTypeParameterInstantiation | null
         * }
         */
        // Note: Embed tainted variables in the sequence expression
        // Despite being tainted, they still have a visual representation
        if (t.isCallExpression(node)) {
            // Evaluate the callee to get the function
            const callee_tl = this.eval(node.callee, ctx) as TaintedLiteral;

            // If callee is tainted, return tainted call expression
            if (callee_tl.isTainted) {
                return {
                    node: node,
                    isTainted: true
                };
            }

            // Evaluate arguments
            const args = node.arguments.map((n) => this.eval(n, ctx) as TaintedLiteral);

            // Call the function
            const func = callee_tl.value as Function;
            const result: TaintedLiteral = func(args, ctx.environment);

            // Rebuild the call expression with simplified arguments
            const simplified_call = t.callExpression(
                node.callee,
                args.map((arg) => get_repr(arg))
            );

            // Return as sequence expression if untainted
            if (!result.isTainted) {
                const seq_expr = t.sequenceExpression([
                    simplified_call,
                    // Do not use get_repr since we do not want the 
                    // nodal representation, just the pure Literal value
                    Value(result.value)
                ]);
                return {
                    node: seq_expr,
                    value: result.value,
                    isTainted: false
                }
            }

            // Return value is tainted
            return {
                node: simplified_call,
                value: result.value,
                isTainted: true
            };
        }

        /**
         * {
         *     argument?: Expression | null
         * }
         */
        if (t.isReturnStatement(node)) {
            if (node.argument) this.returnValue = this.eval(node.argument, ctx) as TaintedLiteral;

            // Find the function context we're returning from
            let func_exec_ctx: ExecutionContext | undefined;
            for (let i = this.callstack.length - 1; i >= 0; i--) {
                if (this.callstack[i].type === 'FunctionExpression' || this.callstack[i].type === 'FunctionDeclaration') {
                    func_exec_ctx = this.callstack[i];
                    break;
                }
            }

            if (!func_exec_ctx) {
                throw new Error("ReturnStatement outside of function");
            }

            // Check if there's ANY tainted environment between current context and function context
            let inTaintedEnv = false;
            for (let i = this.callstack.length - 1; i >= 0; i--) {
                if (this.callstack[i] === func_exec_ctx) break;
                if (this.callstack[i].environment.is_tainted()) {
                    inTaintedEnv = true;
                    break;
                }
            }

            if (!inTaintedEnv) {
                // Untainted environment - actually break out of execution
                // Pop contexts until we escape the function context
                while (this.callstack.length > 0) {
                    const top = this.callstack.pop();
                    if (!top || top.type === 'FunctionExpression' || top.type === 'FunctionDeclaration') {
                        break; // Stop after popping the function context
                    }
                }
            } else {
                // Tainted environment - pop contexts until we find a tainted environment
                while (!(this.callstack.pop() as ExecutionContext).environment.is_tainted());

                // Mark function environment to taint subsequent writes
                func_exec_ctx.environment.taint_parent_writes = true;
            }

            // Add to AST
            const return_arg = node.argument ? get_repr(this.returnValue) : null;
            const return_stmt = t.returnStatement(return_arg);
            return this.append_ast(return_stmt);
        }


        // Error Support

        /**
         * {
         *     block: BlockStatement,
         *     handler?: {
         *         param?: Identifier | ArrayPattern | ObjectPattern | null,
         *         body: BlockStatement
         *     },
         *     finalizer?: BlockStatement | null
         * }
         */
        // Assumptions
        // Variables use `var` (function scope), whereas `let` would create a new environment in the try block
        // 
        if (t.isTryStatement(node)) {
            let try_block, catch_block, finalizer_block;


            // This code is used for the catch block phase. However, we define it here for simplicity purposes
            let param_name, original_error_value;
            // Get error parameter name; may be undefined
            const handler = node.handler as t.CatchClause;
            if (handler.param) { // Assume param is an identifier

                // Temporarily save the initial value of the error
                param_name = (handler.param as t.Identifier).name;
                try {
                    // Try resolving for name
                    original_error_value = ctx.environment.resolve(param_name);
                } catch (error) {
                    if (!(error instanceof ReferenceException)) throw error;
                    ctx.environment.declare(param_name); // Declare error variable if not defined
                }
            }

            // Executor
            const initial_return_stmt_flag = this.return_stmt_flag;
            try {
                this.return_stmt_flag = true;
                try_block = this.eval(node.block, ctx);
                this.return_stmt_flag = initial_return_stmt_flag;
            } catch (wrapped_error) {
                this.return_stmt_flag = initial_return_stmt_flag;

                if (wrapped_error instanceof DeobfuscatorException) {
                    throw wrapped_error; // Error with deobfuscator
                }

                const error = (wrapped_error as Error);

                // Set error as untainted
                if (param_name) ctx.environment.assign(param_name, {
                    value: error,
                    isTainted: false
                });

                // Evaluate block
                catch_block = this.get_stmt_wrapper(
                    this.eval, 
                    handler.body,
                    ctx
                ) as t.BlockStatement;

                if (original_error_value) ctx.environment.assign(
                    (param_name as string), // If original_error_value is defined, so is param_name
                    original_error_value
                );
            } finally {

                // If the catch block was not executed, we assume the block is tainted
                // Taint must be propogated before executing finalizer block
                if (!catch_block) {
                    // Environment setup
                        
                    // Set error as tainted
                    if (param_name) {
                        ctx.environment.assign(param_name, {
                            node: t.identifier(param_name),
                            isTainted: true
                        });
                    }

                    // Simplify block - Function executes in isolation so only taint is propogated
                    catch_block = this.simplify_ambiguous_flow(handler.body as t.BlockStatement, ctx, { type: "CatchClause" }) as t.BlockStatement;

                    // Reset environment
                    if (original_error_value) ctx.environment.assign(
                        (param_name as string), // If original_error_value is defined, so is param_name
                        original_error_value
                    );
                }

                // Execute finalizer block
                if (node.finalizer) {
                    finalizer_block = this.get_stmt_wrapper(
                        this.eval, 
                        node.finalizer, 
                        ctx
                    ) as t.BlockStatement;
                }
            }

            if (!try_block) { // Error occurred. Error state must be retrieved
                try_block = this.flags.error_state;
            }

            const catch_clause = t.catchClause(
                param_name ? t.identifier(param_name) : undefined,
                catch_block
            )

            const try_stmt = t.tryStatement(
                (try_block as t.BlockStatement),
                catch_clause,
                finalizer_block
            )

            return this.append_ast(try_stmt)
        }

        // Jump Statements
        /**
         * {
         *     label: Identifier,
         *     body: Statement
         * }
         */
        if (t.isLabeledStatement(node)) {
            const label = node.label.name; // Label is always an identifier

            // Execution Phase

            // Create new ExecutionContext with the label set
            const env = new Environment(new Map(), ctx.environment);
            const exec_ctx = new ExecutionContext(this, env, "LabeledStatement", label);
            this.callstack.push(exec_ctx);

            const body = this.get_stmt_wrapper(
                this.eval,
                node.body,
                exec_ctx
            )

            if (exec_ctx == this.callstack[this.callstack.length - 1]) { // If the Label was not broken out of, it should still be on callstack
                this.callstack.pop();
            }

            // AST Phase
            const labeled_stmt = t.labeledStatement(
                t.identifier(label),
                (body as t.Statement)
            )


            return this.append_ast(labeled_stmt);
        }

        // if (t.isThrowStatement(node)) {
        //     const arg = this.eval(node.argument, ctx) as TaintedLiteral;

        //     const throw_stmt = t.throwStatement(get_repr(arg));
        //     const ret = this.append_ast(throw_stmt);

        //     throw arg;
        //     return ret;
        // }

        /**
         * {
         *     label?: Identifier | null
         * }
         */
        // Note: Ensure `break_exec_ctx.environment.taint_parent_writes = true;` is correct and ....taint_parent_writes is idempotent
        if (t.isBreakStatement(node)) {
            const BREAKABLE_ENVIRONMENTS = ['ForInStatement', 'SwitchCase', 'SwitchStatement', 'ForStatement', 'DoWhileStatement', 'WhileStatement', 'LabeledStatement']
            
            // 1. Find loop's ExecutionContext being broken out of
            let label = node.label?.name;
            let break_exec_ctx: ExecutionContext | undefined;
            for (let i = this.callstack.length - 1; i >= 0; i--) {
                if ((label && this.callstack[i]?.name === label) || (!label && BREAKABLE_ENVIRONMENTS.includes(this.callstack[i]?.type))) {
                    break_exec_ctx = this.callstack[i];
                    break;
                }
            }

            if (typeof break_exec_ctx === 'undefined') {
                throw new ReferenceException(`LabelStatement: ${label}`);
            }

            if (!ctx.environment.is_tainted_environment(break_exec_ctx.environment)) { // Non-tainted Environment
                if (label) { // Keep removing environments until label is hit
                    while ((this.callstack.pop() as ExecutionContext)?.name !== label) {
                        if (this.callstack.length === 0) {
                            throw new ReferenceException(`LabelStatement: ${label}`);
                        }
                    }

                    return;

                } else { // Untainted environment - Keep removing environments until a BREAKABLE ENVIRONMENT is hit
                    while (!BREAKABLE_ENVIRONMENTS.includes((this.callstack.pop() as ExecutionContext)?.type)) {
                        if (this.callstack.length === 0) {
                            throw new Error("`break` Statement called outside of a loop");
                        }
                    }

                    // Add to AST

                    // const break_stmt = t.breakStatement(null);

                    // return this.append_ast(break_stmt);
                    return;
                }
            } else { // Tainted Environment
                while (!(this.callstack.pop() as ExecutionContext).environment.is_tainted());

                break_exec_ctx.environment.taint_parent_writes = true; // Taint the environment just before this

                const break_stmt = t.breakStatement(
                    label ? t.identifier(label) : null
                )

                return this.append_ast(break_stmt);
            }
        }

        // Loops
        /**
         * {
         *     test: Expression,
         *     body: Statement
         * }
         */
        if (t.isWhileStatement(node)) {
            // Execute loop
            let test = this.eval(node.test, ctx) as TaintedLiteral;

            // Untainted While Loop
            let block_stmts: t.Statement[] = [];

            const env_1 = new Environment(new Map(), ctx.environment, false, false, false);
            const exec_ctx_1 = new ExecutionContext(this, env_1, 'WhileStatement');
            this.callstack.push(exec_ctx_1);

            while (!test.isTainted && !exec_ctx_1.environment.is_tainted() && test.value) { // Quit if test is taint or test is False

                // Evaluate Block
                const evaluated_block = this.get_stmt_wrapper(
                    this.eval,
                    node.body,
                    exec_ctx_1
                ) as t.BlockStatement;
                block_stmts.push(evaluated_block);

                if (exec_ctx_1 !== this.callstack[this.callstack.length - 1]) {
                    break;
                }

                test = this.eval(node.test, ctx) as TaintedLiteral; // Re-evaluate test
            }

            this.safe_pop_context(exec_ctx_1);

            // Tainted While Loop
            if (test.isTainted || exec_ctx_1.environment.is_tainted()) {
                // We must update unchanged_variables through a first pass, then deobfuscate the code
                const env = new Environment(new Map(), ctx.environment, true, false, true);
                const exec_ctx = new ExecutionContext(this, env, 'WhileStatement');

                this.callstack.push(exec_ctx);

                // Run block in isolation until the function is idempotent
                // This is because a variable may be write-tainted when referenced previously (and not tainted previously)
                let body: t.BlockStatement;
                let test_stmt: TaintedLiteral;
                while (true) {
                    // Clear local environment to prevent infinite loops from persisting local values
                    env.getLocalRecord().clear();

                    const initial_return_stmt_flag = this.return_stmt_flag;
                    this.return_stmt_flag = true; // returns the block instead of result

                    const newbody = this.eval(node.body, exec_ctx) as t.BlockStatement;
                    this.return_stmt_flag = initial_return_stmt_flag;

                    // Evaluate test in parent context to avoid finding locally-stored variables
                    const new_test_stmt = this.eval(node.test, ctx) as TaintedLiteral;

                    // Check idempotency
                    // @ts-ignore
                    if (body && test_stmt && t.isNodesEquivalent(body, newbody) && t.isNodesEquivalent(test_stmt.node, new_test_stmt.node)) {
                        break;
                    }
                    body = newbody;
                    test_stmt = new_test_stmt;
                }

                // Remove ExecutionContext
                this.safe_pop_context(exec_ctx);


                const while_stmt = t.whileStatement(
                    get_repr(test_stmt),
                    body
                );

                return this.append_ast(while_stmt);
            }

            // Not tainted
            const encapsulated_blocks = t.blockStatement(block_stmts);
            return this.append_ast(encapsulated_blocks);
        }

        if (t.isDoWhileStatement(node)) {
            // Execute do-while loop - body executes at least once before test

            // Untainted Do-While Loop
            let block_stmts: t.Statement[] = [];

            const env_1 = new Environment(new Map(), ctx.environment, false, false, false);
            const exec_ctx_1 = new ExecutionContext(this, env_1, 'DoWhileStatement');
            this.callstack.push(exec_ctx_1);

            // Execute body at least once
            let test: TaintedLiteral = { value: true, isTainted: false }; // Initialize for do-while, will be overwritten
            do {
                // Evaluate Block
                const evaluated_block = this.get_stmt_wrapper(
                    this.eval,
                    node.body,
                    exec_ctx_1
                ) as t.BlockStatement;
                block_stmts.push(evaluated_block);

                if (exec_ctx_1 !== this.callstack[this.callstack.length - 1]) {
                    break;
                }

                test = this.eval(node.test, ctx) as TaintedLiteral; // Evaluate test after body
            } while (!test.isTainted && !exec_ctx_1.environment.is_tainted() && test.value);

            this.safe_pop_context(exec_ctx_1);

            // Tainted Do-While Loop
            if (test.isTainted || exec_ctx_1.environment.is_tainted()) {
                // We must update unchanged_variables through a first pass, then deobfuscate the code
                const env = new Environment(new Map(), ctx.environment, true, false, true);
                const exec_ctx = new ExecutionContext(this, env, 'DoWhileStatement');

                this.callstack.push(exec_ctx);

                // Run block in isolation until the function is idempotent
                // This is because a variable may be write-tainted when referenced previously (and not tainted previously)
                let body: t.BlockStatement;
                let test_stmt: TaintedLiteral;
                while (true) {
                    // Clear local environment to prevent infinite loops from persisting local values
                    env.getLocalRecord().clear();

                    const initial_return_stmt_flag = this.return_stmt_flag;
                    this.return_stmt_flag = true; // returns the block instead of result

                    const newbody = this.eval(node.body, exec_ctx) as t.BlockStatement;
                    this.return_stmt_flag = initial_return_stmt_flag;

                    // Evaluate test in parent context to avoid finding locally-stored variables
                    const new_test_stmt = this.eval(node.test, ctx) as TaintedLiteral;

                    // Check idempotency
                    // @ts-ignore
                    if (body && test_stmt && t.isNodesEquivalent(body, newbody) && t.isNodesEquivalent(test_stmt.node, new_test_stmt.node)) {
                        break;
                    }
                    body = newbody;
                    test_stmt = new_test_stmt;
                }

                // Remove ExecutionContext
                this.safe_pop_context(exec_ctx);

                const do_while_stmt = t.doWhileStatement(
                    get_repr(test_stmt),
                    body
                );

                return this.append_ast(do_while_stmt);
            }

            // Not tainted
            const encapsulated_blocks = t.blockStatement(block_stmts);
            return this.append_ast(encapsulated_blocks);
        }

        if (t.isForStatement(node)) {
            // Execute for loop: for (init; test; update) body

            // Untainted For Loop
            let block_stmts: t.Statement[] = [];

            const env_1 = new Environment(new Map(), ctx.environment, false, false, false);
            const exec_ctx_1 = new ExecutionContext(this, env_1, 'ForStatement');
            this.callstack.push(exec_ctx_1);

            // Execute init and capture it for output
            let init_stmt: t.VariableDeclaration | t.ExpressionStatement | null = null;
            if (node.init) {
                const initial_return_stmt_flag = this.return_stmt_flag;
                this.return_stmt_flag = true;

                if (t.isVariableDeclaration(node.init)) {
                    // VariableDeclaration -> eval returns VariableDeclaration
                    init_stmt = this.eval(node.init, exec_ctx_1) as t.VariableDeclaration;
                } else {
                    // Expression -> eval returns TaintedLiteral, need to wrap in ExpressionStatement
                    const init_expr = this.eval(node.init, exec_ctx_1) as TaintedLiteral;
                    init_stmt = t.expressionStatement(get_repr(init_expr));
                }

                this.return_stmt_flag = initial_return_stmt_flag;
            }

            // Execute loop
            let test: TaintedLiteral = { value: true, isTainted: false }; // Default to true if no test
            if (node.test) {
                test = this.eval(node.test, exec_ctx_1) as TaintedLiteral;
            }

            while (!test.isTainted && !exec_ctx_1.environment.is_tainted() && test.value) {

                // Evaluate Block
                const evaluated_block = this.get_stmt_wrapper(
                    this.eval,
                    node.body,
                    exec_ctx_1
                ) as t.BlockStatement;

                // Check if return statement popped the context
                if (exec_ctx_1 !== this.callstack[this.callstack.length - 1]) {
                    block_stmts.push(evaluated_block);
                    break;
                }

                // Add update expression to the block if it exists (only if we didn't return)
                if (node.update) {
                    const initial_return_stmt_flag = this.return_stmt_flag;
                    this.return_stmt_flag = true;
                    const update_expr = this.eval(node.update, exec_ctx_1) as TaintedLiteral;
                    this.return_stmt_flag = initial_return_stmt_flag;

                    // Add update as expression statement to the block
                    evaluated_block.body.push(t.expressionStatement(get_repr(update_expr)));
                }

                block_stmts.push(evaluated_block);

                // Re-evaluate test
                if (node.test) {
                    test = this.eval(node.test, exec_ctx_1) as TaintedLiteral;
                }
            }

            // Only pop if the context is still there (it might have been popped by a return statement)
            this.safe_pop_context(exec_ctx_1);

            // Tainted For Loop
            if (test.isTainted || exec_ctx_1.environment.is_tainted()) {
                // We must update unchanged_variables through a first pass, then deobfuscate the code
                const env = new Environment(new Map(), ctx.environment, true, false, true);
                const exec_ctx = new ExecutionContext(this, env, 'ForStatement');

                this.callstack.push(exec_ctx);

                // Execute init in parent context so variables are accessible outside the loop
                let init_stmt: t.VariableDeclaration | t.Expression | null = null;
                if (node.init) {
                    const initial_return_stmt_flag = this.return_stmt_flag;
                    this.return_stmt_flag = true;

                    if (t.isVariableDeclaration(node.init)) {
                        // VariableDeclaration -> eval returns VariableDeclaration
                        init_stmt = this.eval(node.init, ctx) as t.VariableDeclaration;
                    } else {
                        // Expression -> eval returns TaintedLiteral, extract expression
                        const init_expr = this.eval(node.init, ctx) as TaintedLiteral;
                        init_stmt = get_repr(init_expr);
                    }

                    this.return_stmt_flag = initial_return_stmt_flag;
                }

                // Run block in isolation until the function is idempotent
                // This is because a variable may be write-tainted when referenced previously (and not tainted previously)
                let body: t.BlockStatement | undefined;
                let test_stmt: TaintedLiteral | undefined;
                let update_stmt: t.Expression | null = null;
                while (true) {
                    // Clear local environment to prevent infinite loops from persisting local values
                    env.getLocalRecord().clear();

                    const initial_return_stmt_flag = this.return_stmt_flag;
                    this.return_stmt_flag = true; // returns the block instead of result

                    const newbody = this.eval(node.body, exec_ctx) as t.BlockStatement;
                    this.return_stmt_flag = initial_return_stmt_flag;

                    const new_test_stmt = node.test ? this.eval(node.test, ctx) as TaintedLiteral : { value: true, isTainted: false };
                    const new_update_stmt = node.update ? this.eval(node.update, exec_ctx) as TaintedLiteral : null;

                    // Check idempotency
                    // @ts-ignore
                    const update_equal = (!update_stmt && !new_update_stmt) ||
                        (update_stmt && new_update_stmt && t.isNodesEquivalent(update_stmt, get_repr(new_update_stmt)));

                    if (body && test_stmt && t.isNodesEquivalent(body, newbody) &&
                        test_stmt.node && t.isNodesEquivalent(test_stmt.node, new_test_stmt.node) && update_equal) {
                        break;
                    }
                    body = newbody;
                    test_stmt = new_test_stmt;
                    update_stmt = new_update_stmt ? get_repr(new_update_stmt) : null;
                }

                // Remove ExecutionContext
                this.safe_pop_context(exec_ctx);

                const for_stmt = t.forStatement(
                    init_stmt,
                    test_stmt && (test_stmt.value !== true || test_stmt.isTainted) ? get_repr(test_stmt) : null,
                    update_stmt,
                    body as t.BlockStatement
                );

                return this.append_ast(for_stmt);
            }

            // Not tainted - prepend init statement to the block if it exists
            if (init_stmt) {
                block_stmts.unshift(init_stmt);
            }

            const encapsulated_blocks = t.blockStatement(block_stmts);
            return this.append_ast(encapsulated_blocks);
        }

        /**
         * {
         *     elements: Array<null | Expression | SpreadElement>
         * }
         */
        // TODO: Taint is NOT assumed for all lists, but is not always the case.
        if (t.isArrayExpression(node)) {
            let element_list: Array<TaintedLiteral> = [];
            for (const element of node.elements) {
                element_list.push(
                    this.get_stmt_wrapper(
                        this.eval,
                        (element as t.Expression),
                        ctx
                    ) as TaintedLiteral
                );
            }

            const array_expr = t.arrayExpression(
                element_list.map((x) => get_repr(x))
            )

            return {
                // node: array_expr,
                value: element_list,
                isTainted: false
            }
        }

        /**
         * {
         *     object: Expression | Super,
         *     property: Expression | Identifier | PrivateName,
         *     computed: boolean,
         *     optional?: boolean | null
         * }
         */
        if (t.isMemberExpression(node)) {
            const object = this.eval(node.object, ctx) as TaintedLiteral;

            // Untainted object parameter -> can resolve to a value
            if (node.computed) { // a['a' + 'b']
                const property = this.eval(node.property, ctx) as TaintedLiteral;
                const member_expr: t.MemberExpression = this.format_member_expression(node, object, property);

                // Tainted object parameter -> cannot resolve
                if (object.isTainted) {
                    return {
                        node: member_expr,
                        isTainted: true
                    }
                }

                if (property.isTainted) { // UNTAINTED[TAINTED]
                    return {
                        node: member_expr,
                        isTainted: true
                    }
                } else { // UNTAINTED[UNTAINTED] -> Value!
                    const value = (object.value)[property.value];
                    if (value === undefined) {
                        return {
                            value: undefined,
                            isTainted: false
                        }
                    }

                    // Not undefined
                    return value;
                }
            } else { // (UN)TAINTED.IDENTIFIER; computed=false
                const property = (node.property as t.Identifier)

                // Tainted object parameter -> cannot resolve
                if (object.isTainted) {
                    const member_expr = t.memberExpression(
                        object.node as t.Expression,
                        property,
                        false
                    )
                    return {
                        node: member_expr,
                        isTainted: true
                    }
                }

                // Not tainted -> Resolve
                const value = (object.value)[property.name];
                if (value === undefined) {
                    return {
                        value: undefined,
                        isTainted: false
                    }
                }

                // Not undefined
                return value;
            }
        }

        /**
         * {
         *     object: Expression,
         *     property: Expression | Identifier,
         *     computed: boolean,
         *     optional: boolean
         * }
         */
        if (t.isOptionalMemberExpression(node)) {
            const object = this.eval(node.object, ctx) as TaintedLiteral;

            // Check if object is null or undefined (and untainted) - return undefined
            if (!object.isTainted && (object.value === null || object.value === undefined)) {
                return {
                    value: undefined,
                    isTainted: false
                };
            }

            // Untainted object parameter -> can resolve to a value
            if (node.computed) { // a['a' + 'b']
                const property = this.eval(node.property, ctx) as TaintedLiteral;
                
                /* ------------------------------------------------ */
                // Copied directly from format_member_expression, but modified for
                // OptionalMemberExpression
                const object_repr = object.node ? object.node : (node.object as t.Expression);
                let member_expr;
                if (!property.isTainted && t.isValidIdentifier(property.value)) {
                    member_expr = t.optionalMemberExpression(
                        object_repr,
                        t.identifier(property.value),
                        false,
                        true
                    )
                } else {
                    member_expr =  t.optionalMemberExpression(
                        object_repr,
                        get_repr(property),
                        true,
                        true
                    )
                }
                /* ------------------------------------------------ */

                // Tainted object parameter -> cannot resolve
                if (object.isTainted) {
                    return {
                        node: member_expr,
                        isTainted: true
                    }
                }

                if (property.isTainted) { // UNTAINTED[TAINTED]
                    return {
                        node: member_expr,
                        isTainted: true
                    }
                } else { // UNTAINTED[UNTAINTED] -> Value!
                    const value = (object.value)[property.value];
                    if (value === undefined) {
                        return {
                            value: undefined,
                            isTainted: false
                        }
                    }

                    // Not undefined
                    return value;
                }
            } else { // (UN)TAINTED.IDENTIFIER; computed=false
                const property = (node.property as t.Identifier)

                // Tainted object parameter -> cannot resolve
                if (object.isTainted) {
                    const member_expr = t.optionalMemberExpression(
                        object.node as t.Expression,
                        property,
                        false,
                        true
                    )
                    return {
                        node: member_expr,
                        isTainted: true
                    }
                }

                // Not tainted -> Resolve
                const value = (object.value)[property.name];
                if (value === undefined) {
                    return {
                        value: undefined,
                        isTainted: false
                    }
                }

                // Not undefined
                return value;
            }
        }

        // if (t.isObjectExpression(node)) {
        //     const obj = {}; // The literal representation
        //     let properties: Array<t.ObjectMethod | t.ObjectProperty | t.SpreadElement> = []; // The AST representation
        //     for (const property of node.properties) {
        //         if (t.isObjectProperty(property)) {
        //             const value = this.eval(property.value, ctx) as TaintedLiteral;

        //             if (property.computed) { // { [a]: 2 } - `a` must be computed
        //                 const key = this.eval(property.key, ctx) as TaintedLiteral;
        //                 if (key.isTainted) { // No object added to obj; uncomputed key added to properties
        //                     properties.push(t.objectProperty(
        //                         get_repr(key),           // Key
        //                         get_repr(value),         // value
        //                         true,                    // computed
        //                         false                    // shorthand
        //                     ));
        //                 } else { // Key is replaced with value and added to obj & properties
        //                     properties.push(t.objectProperty(
        //                         get_repr(key),           // Key
        //                         get_repr(value),         // value
        //                         false,                    // computed
        //                         false                    // shorthand
        //                     ));

        //                     Object.defineProperty(
        //                         obj,
        //                         key.value,
        //                         { value }
        //                     );
        //                 }
        //             }
        //             else {
        //                 // { x } -> { x: x }; We strip off the shorthand if present
        //                 // { x: y }
        //                 const key = (property.key as t.Identifier)
        //                 properties.push(t.objectProperty(
        //                     key,                     // key
        //                     get_repr(value),         // value
        //                     false,                   // computed
        //                     false                    // shorthand
        //                 ));

        //                 Object.defineProperty(
        //                     obj,
        //                     key.name,
        //                     { value }
        //                 );
        //             }
        //         } else if (t.isObjectMethod(property)) {
        //             let name;
        //             if (property.computed) {
        //                 const key = this.eval(property.key, ctx) as TaintedLiteral;                      
        //                 if (key.isTainted) { // No object added to obj; uncomputed key added to properties
        //                         properties.push(t.objectMethod(
        //                             property.kind,           // Kind
        //                             get_repr(key),           // Key
        //                             get_repr(value),         // value
        //                             true,                    // computed
        //                             false                    // shorthand
        //                         ));
        //                 } else { // Key is replaced with value and added to obj & properties
        //                     properties.push(t.objectMethod(
        //                         property.kind,           // Kind
        //                         get_repr(key),           // Key
        //                         get_repr(value),         // value
        //                         false,                   // computed
        //                         false                    // shorthand
        //                     ));

        //                     Object.defineProperty(
        //                         obj,
        //                         key.value,
        //                         { value }
        //                     );
        //                 }
        //             } else { // Not computed
        //                 const key = (property.key as t.Identifier)
        //                 properties.push(t.objectMethod(
        //                     property.kind,           // Kind
        //                     key,                     // key
        //                     get_repr(value),         // value
        //                     false,                   // computed
        //                     false                    // shorthand
        //                 ));

        //                 Object.defineProperty(
        //                     obj,
        //                     key.name,
        //                     { value }
        //                 );
        //             }


        //             const func_expr = t.functionExpression(
        //                 property.key, 
        //                 property.params, 
        //                 property.body
        //             );
        //         } else if (t.isSpreadElement(property)) {
        //             throw new NotImplementedException("SpreadElement has not been implemented into ObjectExpression");
        //         }
        //     }

        //     const obj_expr_node = t.objectExpression(
        //         properties
        //     )

        //     return {
        //         node: obj_expr_node,
        //         value: obj,
        //         isTainted: false
        //     };
        // }
        
        throw new NotImplementedException(node.type)
    }
}