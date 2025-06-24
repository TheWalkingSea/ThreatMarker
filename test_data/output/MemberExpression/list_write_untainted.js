var myList = [1, 2, 3, 4, 5];
var tainted_list = document;

myList[2] = 6;

[1, 2, 6, 4, 5];


tainted_list[2] = 6;

tainted_list;
