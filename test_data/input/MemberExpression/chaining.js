var nested = [100, 200, 300];
var arr = [nested, 2, 3];

arr[0][1];

var deepNested = [[1, 2], [3, 4]];
deepNested[1][0];

var taintedNested = [document, [5, 6]];
taintedNested[0][1];

taintedNested[1][0];
