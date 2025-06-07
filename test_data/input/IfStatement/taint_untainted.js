var a = 4;
var taint = document;

if (taint == 4) {
    var b = 5;
    b += 2;

    if (b == 7) {
        a = 6;
    }
}

a;
b;