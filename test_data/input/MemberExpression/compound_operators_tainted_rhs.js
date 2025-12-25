// Test compound operators with tainted right-hand side
var arr = [10, 20, 30];
var tainted = document;

arr[0] += tainted;   // Tainted RHS with +=
arr[1] -= tainted;   // Tainted RHS with -=
arr[2] *= tainted;   // Tainted RHS with *=

arr[0];  // Should be tainted
arr[1];  // Should be tainted
arr[2];  // Should be tainted

var bits = [16, 32];
bits[0] <<= tainted;  // Tainted RHS with <<=
bits[1] &= tainted;   // Tainted RHS with &=

bits[0];  // Should be tainted
bits[1];  // Should be tainted
