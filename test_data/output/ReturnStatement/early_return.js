// Early return - code after return should not execute
function earlyReturn() {
  var x = 1;
  x += 2;
  return 3;
}

earlyReturn(), 3;

function multipleReturns(flag) {
  var result = 0;

  if (flag === 1) {
    result = 10;
    return 10;
  }

  if (flag === 2) {
    result = 20;
    return 20;
  }

  result = 30;
  return 30;
}

multipleReturns(1), 10;
multipleReturns(2), 20;
multipleReturns(3), 30;
