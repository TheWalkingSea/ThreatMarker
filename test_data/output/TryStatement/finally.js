var b = 2;
var c = 3;

try {
    var a = 0;
} catch {
    b = 4;
    c = 6;
} finally {
    b = 6;
}

6;
c;