var myList = [1, document, document, 4, 5];

myList[0] = document;
[document, document, document, 4, 5];

myList[0] = document;
[document, document, document, 4, 5];

myList[document] = 3;
[document, document, document, 4, 5];


myList[1] = 2;
[document, 2, document, 4, 5];


myList[2] += 3;
[document, 2, document, 4, 5];

myList[document] += 6;
[document, 2, document, 4, 5];

document[2] += 2;


myList[3] += 2;
[document, 2, document, 6, 5];