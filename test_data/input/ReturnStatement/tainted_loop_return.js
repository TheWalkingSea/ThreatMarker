// Return in tainted environment with loops
var global = 0;

function taintedWhileReturn() {
    var i = 0;
    while (tainted) {
        i++;
        if (i > 2) {
            return i;
        }
    }

    // Not guaranteed to execute
    global = 5;
    return -1;
}

global;
taintedWhileReturn();
global;

function taintedForReturn() {
    var count = 10;
    for (var j = 0; j < tainted; j++) {
        if (j === 3) {
            return j;
        }
        count++;
    }

    count;
    return count;
}

taintedForReturn();
