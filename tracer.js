import * as parser from '@babel/parser';
import * as t from '@babel/types';
import fs from 'node:fs';
import { exec } from 'child_process';

import _traverse from '@babel/traverse';
const traverse = _traverse.default

import _generator from '@babel/generator';
const generator = _generator.default


const d0 = new Date()


const data = fs.readFileSync('./input/index.js', 'utf8');
const OUTPUT = './out/index.trace.js';

const ast = parser.parse(data);

traverse(ast, {
    enter(path) {
        if (path.node.loc && path.isStatement() && !path.isFunctionDeclaration()) {
            let code = generator(path.node, {
                comments: false
            }).code

            const consoleLog = t.expressionStatement(
                t.callExpression(
                    t.memberExpression(t.identifier('console'), t.identifier('log')),
                    [t.stringLiteral(code)]
                )
            );

            if (code.startsWith('console.log')) {
                path.replaceWith(consoleLog); // If it is console.log, remove the instruction and replace w/ the logging
            } else {
                path.insertAfter(consoleLog); // Append logging after instruction
            }
        }
    }
});

const output = generator(ast, {
    comments: false
});
let code = output.code

fs.writeFileSync(OUTPUT, '', { flag: 'w+' }); // Empty file

code = `
console.log = (inp) => {
    fs.writeFileSync('${OUTPUT}', inp.toString() + '\\n', { flag: 'a' });
};

${code}`

const log = console.log // eval overrides this function

eval(code);


log(`Executed in ${Math.abs(new Date() - d0)}ms`)