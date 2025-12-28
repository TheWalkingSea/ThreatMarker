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
