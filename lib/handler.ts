import * as t from '@babel/types';
import generator from '@babel/generator'
import { NodePath } from '@babel/traverse';

export function pathHandler(path: NodePath) {
    let node: t.Node = path.node
    if (node.loc && path.isStatement() && !path.isFunctionDeclaration() && !path.isBlockStatement()) {
        let code = generator(path.node, {
            comments: false
        }).code

        const consoleLog = t.expressionStatement(
            t.callExpression(
                t.identifier('writeToFile_xpao23'), // Random identifier
                [t.stringLiteral(code)]
            )
        );

        if (code.startsWith('console.log')) { // Fix later to filter ALL console calls
            path.replaceWith(consoleLog); // If it is console.log, remove the instruction and replace w/ the logging
        } else {
            path.insertBefore(consoleLog); // Append logging after instruction
        }
    }
}