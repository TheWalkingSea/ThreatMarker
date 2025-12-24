var arr = [0, 1, 5];

var a = !arr[0];

var b = !arr[1];

var c = -arr[2];

var d = +arr[1];


var taintedArr = [document, 10];

var e = !taintedArr[0];

var f = !taintedArr[1];
