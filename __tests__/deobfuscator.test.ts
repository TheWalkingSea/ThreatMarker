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
        
        ti.eval(input_ast.program, globalCtx);
        
        console.log('converting to ast...');

        const CONFIG = {
            comments: false
        }

        // @ts-ignore - Array<t.Node> can be comprehended by program but still throws a type-check err
        const deobfuscated = generator(t.program(ti.ast), CONFIG).code
        console.log(`Deobfuscated program:\n${deobfuscated}`)

        expect(
            deobfuscated
        ).toEqual(
            generator(output_ast, CONFIG).code
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
test('LogicalExpression', test_ast('logical_exp'));
test('AssignmentExpression', test_ast('assignment_exp'))
test('EmptyExpression', test_ast('empty_exp'))
test('BlockStatement', test_ast('block_stmt'))
test('Nullish Coalescing', test_ast('nullish_coalescing'))
describe("IfStatement", () => {
    test('Untainted Condition (true) - IfStatement Replacement', test_ast('IfStatement/untaint_true'));
    test('Untainted Condition (false)', test_ast('IfStatement/untaint_false'));
    test('Tainted Condition => Taint else if Block', test_ast('IfStatement/taint_elif'));
    test('Tainted Condition - Global Block Simplification', test_ast('IfStatement/taint_ext'));
    test('Tainted Condition - Block Simplification', test_ast('IfStatement/taint_int'));
    test('Nested Taint Condition', test_ast('IfStatement/nested_taint'));
    test('Taint -> Untainted Nested Conditional', test_ast('IfStatement/taint_untainted'));
    test('Tainted -> Untainted Nested Conditional II', test_ast('IfStatement/taint_untainted_ii'));
});
describe("ConditionalExpression", () => {
    test('Tainted Test', test_ast('ConditionalExpression/tainted'));
    test('Tainted Condition - External Write', test_ast('ConditionalExpression/tainted_ext_write'));
    test('Untainted Condition (false)', test_ast('ConditionalExpression/untaint_false'));
    test('Untainted Condition (true)', test_ast('ConditionalExpression/untaint_true'));
    test('Nested Ternary', test_ast('ConditionalExpression/nested'));
});
describe("WhileLoop", () => {
    test('Untainted Condition', test_ast('WhileLoop/untaint'));
    test('Tainted Condition - External Write', test_ast('WhileLoop/taint_ext_write'));
    test('Tainted Condition - External Write 2', test_ast('WhileLoop/taint_ext_write_2'));
    test('Tainted Condition - External Read', test_ast('WhileLoop/taint_ext_read'));
    test('Tainted Condition - Block Simplification', test_ast('WhileLoop/taint_int'));
});
describe("FunctionDeclaration", () => {
    test('Declaration', test_ast('FunctionDeclaration/FunctionDeclaration'));
    test('Inner Scope Var Simplification', test_ast('FunctionDeclaration/inner_scope'));
    test('Outer Scope Var Simplification', test_ast('FunctionDeclaration/outer_scope'));
    test('Parameter Simplification', test_ast('FunctionDeclaration/parameters_taint'));
    test('Isolate Outer Variables', test_ast('FunctionDeclaration/isolation'));
});
describe("CallExpression", () => {
    test('CallExpression', test_ast('CallExpression/CallExpression'));
    test('Tainted Return Value', test_ast('CallExpression/tainted'));
    test('Untainted Return Value', test_ast('CallExpression/untainted'));
    test('External Write', test_ast('CallExpression/ext_write'));
    test('External Read', test_ast('CallExpression/ext_read'));
    test('Parameters', test_ast('CallExpression/parameters'));
});
test('UnaryExpression', test_ast('unary_exp'));
test('UpdateExpression', test_ast('update_exp'));
describe("TryStatement", () => {
    test('Untainted', test_ast('TryStatement/untainted'));
    test('Untainted - Remove redundant code', test_ast('TryStatement/untainted_2'));
    test('Tainted', test_ast('TryStatement/tainted'));
    test('Finally', test_ast('TryStatement/finally'));
});
describe("BreakStatement", () => {
    test('Std Untainted', test_ast('BreakStatement/untainted'));
    test('Labeled Untainted', test_ast('BreakStatement/untainted_label'));
    test('Std Tainted 1', test_ast('BreakStatement/tainted'));
    test('Std Tainted 2', test_ast('BreakStatement/tainted_2'));
    test('Std Tainted 3', test_ast('BreakStatement/tainted_3'));
    test('Redundant Code', test_ast('BreakStatement/tainted_4'));
    test('Nested WhileStatement', test_ast('BreakStatement/tainted_5'));
    test('Std Tainted 6', test_ast('BreakStatement/tainted_6'));
    test('Tainted', test_ast('BreakStatement/tainted_test'));
    test('Labeled Tainted', test_ast('BreakStatement/tainted_test'));
});
describe("ArrayExpression", () => {
    test('Array Initialization', test_ast('ArrayExpression/init'));
});
describe("Member Expression", () => {
    test('AssignmentExpression', test_ast('MemberExpression/AssignmentExpression'));
    test('CallExpression', test_ast('MemberExpression/CallExpression'));
    test('BinaryExpression', test_ast('MemberExpression/BinaryExpression'));
    test('LogicalExpression', test_ast('MemberExpression/LogicalExpression'));
    test('Testing list writes', test_ast('MemberExpression/list_write_untainted'));
    test('Tainted Tainted Array', test_ast('MemberExpression/tainted_tainted'));
    test('Tainted Untainted Array', test_ast('MemberExpression/tainted_untainted'));
    test('Untainted Tainted Array', test_ast('MemberExpression/untainted_tainted'));
    test('Untainted Untainted Array', test_ast('MemberExpression/untainted_untainted'));
    test('Chaining', test_ast('MemberExpression/chaining'));
    test('Optional Chaining', test_ast('MemberExpression/optional_chaining'));
});
describe("ObjectExpression", () => {
    test('Initialization Property Definition', test_ast('ObjectExpression/init_property'));
    test('Initialization Method Definition', test_ast('ObjectExpression/init_method'));
    test('Initialization Spread Operator', test_ast('ObjectExpression/init_spread'));
});