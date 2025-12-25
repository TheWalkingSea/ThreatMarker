var arr = [[10, 20], [30, 40]];

[10, 20];
[30, 40];

var tainted = document;
var simpleArr = [1, 2, 3, 4, 5];

simpleArr[tainted]++;

simpleArr;

var clean = [100, 200, 300];

if (document) {
  clean[0]++;
  ++clean[1];
}

clean[0];
clean[1];
300;
