var b = 2;
var c = 3;

try {
    var a = 0;
} catch {
    b = b + 2;
    c = 6;
} finally {
    b = 6;
}

b;
c;