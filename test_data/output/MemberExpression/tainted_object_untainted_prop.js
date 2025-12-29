var tainted = document;
tainted[0] = 5;
tainted[0];

var arr = [document, [6, 7], 3];
arr[0][1] = 10;
document[1];

arr[1][1] = document;
document;

var obj = document;
obj["prop"] = "value";
obj.prop;
