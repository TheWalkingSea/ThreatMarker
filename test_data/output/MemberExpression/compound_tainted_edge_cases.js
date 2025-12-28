var tainted = document;
var taintedArr = document;
taintedArr[0] += tainted;
taintedArr;

var arr = [10, 20, 30];
arr[tainted] += 5;
arr;

var taintedArr2 = document;
taintedArr2[tainted] += 10;
taintedArr2;

var arr3 = [[0, 2], 2, 3];
arr3[0][1] = tainted;
[[0, tainted], 2, 3]