var a = [5, 1, 2];
var tainted = document;

a[0] += tainted;
[5 + tainted, 1, 2];
