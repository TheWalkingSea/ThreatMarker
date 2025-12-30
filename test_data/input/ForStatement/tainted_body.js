// For loop where body writes tainted variable
var result = 0;
var tainted = document;
for (var i = 0; i < 5; i++) {
    result += i;
    if (i > 2) {
        i = tainted;
    }
}
result;
tainted;
