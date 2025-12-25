// Test accessing undefined/out of bounds properties
var arr = [1, 2, 3];

arr[5];  // Out of bounds - should be undefined
arr[100];  // Way out of bounds - should be undefined

// Accessing undefined on nested arrays
var nested = [[1, 2], [3, 4]];

nested[0][5];  // Nested out of bounds - should be undefined
nested[5];     // Outer out of bounds - should be undefined

// With tainted indices
var tainted = document;

arr[tainted];  // Tainted access - should return tainted node
