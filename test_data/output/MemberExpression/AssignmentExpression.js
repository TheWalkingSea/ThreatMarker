var myList = [1, document, document, 4, 5];

myList[0] = document;
[document, document, document, 4, 5];

myList[0] = document;
[document, document, document, 4, 5];

myList[document] = 3;
myList;

var myListII = [1, document, document, 4, 5];

myListII[1] = 2;
[1, 2, document, 4, 5];


myListII[2] += 3;
[1, 2, document, 4, 5];

document[2] += 2;

myListII[3] += 2;
[1, 2, document, 6, 5];