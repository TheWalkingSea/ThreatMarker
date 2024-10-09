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
        node.declarations.forEach((declaration) => {
            return this.eval(declaration, ctx);
        })
        }

        if (t.isVariableDeclarator(node)) {
        let id = (this.eval(node.id) as TaintedLiteral).value;
        ctx.environment.declare(id);

        if (node.init) {
            let init = this.eval(node.init, ctx) as TaintedLiteral;
            ctx.environment.assign(id, init);
        }
        }

        if (t.isIdentifier(node)) {
        try {
            return ctx.environment.resolve(node.name);
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
        let value;
        node.expressions.forEach((expression) => {
            value = this.eval(expression, ctx) as TaintedLiteral; 
        })
        return value;
        }

        if (t.isUnaryExpression(node)) {
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
            let test = this.eval(node.test) as TaintedLiteral;
            
            if (test.isTainted) { // All subsequent nodes are tainted

                // Put if statement in it's own context
                this.callstack.push(new ExecutionContext(
                    ctx.thisValue,
                    new Environment()
                ))

                let block = test ? node.consequent : node.alternate
                if (block) {
                    this.eval(block, ctx);
                }

                // Any variables defined in the block that are defined in outer scope are tainted
                let isolatedEnv = (this.callstack.pop() as ExecutionContext).environment;
                let currentEnv = (this.callstack[this.callstack.length - 1] as ExecutionContext).environment;
                isolatedEnv.record.forEach((value: TaintedLiteral, key: string, _) => {
                    if (currentEnv.record.has(key)) {
                        // @ts-expect-error - We checked if the key is in the record above
                        currentEnv.record.get(key).assign({
                            isTainted: true
                        })
                    }
                    
                })





            } else { // Execute normally
                let block = test ? node.consequent : node.alternate
                if (block) {
                    this.eval(block, ctx);
                }
            }
        }





    }
}