var a = [5, 1, 2];
var tainted = document;

a[0] += tainted;
a;
