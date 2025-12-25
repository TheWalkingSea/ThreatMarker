// Advanced optional chaining test cases with arrays
var nullObj = null;
var undefObj = undefined;

// Basic optional chaining with null and undefined
nullObj?.[0];        // null?.[0] should be undefined
undefObj?.[0];       // undefined?.[0] should be undefined

// Optional chaining with nested arrays
var arr = [[1, 2], null, [5, 6]];

arr?.[0]?.[0];    // Should be 1
arr?.[1]?.[0];    // Should be undefined (arr[1] is null)
arr?.[2]?.[1];    // Should be 6

// With tainted values
var tainted = document;

tainted?.[0];     // Should be tainted
arr?.[tainted];    // Should be tainted

// Mixed tainted and untainted
var mixed = [document, 5];

mixed?.[0];          // Should be document (tainted)
mixed?.[1];          // Should be 5 (untainted)
mixed?.[2];          // Should be undefined

// Deeply nested
var deep = [[[10]]];
deep?.[0]?.[0]?.[0];  // Should be 10

// Null in middle of chain
var partial = [[null]];
partial?.[0]?.[0]?.[0];  // Should be undefined (middle is null)
