var arr = [5, 10, 15];

{
  arr[1] = 100;
}

[5, 100, 15];

var counter = 0;
{
  {
    arr[0]++;
    counter++;
  }
  {
    arr[1]++;
    counter++;
  }
}

[6, 101, 15];

if (document) {
  var temp = 15;
}

temp;
