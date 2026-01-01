// Return statements in nested functions
function outer() {
  var x = 10;

  function inner() {
    var y = 5;
    return 8;
  }

  var result = (inner(), 8);
  return 18;
}

outer(), 18;

function outerTainted() {
  var a = 20;

  if (tainted) {
    return 99;
  }

  function innerFunc() {
    return 7;
  }

  // Not guaranteed to execute
  a += (innerFunc(), 7);
  return a;
}
outerTainted();
