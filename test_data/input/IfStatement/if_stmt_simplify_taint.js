var a = 4;
var taint = document;

if (taint == 4) {
    var b = 5;
    b += 2;

    b;
}

a;
b;