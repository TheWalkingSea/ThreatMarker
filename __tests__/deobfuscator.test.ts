import { readFileSync } from 'fs';
import * as parser from '@babel/parser';
import { TaintInterpreter } from '../lib/TaintInterpreter';
import { ExecutionContext } from '../lib/ExecutionContext';
import { Environment } from '../lib/Environment';
import * as t from '@babel/types';
import generator from '@babel/generator';

// Don't use comments in input/output files
function test_ast(file: string): jest.ProvidesCallback {
    return () => {
        const input = readFileSync(`./test_data/input/${file}.js`, 'utf-8');
        const output = readFileSync(`./test_data/output/${file}.js`, 'utf-8');

        const d0 = new Date();
        
        const input_ast = parser.parse(input);
        const output_ast = parser.parse(output);
        
        
        let globalCtx = new ExecutionContext(
            // @ts-ignore - Doesn't really matter what this is
            this,
            new Environment()
        );

        let ti = new TaintInterpreter(globalCtx);
        
        ti.eval(input_ast.program);
        
        console.log('converting to ast...');

        const CONFIG = {
            comments: false
        }

        expect(
            // @ts-ignore - Array<t.Node> can be comprehended by program but still throws a type-check err
            generator(t.program(ti.ast), CONFIG)
        ).toEqual(
            generator(output_ast, CONFIG)
        );
        
        // @ts-ignore
        console.log(`Executed in ${Math.abs(new Date() - d0)}ms`);
    }
}


test('VariableDeclaration, VariableDeclarator', test_ast('variable_declaration'))
test('Identifier', test_ast('identifier'))
test('Sequence Expression', test_ast('sequence_exp'))
test('Literals', test_ast('literal'))
test('BinaryExpression', test_ast('binary_exp'))
test('AssignmentExpression', test_ast('assignment_exp'))