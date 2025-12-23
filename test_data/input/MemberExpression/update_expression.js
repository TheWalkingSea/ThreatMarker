var arr = [10, 20, 30];

arr[0]++;
arr;

++arr[1];
arr;

arr[2]--;
arr;

--arr[0];
arr;

var tainted = document;
var taintedArr = [1, 2, 3];

taintedArr[tainted]++;
taintedArr;
