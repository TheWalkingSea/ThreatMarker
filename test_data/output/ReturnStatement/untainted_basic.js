// Basic untainted return statements
function simple() {
  return 42;
}

simple(), 42;

function withLocal() {
  var x = 10;
  x += 5;
  return 15;
}

withLocal(), 15;

function withExpression() {
  return 11;
}

withExpression(), 11;

function noReturn() {
  var a = 5;
  5;
}

noReturn(), null;
