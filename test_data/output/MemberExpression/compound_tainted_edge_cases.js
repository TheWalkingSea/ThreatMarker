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
[[0, tainted], 2, 3];

arr3[0][1] += 3;
[[0, tainted + 3], 2, 3]

arr3[0][0] = tainted1;
[[tainted1, tainted + 3], 2, 3];

arr3[1] = tainted2;
[[tainted1, tainted + 3], tainted2, 3];

arr3[0][tainted] = 3;
arr3;