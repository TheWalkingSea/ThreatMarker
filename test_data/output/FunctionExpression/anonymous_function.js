var result1 = ((function() {
    return 42;
})(), 42);

42;

var result2 = ((function(a, b) {
    return a + b;
})(3, 5), 8);
8;

var add = function (x, y) {
  return x + y;
};

(add(10, 20), 30);

var numbers = [1, 2, 3];
var doubled = [];
{
  var i = 0;
  {
    doubled[0] = ((function(n) {
        return n * 2;
    })(1),2);
    i++;
  }
  {
    doubled[1] = ((function(n) {
        return n * 2;
    })(2), 4);
    i++;
  }
  {
    doubled[2] = ((function(n) {
        return n * 2;
    })(3), 6);
    i++;
  }
}

2;
4;
6;

var outer = ((function() {
    var inner = function() {
        return 99;
    };
    return inner();
})(), 99);

99;
