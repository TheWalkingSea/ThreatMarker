// Test all compound operators in tainted environments
var arr = [10, 20, 30, 40, 50];

if (document) {
    arr[0] += 5;    // Addition assignment
    arr[1] -= 3;    // Subtraction assignment
    arr[2] *= 2;    // Multiplication assignment
    arr[3] /= 4;    // Division assignment
    arr[4] %= 3;    // Modulus assignment
}

arr[0];  // Should be arr[0] (tainted)
arr[1];  // Should be arr[1] (tainted)
arr[2];  // Should be arr[2] (tainted)
arr[3];  // Should be arr[3] (tainted)
arr[4];  // Should be arr[4] (tainted)

var bits = [8, 16, 32];

if (document) {
    bits[0] <<= 1;   // Left shift assignment
    bits[1] >>= 2;   // Right shift assignment
    bits[2] >>>= 1;  // Unsigned right shift assignment
}

bits[0];  // Should be bits[0] (tainted)
bits[1];  // Should be bits[1] (tainted)
bits[2];  // Should be bits[2] (tainted)

var bitwise = [12, 25, 7];

if (document) {
    bitwise[0] &= 10;  // Bitwise AND assignment
    bitwise[1] ^= 3;   // Bitwise XOR assignment
    bitwise[2] |= 8;   // Bitwise OR assignment
}

bitwise[0];  // Should be bitwise[0] (tainted)
bitwise[1];  // Should be bitwise[1] (tainted)
bitwise[2];  // Should be bitwise[2] (tainted)

var exp = [2, 3];

if (document) {
    exp[0] **= 3;  // Exponentiation assignment
}

exp[0];  // Should be exp[0] (tainted)
exp[1];  // Should be 3 (untainted)
