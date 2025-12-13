# ThreatMarker

## Project Overview

ThreatMarker is a JavaScript deobfuscator that uses taint analysis to simplify obfuscated JavaScript code. It parses JavaScript ASTs using Babel, evaluates code through an interpreter, and tracks "taint" (whether values can be statically determined) to output simplified, deobfuscated JavaScript.

## Common Commands

### Testing
```bash
npm test                    # Run all tests
npm test -- <test-name>     # Run specific test (e.g., npm test -- IfStatement)
```

### Running the Deobfuscator
```bash
npm run trace               # Runs deobfuscator on ./input/index.js using tsx
```

### Development
- TypeScript files are compiled on-the-fly with `tsx` (for running) or `ts-jest` (for testing)
- No build step required for development

## Architecture

### Core Concepts

**Taint Analysis**: The fundamental concept driving this deobfuscator. Values are either:
- **Untainted**: Can be statically determined at analysis time (e.g., `const x = 5 + 3` resolves to `8`)
- **Tainted**: Cannot be statically determined (e.g., references to browser globals, dynamic values)

**TaintedLiteral**: The central data structure (defined in `d.ts:4-8`) that wraps all values:
```typescript
interface TaintedLiteral {
    value?: any,        // The actual JavaScript value (for untainted data)
    node?: Expression,  // The AST node representation (for tainted data)
    isTainted: Boolean
}
```

### Main Components

**TaintInterpreter** (`lib/TaintInterpreter.ts`): The heart of the deobfuscator. Recursively evaluates AST nodes and builds a simplified output AST. Key methods:
- `eval()`: Main recursive evaluator for all AST node types
- `append_ast()`: Adds nodes to output AST (or returns them if `return_stmt_flag` is set)
- `simplify_ambiguous_flow()`: Handles control flow that may or may not execute (if/while with tainted conditions)
- `get_stmt_wrapper()`: Temporarily sets `return_stmt_flag` to return statements instead of appending them

**Environment** (`lib/Environment.ts`): Variable scope management using a parent-linked chain. Key features:
- `record`: Map of variable names to TaintedLiterals
- `parent`: Parent environment for scope chain
- `taint_parent_writes`: When true, writes to parent scopes are auto-tainted (used for ambiguous control flow)
- `taint_parent_reads`: When true, reads from parent scopes are auto-tainted (used for function isolation)
- `ignore_reference_exception`: When true, undefined variables are declared as tainted (used for function isolation)

**ExecutionContext** (`lib/ExecutionContext.ts`): Pairs an Environment with metadata about the current execution context:
- `environment`: The Environment for this scope
- `type`: Node type creating this context (e.g., "IfStatement", "WhileStatement", "FunctionDeclaration")
- `name`: Optional label (used for LabeledStatements and break statements)

### Control Flow Handling

**Untainted Conditions**: When a condition can be statically determined:
- Only the executed branch is added to the output AST
- The other branch is completely removed

**Tainted Conditions**: When a condition cannot be statically determined:
- Both branches are executed in isolated environments with `taint_parent_writes = true`
- Variables written in either branch are automatically tainted in the parent scope
- Both branches appear in the output AST with the tainted condition

**Function Handling**: Functions are processed twice:
1. **Declaration Phase**: Function body is simplified in isolation (`taint_parent_reads = true`) to generate the output AST
2. **Execution Phase**: A "runner" function is created that can be called during evaluation, executing the original AST in a new context

### Key Implementation Details

**Return Statement Flag** (`return_stmt_flag`): Controls whether `append_ast()` adds to the AST or returns the node. This is critical for:
- Building BlockStatements (need to collect statements to wrap in block)
- Processing ambiguous control flow (need to return simplified blocks)
- Function isolation (need to return simplified body)

**Callstack Management**: The interpreter maintains a callstack of ExecutionContexts. When certain statements execute (return, break), they pop contexts off the callstack to escape their scope.

**Break Statements**: Break handling searches up the callstack to find the target loop/label, then:
- **Untainted environment**: Pops contexts and returns (actually breaks execution)
- **Tainted environment**: Pops contexts, sets `taint_parent_writes = true` on the target, and adds a break statement to the AST

## Test Structure

Tests are located in `__tests__/deobfuscator.test.ts` and use a comparison approach:
- Input files: `test_data/input/<category>/<test>.js`
- Expected output files: `test_data/output/<category>/<test>.js`
- The test helper `test_ast()` runs the deobfuscator and compares generated code to expected output

When adding tests, create both input and output files with matching names.

## Common Patterns

**Adding Support for New AST Node Types**:
1. Add a type check in `TaintInterpreter.eval()` (e.g., `if (t.isFooExpression(node))`)
2. Evaluate child nodes recursively
3. If any child is tainted, return a tainted TaintedLiteral with a new AST node
4. If all children are untainted, compute the result and return an untainted TaintedLiteral
5. Call `append_ast()` for statements, or return for expressions

**Example Pattern for Binary Operations**:
```typescript
// Evaluate both sides
let left = this.eval(node.left, ctx) as TaintedLiteral;
let right = this.eval(node.right, ctx) as TaintedLiteral;

// If either is tainted, return tainted AST node
if (left.isTainted || right.isTainted) {
    return {
        node: t.binaryExpression(node.operator, get_repr(left), get_repr(right)),
        isTainted: true
    }
}

// Otherwise compute and return untainted value
return {
    value: left.value + right.value,  // or whatever operation
    isTainted: false
}
```

## Important Assumptions

- Variables are declared with `var` (function scope), not `let`/`const` (block scope)
- No support for generators, async functions, or rest/spread parameters in function declarations
- Array/object members accessed with tainted indices are considered tainted even if the array/object itself is untainted
