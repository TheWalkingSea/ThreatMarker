var nested = [[1, 2], [3, 4]];
var arr = [nested, 5, 6];

arr?.[0]?.[1];

arr?.[3];

arr?.[3]?.[0];

var nullVar = null;
var undefVar;

nullVar?.[0];

undefVar?.[0];