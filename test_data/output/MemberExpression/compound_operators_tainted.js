var arr = [10, 20, 30, 40, 50];

if (document) {
  arr[0] += 5;
  arr[1] -= 3;
  arr[2] *= 2;
  arr[3] /= 4;
  arr[4] %= 3;
}

arr[0];
arr[1];
arr[2];
arr[3];
arr[4];

var bits = [8, 16, 32];

if (document) {
  bits[0] <<= 1;
  bits[1] >>= 2;
  bits[2] >>>= 1;
}

bits[0];
bits[1];
bits[2];

var bitwise = [12, 25, 7];

if (document) {
  bitwise[0] &= 10;
  bitwise[1] ^= 3;
  bitwise[2] |= 8;
}

bitwise[0];
bitwise[1];
bitwise[2];

var exp = [2, 3];

if (document) {
  exp[0] **= 3;
}

exp[0];
3;
