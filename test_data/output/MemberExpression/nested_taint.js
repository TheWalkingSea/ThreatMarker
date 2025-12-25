var clean = [[1, 2], [3, 4]];
var mixed = [[5, 6], [document, 8]];

1;

4;

6;

document;

8;

if (document) {
  clean[0][1] = 99;
  clean[1][0] += 1;
}

1;

clean[0][1];
clean[1][0];

4;