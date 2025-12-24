var clean = [[1, 2], [3, 4]];
var mixed = [[5, 6], [document, 8]];

clean[0][0];

clean[1][1];

mixed[0][1];

mixed[1][0];

mixed[1][1];

if (document) {
    clean[0][1] = 99;
}

clean[0][0];

clean[0][1];

clean[1][0];
