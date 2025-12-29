var arr = [1, 2, 3];
var tainted_idx = document;
arr[tainted_idx] = 10;
arr;

var arr2 = [5, 6, 7];
arr2[tainted_idx] = document;
arr2;

var arr3 = [10, 20, 30];
arr3[tainted_idx] += 5;
arr3;

var arr4 = [100, 200, 300];
arr4[tainted_idx] += document;
arr4;

var nested = [[1, 2], [3, 4]];
nested[0][tainted_idx] = 99;
nested;
3;