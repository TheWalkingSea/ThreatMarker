import { ExecutionContext } from "./ExecutionContext";
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

            // @ts-ignore
            // Implemented most common literals
            return node.value;
          }

          if (t.isVariableDeclaration(node)) {
            node.declarations.forEach((declaration) => {
                return this.eval(declaration, ctx);
            })
          }

          if (t.isVariableDeclarator(node)) {
            let id = this.eval(node.id);
            if (node.init) {
                let init = this.eval(node.init, ctx);
                ctx.environment.assign(id, init);
            } else {
                ctx.environment.declare(id);
            }
          }

          if (t.isIdentifier(node)) {
            return ctx.environment.resolve(node.name);
          }






    }
}