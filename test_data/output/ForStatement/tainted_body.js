var result = 0;
var tainted;
for (var i = 0; i < 5; i++) {
  result += i;
  if (i > 2) {
    i = tainted;
  }
}
result;
tainted;
