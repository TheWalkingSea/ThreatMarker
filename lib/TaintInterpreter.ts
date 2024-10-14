import { Environment } from "./Environment";
import { ExecutionContext } from "./ExecutionContext";
import { NotImplementedException } from "./NotImplementedException";
import { ReferenceException } from "./ReferenceException";
import { TaintedNode } from "./TaintedNode";
import * as t from '@babel/types';

export class TaintInterpreter {
    callstack: Array<ExecutionContext>;

    constructor(execCtx: ExecutionContext) {
        this.callstack = [execCtx];
    }

    eval(node: t.Node, ctx: ExecutionContext = this.callstack[this.callstack.length - 1]): t.Node | TaintedLiteral | undefined  {
        if (t.isExpressionStatement(node)) {
            return this.eval(node.expression, ctx);
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
            node.declarations.forEach((declaration) => {
                return this.eval(declaration, ctx);
            })
        }

        if (t.isVariableDeclarator(node)) {
            // If the right side is tainted, make this variable tainted - Implicitly tainted
            let id = (this.eval(node.id) as TaintedLiteral).value;
            ctx.environment.declare(id);

            if (node.init) {
                let init = this.eval(node.init, ctx) as TaintedLiteral;
                ctx.environment.assign(id, init);
            }
        }

        if (t.isIdentifier(node)) {
            // Return the identifier, if it is not defined then assume it is tainted
            try {
                return ctx.environment.resolve(node.name).value;
            } catch (e) {
                if (e instanceof ReferenceException) {
                    return {
                        isTainted: true
                    } // Tainted ! - Defined in browser, not in NodeJS
                } else {
                    throw e
                }
            }
        }

        if (t.isBinaryExpression(node)) {
            // If left or right side of expression is tainted, make the entire expression tainted
            let l = this.eval(node.left, ctx) as TaintedLiteral;
            let r = this.eval(node.right, ctx) as TaintedLiteral;

            if (l.isTainted || r.isTainted) return {
                isTainted: true
            } // Taintness is inherited


            let left = l.value;
            let right = r.value;

            let value;
            switch (node.operator) {
                case '+':
                    value = left + right;
                case '-':
                    value = left - right;
                case '*':
                    value = left * right;
                case '/':
                    value = left / right;
                case '%':
                    value = left % right;
                case '**':
                    value = left ** right;
                case '&':
                    value = left & right;
                case '|':
                    value = left | right;
                case '>>':
                    value = left >> right;
                case '>>>':
                    value = left >>> right;
                case '<<':
                    value = left << right;
                case '^':
                    value = left ^ right;
                case '==':
                    value = left == right;
                case '===':
                    value = left === right;
                case '!=':
                    value = left != right;
                case '!==':
                    value = left !== right;
                case 'in':
                    value = left in right;
                case 'instanceof':
                    value = left instanceof right;
                case '>':
                    value = left > right;
                case '<':
                    value = left < right;
                case '>=':
                    value = left >= right;
                case '<=':
                    value = left <= right;
                case '|>':
                    throw new NotImplementedException('|> is not implemented');
            }


            // Code is reachable unless there is an exception - Ignore linter
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
            let value;
            node.expressions.forEach((expression) => {
                value = this.eval(expression, ctx) as TaintedLiteral; 
            })
            return value;
        }

        if (t.isUnaryExpression(node)) {
            // If the argument is tainted, return taint
            let argument = this.eval(node.argument) as TaintedLiteral;

            if (argument.isTainted) return {
                isTainted: true
            } // Taintness is inherited

            let right = argument.value;
            let value;
            switch (node.operator) {
                case 'void':
                    value = void value;
                case 'throw':
                    throw right;
                case 'delete':
                    // @ts-ignore - assume program writers handle this correctly
                    delete right;
                case '!':
                    value = !right;
                case '+':
                    value = +right;
                case '-':
                    value = -right;
                case '~':
                    value = ~right;
                case 'typeof':
                    value = typeof right;
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

                let isolatedCtx = new ExecutionContext(
                    ctx.thisValue,
                    new Environment()
                )
                
                // Put if statement in it's own context
                this.callstack.push(isolatedCtx)

                let block = test ? node.consequent : node.alternate
                if (!block) return;

                this.eval(block); // Use new execCtx

                // Algorithm: Any variables defined in the block that are defined in outer scope are tainted
                this.callstack.pop() // Remove isolatedEnv
                let currentEnv = (this.callstack[this.callstack.length - 1] as ExecutionContext).environment;
                isolatedCtx.environment.record.forEach((value: TaintedLiteral, key: string, _) => {
                    // Due to the assumption, all variables defined in the inner block will leak into the outer block
                    currentEnv.assign(key, {
                        isTainted: true
                    })
                })





            } else { // Execute normally
                let block = test ? node.consequent : node.alternate
                if (block) {
                    this.eval(block, ctx);
                }
            }
        }

        if (t.isBlockStatement(node)) {
            let currentCtx = this.callstack[this.callstack.length - 1];
            for (let i=0;i<node.body.length;i++) {
                let stmt = node.body[i]
                this.eval(stmt, ctx); // Don't specify ctx to use new ctx

                if (this.callstack[this.callstack.length - 1] !== currentCtx) {
                    break; // No longer in context - Break out of block
                }
            }
        }

        if (t.isAssignmentExpression(node)) {
            let r = this.eval(node.right, ctx) as TaintedLiteral;

            if (t.isIdentifier(node.left)) {
                let name = node.left.name;
                if (r.isTainted) {
                    ctx.environment.assign(name, {
                        isTainted: true
                    }) // Taint is passed down
                    return;
                }
                let right = r.value;
                let left = ctx.environment.resolve(name).value;

                let value;

                // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_operators
                switch (node.operator) {
                    case '=':
                        value = right;
                    case '+=':
                        value = left + right;
                    case '-=':
                        value = left - right;
                    case '*=':
                        value = left * right;
                    case '/=':
                        value = left / right;
                    case '%=':
                        value = left % right;
                    case '**=':
                        value = left ** right;
                    case '<<=':
                        value = left << right;
                    case '>>=':
                        value = left >> right;
                    case '>>>=':
                        value = left >>> right;
                    case '&=':
                        value = left & right;
                    case '^=':
                        value = left ^ right;
                    case '|=':
                        value = left | right;
                    case '&&=':
                    case '||=':
                    case '??=':
                        throw new NotImplementedException('&&=, ||=, ??= not implemented')
                }

                // @ts-expect-error - undefined when an error is thrown => typecheck error but impossible path
                return ctx.environment.assign(left, {
                    value: right,
                    isTainted: false
                })
            }
            if (t.isMemberExpression(node.left)) {
                throw NotImplementedException
            }

            }

        throw new NotImplementedException(`${node.type} cannot be handled`)
    }
}