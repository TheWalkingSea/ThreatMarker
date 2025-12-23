var arr = [10, 20, 30, 40, 50];
var x = 1;
var y = 2;

arr[x];

arr[x + 1];

arr[x + y];

var tainted = document;
arr[tainted];

arr[tainted + 1];

arr[1 + 1];
