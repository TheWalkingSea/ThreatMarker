var a = 3;
var b = 4;
var taint = document;

if (taint == 4) {
    a = 2;
} else {
    var c = 4;
}

a;
4;
c;