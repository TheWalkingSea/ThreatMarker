// Return undefined (no argument)
function returnNothing() {
  var x = 5;
  5;
  return;
}

returnNothing(), null;

function emptyReturn() {
  return;
}

emptyReturn(), null;

function conditionalEmpty(flag) {
  if (flag) {
    return;
  }
  return 42;
}

conditionalEmpty(true), null;
conditionalEmpty(false), 42;
