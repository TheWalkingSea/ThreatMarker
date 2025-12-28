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
