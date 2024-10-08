import * as parser from '@babel/parser';
import * as t from '@babel/types';
import * as fs from 'node:fs';
import traverse from '@babel/traverse';
import generator from '@babel/generator';
import { pathHandler } from './lib/handler';
import { NodePath } from '@babel/traverse';


const d0 = new Date()

const INPUT: string = "./input/index.js"
const OUTPUT: string = './out/index.trace.js';


const data = fs.readFileSync(INPUT, 'utf8');

const ast = parser.parse(data);

traverse(ast, {
    enter(path: NodePath) {
        pathHandler(path);
    }
});

const output = generator(ast, {
    comments: false
});


let code = output.code

fs.writeFileSync(OUTPUT, '', { flag: 'w+' }); // Flush file

code = `
function writeToFile_xpao23(inp) {
    fs.writeFileSync('${OUTPUT}', inp.toString() + '\\n', { flag: 'a' });
};

${code}`

console.log(code);

eval(code);

// @ts-ignore
console.log(`Executed in ${Math.abs(new Date() - d0)}ms`)