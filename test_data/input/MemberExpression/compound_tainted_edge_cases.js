// Test edge cases for compound operators with tainted RHS

// Case 1: Tainted object
var tainted = document;
var taintedArr = document;
taintedArr[0] += tainted;
taintedArr;

// Case 2: Tainted property
var arr = [10, 20, 30];
arr[tainted] += 5;
arr;

// Case 3: Both tainted object and property
var taintedArr2 = document;
taintedArr2[tainted] += 10;
taintedArr2;

// Case 4: Nested RHS taint
var arr3 = [[0, 2], 2, 3];
arr3[0][1] = tainted;
arr3;

arr3[0][1] += 3;
arr3;

arr3[0][0] = tainted1;
arr3;

arr3[1] = tainted2;
arr3;

arr3[0][tainted] = 3;
arr3;