var a = 2;
var b = 3;
var c = window;

var d = c == 2 ? 2 : (b = 4, 3);

b;
d;