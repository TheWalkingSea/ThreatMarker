var arr = [10, 20, 30];

arr[0]++;
[11, 20, 30];

++arr[1];
[11, 21, 30];

arr[2]--;
[11, 21, 29];

--arr[0];
[10, 21, 29];

var tainted = document;
var taintedArr = [1, 2, 3];

taintedArr[tainted]++;
taintedArr;
