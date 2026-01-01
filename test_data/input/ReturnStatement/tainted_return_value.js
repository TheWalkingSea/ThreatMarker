// Return statements with tainted values
function returnTainted() {
    return document;
}

returnTainted();

function returnMixed(flag) {
    if (flag) {
        return 42;
    } else {
        return window;
    }
}

returnMixed(true);
returnMixed(false);

function computeTainted() {
    var x = document;
    return x;
}

computeTainted();
