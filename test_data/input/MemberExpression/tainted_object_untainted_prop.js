// Test TAINTED[UNTAINTED] = UNTAINTED cases

// Case 1: Simple tainted object with untainted property and untainted value
var tainted = document;
tainted[0] = 5;
tainted[0];

// Case 2: Nested - tainted object with nested untainted property
var arr = [document, [6, 7], 3];
arr[0][1] = 10;
arr[0][1];

arr[1][1] = document;
arr[1][1];

// Case 3: Tainted object with string property
var obj = document;
obj["prop"] = "value";
obj["prop"];
