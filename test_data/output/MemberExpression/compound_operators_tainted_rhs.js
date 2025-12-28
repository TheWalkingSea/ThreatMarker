var arr = [10, 20, 30];
var tainted = document;

arr[0] += tainted;
arr[1] -= tainted;
arr[2] *= tainted;

10 + tainted;
20 - tainted;
30 * tainted;

var bits = [16, 32];
bits[0] <<= tainted;
bits[1] &= tainted;

16 << tainted;
32 & tainted;
