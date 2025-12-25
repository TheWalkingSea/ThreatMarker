var arr = [10, 20, 30];
var tainted = document;

arr[0] += tainted;
arr[1] -= tainted;
arr[2] *= tainted;

arr[0];
arr[1];
arr[2];

var bits = [16, 32];
bits[0] <<= tainted;
bits[1] &= tainted;

bits[0];
bits[1];
