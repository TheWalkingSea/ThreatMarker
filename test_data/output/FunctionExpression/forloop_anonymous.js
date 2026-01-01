var numbers = [1, 2, 3];
var doubled = [0, 0, 0];
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
