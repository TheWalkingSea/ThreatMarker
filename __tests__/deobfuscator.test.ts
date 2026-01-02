import { readFileSync } from 'fs';
import * as parser from '@babel/parser';
import { TaintInterpreter } from '../lib/TaintInterpreter';
import { ExecutionContext } from '../lib/ExecutionContext';
import { Environment } from '../lib/Environment';
import * as t from '@babel/types';
import generator from '@babel/generator';

jest.setTimeout(10000);

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
describe("WhileStatement", () => {
    test('Untainted Condition', test_ast('WhileStatement/untaint'));
    test('Tainted Condition - External Write', test_ast('WhileStatement/taint_ext_write'));
    test('Tainted Condition - External Write 2', test_ast('WhileStatement/taint_ext_write_2'));
    test('Tainted Condition - External Read', test_ast('WhileStatement/taint_ext_read'));
    test('Tainted Condition - Block Simplification', test_ast('WhileStatement/taint_int'));
    test('False Loop', test_ast('WhileStatement/false_loop'));
});
describe("DoWhileStatement", () => {
    test('Untainted Condition', test_ast('DoWhileStatement/untaint'));
    test('Untained Condition - Do once', test_ast('DoWhileStatement/do_once'));
    test('Tainted Condition - External Write', test_ast('DoWhileStatement/taint_ext_write'));
    test('Tainted Condition - External Write 2', test_ast('DoWhileStatement/taint_ext_write_2'));
    test('Tainted Condition - External Read', test_ast('DoWhileStatement/taint_ext_read'));
    test('Tainted Condition - Block Simplification', test_ast('DoWhileStatement/taint_int'));
});
describe("ForStatement", () => {
    test('Basic Untainted', test_ast('ForStatement/basic_untainted'));
    test('Tainted Condition', test_ast('ForStatement/tainted_condition'));
    test('Tainted Body', test_ast('ForStatement/tainted_body'));
    test('Increment in Body', test_ast('ForStatement/inc_body'));
    test('No Init', test_ast('ForStatement/no_init'));
    test('No Update', test_ast('ForStatement/no_update'));
    test('Expression Init', test_ast('ForStatement/expression_init'));
    test('Tainted Update', test_ast('ForStatement/tainted_update'));
    test('Empty Body', test_ast('ForStatement/empty_body'));
    test('Nested', test_ast('ForStatement/nested'));
    test('Untainted', test_ast('ForStatement/untaint'));
    test('Tainted - External Read', test_ast('ForStatement/taint_ext_read'));
    test('Tainted - External Write', test_ast('ForStatement/taint_ext_write'));
    test('Tainted - External Write 2', test_ast('ForStatement/taint_ext_write_2'));
    test('Tainted - Block Simplification', test_ast('ForStatement/taint_int'));
});
describe("FunctionDeclaration", () => {
    test('Declaration', test_ast('FunctionDeclaration/FunctionDeclaration'));
    test('Inner Scope Var Simplification', test_ast('FunctionDeclaration/inner_scope'));
    test('Outer Scope Var Simplification', test_ast('FunctionDeclaration/outer_scope'));
    test('Parameter Simplification', test_ast('FunctionDeclaration/parameters_taint'));
    test('Isolate Outer Variables', test_ast('FunctionDeclaration/isolation'));
});
describe("FunctionExpression", () => {
    test('Anonymous Functions', test_ast('FunctionExpression/anonymous_function'));
    test('For Loop -> Anonymous Functions', test_ast('FunctionExpression/forloop_anonymous'));
});
describe("CallExpression", () => {
    test('CallExpression', test_ast('CallExpression/CallExpression'));
    test('Tainted Return Value', test_ast('CallExpression/tainted'));
    test('Untainted Return Value', test_ast('CallExpression/untainted'));
    test('External Write', test_ast('CallExpression/ext_write'));
    test('External Read', test_ast('CallExpression/ext_read'));
    test('Parameters', test_ast('CallExpression/parameters'));
    test('Nested Function', test_ast('CallExpression/nested'))
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
    test('Computed Expressions', test_ast('MemberExpression/computed_expressions'));
    test('Update Expression', test_ast('MemberExpression/update_expression'));
    test('Update Expression Tainted Environment', test_ast('MemberExpression/update_tainted_env'));
    test('Ternary Operator', test_ast('MemberExpression/ternary_operator'));
    test('Control Flow', test_ast('MemberExpression/control_flow'));
    test('Unary Operators', test_ast('MemberExpression/unary_operators'));
    test('Sequence Expressions', test_ast('MemberExpression/sequence_expressions'));
    test('Nested Taint', test_ast('MemberExpression/nested_taint'));
    test('Optional Chaining', test_ast('MemberExpression/optional_chaining'));
    test('Compound Operators in Tainted Environment', test_ast('MemberExpression/compound_operators_tainted'));
    test('Compound Operators with Tainted RHS', test_ast('MemberExpression/compound_operators_tainted_rhs'));
    test('Nested Update Expression', test_ast('MemberExpression/nested_update_expression'));
    test('Undefined Properties', test_ast('MemberExpression/undefined_properties'));
    test('Optional Chaining Advanced', test_ast('MemberExpression/optional_chaining_advanced'));
    test('Test Compound Tainted Value', test_ast('MemberExpression/test_compound_tainted_value'));
    test('Compound Tainted Edge Cases', test_ast('MemberExpression/compound_tainted_edge_cases'));
    test('Tainted Object Untainted Property', test_ast('MemberExpression/tainted_object_untainted_prop'));
    test('Untainted Object Tainted Property', test_ast('MemberExpression/untainted_object_tainted_prop'));
});
describe("ObjectExpression", () => {
    test('Initialization Property Definition', test_ast('ObjectExpression/init_property'));
    test('Initialization Method Definition', test_ast('ObjectExpression/init_method'));
    test('Initialization Spread Operator', test_ast('ObjectExpression/init_spread'));
    test('Non-Computed Access', test_ast('ObjectExpression/non_computed_access'));
});
describe("ReturnStatement", () => {
    test('Tainted Environment Test', test_ast('ReturnStatement/taint_env'));
    test('Tainted Environment Nested Test', test_ast('ReturnStatement/taint_env_nested'));
    test('Untainted Basic', test_ast('ReturnStatement/untainted_basic'));
    test('Early Return', test_ast('ReturnStatement/early_return'));
    test('Loop Return', test_ast('ReturnStatement/loop_return'));
    test('Tainted Return Value', test_ast('ReturnStatement/tainted_return_value'));
    test('Tainted Loop Return', test_ast('ReturnStatement/tainted_loop_return'));
    test('Nested Functions', test_ast('ReturnStatement/nested_functions'));
    test('Return Undefined', test_ast('ReturnStatement/return_undefined'));
});
describe("ContinueStatement", () => {
    test('Std Untainted', test_ast('ContinueStatement/untainted'));
    test('Labeled Untainted', test_ast('ContinueStatement/untainted_label'));
    test('Std Tainted 1', test_ast('ContinueStatement/tainted'));
    test('Std Tainted 2', test_ast('ContinueStatement/tainted_2'));
    test('Std Tainted 3', test_ast('ContinueStatement/tainted_3'));
    test('Redundant Code', test_ast('ContinueStatement/tainted_4'));
    test('Nested WhileStatement', test_ast('ContinueStatement/tainted_5'));
    test('Std Tainted 6', test_ast('ContinueStatement/tainted_6'));
    test('Tainted', test_ast('ContinueStatement/tainted_test'));
    test('Labeled Tainted', test_ast('ContinueStatement/tainted_test'));
});