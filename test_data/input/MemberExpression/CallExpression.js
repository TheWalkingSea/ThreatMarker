function foo() {
    return 5;
}
function bar() {
    return document;
}
var myList = [1, 2, foo, bar, 5];

document[0]();
myList[document]();

myList[2]();
myList[3]();