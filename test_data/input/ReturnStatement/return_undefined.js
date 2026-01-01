// Return undefined (no argument)
function returnNothing() {
    var x = 5;
    x;
    return;
}

returnNothing();

function emptyReturn() {
    return;
}

emptyReturn();

function conditionalEmpty(flag) {
    if (flag) {
        return;
    }
    return 42;
}

conditionalEmpty(true);
conditionalEmpty(false);
