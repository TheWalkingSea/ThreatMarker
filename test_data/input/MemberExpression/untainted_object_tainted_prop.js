// Test UNTAINTED[TAINTED] ?= * cases

// Case 1: UNTAINTED[TAINTED] = UNTAINTED
var arr = [1, 2, 3];
var tainted_idx = document;
arr[tainted_idx] = 10;
arr;

// Case 2: UNTAINTED[TAINTED] = TAINTED
var arr2 = [5, 6, 7];
arr2[tainted_idx] = document;
arr2;

// Case 3: UNTAINTED[TAINTED] += UNTAINTED (compound operator)
var arr3 = [10, 20, 30];
arr3[tainted_idx] += 5;
arr3;

// Case 4: UNTAINTED[TAINTED] += TAINTED (compound operator with tainted RHS)
var arr4 = [100, 200, 300];
arr4[tainted_idx] += document;
arr4;

// Case 5: Nested - arr[0][TAINTED] = value
var nested = [[1, 2], [3, 4]];
nested[0][tainted_idx] = 99;
nested;
nested[1][0];