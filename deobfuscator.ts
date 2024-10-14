import * as parser from '@babel/parser';
import * as t from '@babel/types';
import * as fs from 'node:fs';
import traverse from '@babel/traverse';
import generator from '@babel/generator';
import { TaintInterpreter } from './lib/TaintInterpreter';
import { ExecutionContext } from './lib/ExecutionContext';
import { Environment } from './lib/Environment';


const d0 = new Date()

const INPUT: string = "./input/index.js"
const OUTPUT: string = './out/index.trace.js';


const data = fs.readFileSync(INPUT, 'utf8');

const ast = parser.parse(data);


let globalCtx = new ExecutionContext(
    this,
    new Environment()
)
let ti = new TaintInterpreter(globalCtx)

ti.eval(ast.program)

console.log('converting to ast...')
// @ts-ignore
const output = generator(t.program(ti.ast), {
    comments: false
});

console.log(output.code);

// @ts-ignore
console.log(`Executed in ${Math.abs(new Date() - d0)}ms`)