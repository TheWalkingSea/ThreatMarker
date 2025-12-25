var nullObj = null;
var undefObj = undefined;

undefined;
undefined;

var arr = [[1, 2], null, [5, 6]];

1;
undefined;
6;

var tainted = document;

tainted?.[0];
arr?.[tainted];

var mixed = [document, 5];

document;
5;
undefined;

var deep = [[[10]]];
10;

var partial = [[null]];
undefined;
