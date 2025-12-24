var arr = [10, 20, 30];
var tainted = document;

var x = true ? arr[0] : arr[1];

var y = false ? arr[0] : arr[1];

var z = tainted ? arr[0] : arr[1];

var w = arr[0] > 15 ? arr[1] : arr[2];
