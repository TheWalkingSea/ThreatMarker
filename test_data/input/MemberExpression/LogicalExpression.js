var myList = [true, 2, document, 4, 5];

myList[2] || 1;
myList[1] || document;

myList[0] && false;
myList[0] && true;