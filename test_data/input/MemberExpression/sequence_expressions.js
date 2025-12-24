var arr = [1, 2, 3];

var x = (arr[0], arr[1]);

var y = (arr[0] = 10, arr[0]);

arr;

var z = (arr[1]++, arr[2]++, arr[1]);

arr;

x;
y;
z;