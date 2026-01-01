// Return statements inside loops
function returnInWhile() {
  var i = 0;
  {
    {
      i++;
    }
    {
      i++;
    }
    {
      i++;
      {
        return 3;
      }
    }
  }
}

returnInWhile(), 3;

function returnInFor() {
  {
    var j = 0;
    {
      j++;
    }
    {
      j++;
    }
    {
      {
        return 20;
      }
    }
  }
}

returnInFor(), 20;

function noReturnInLoop() {
  var sum = 0;
  {
    var k = 0;
    {
      sum += 0;
      k++;
    }
    {
      sum += 1;
      k++;
    }
    {
      sum += 2;
      k++;
    }
  }
  return 3;
}

noReturnInLoop(), 3;
