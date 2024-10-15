import { Environment } from "./Environment";
import { ExecutionContext } from "./ExecutionContext";
import { NotImplementedException } from "./NotImplementedException";
import { ReferenceException } from "./ReferenceException";
import * as t from '@babel/types';
import { Value, get_repr } from './../utils/to_value';
export class TaintInterpreter {
    callstack: Array<ExecutionContext>;
    ast: Array<t.Node>;

    constructor(execCtx: ExecutionContext) {
        this.callstack = [execCtx];
        this.ast = []
    }

    eval(node: t.Node, ctx: ExecutionContext = this.callstack[this.callstack.length - 1], return_block: Boolean = false): t.Node | TaintedLiteral | undefined  {
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

            if (return_block) return expression;
            else {
                this.ast.push(expression);
                return;
            }
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
            this.ast.push(t.variableDeclaration(node.kind, declarations)); // Add declarations to ast
            return;
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
                    return t.variableDeclarator(t.identifier(id), init.node);
                } else { // If constant add to env and assign identifier to const
                    ctx.environment.assign(id, {
                        value: init.value,
                        isTainted: false
                    });
                    return t.variableDeclarator(t.identifier(id), Value(init.value));
                }
            }

            return t.variableDeclarator(t.identifier(id)); // No value, just return identifier
        }

        if (t.isIdentifier(node)) {
            // Return the identifier, if it is not defined then assume it is tainted
            try {
                let val = ctx.environment.resolve(node.name);
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
                for (let block of [node.consequent, node.alternate]) { // Run both blocks

                    if (!block) return;

                    let isolatedCtx = new ExecutionContext(
                        ctx.thisValue,
                        // @ts-expect-error - Environment is undefined in type checking so an error throws. Ignore
                        new Environment(new Map(), ctx.environment, true) // taint_parent_writes = true
                    )
                    
                    // Put if statement in it's own context
                    this.callstack.push(isolatedCtx);

                    // Execute the block
                    this.eval(block, isolatedCtx);

                    // Algorithm: Any variables defined in the inner block are tainted in outer scope
                    this.callstack.pop() // Remove isolatedEnv
                    isolatedCtx.environment.record.forEach((value: TaintedLiteral, key: string, _) => {
                        // Due to the assumption all definitions use var, all variables defined in the inner block will leak into the outer block
                        ctx.environment.setTaint(key, true);
                    })
                }
            } else { // Execute normally
                let block = test.value ? node.consequent : node.alternate;
                if (block) {
                    this.eval(block, ctx) as t.BlockStatement | t.ExpressionStatement;
                }
                return;
            }
        }

        if (t.isBlockStatement(node)) {
            for (let i=0;i<node.body.length;i++) {
                let stmt = node.body[i]
                this.eval(stmt, ctx);

                if (this.callstack[this.callstack.length - 1] !== ctx) { // Used for functions
                    break; // No longer in context - Break out of block
                }
            }
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
                        Value(value)
                    ),
                    isTainted: false
                } // Will be wrapped in another expression. ExpressionStatment, for example.
            }

            if (t.isMemberExpression(node.left)) {
                throw new NotImplementedException('MemberExpression')
            }

        }

        throw new NotImplementedException(node.type)
    }
}