// Return statements inside loops
function returnInWhile() {
    var i = 0;
    while (i < 10) {
        i++;
        if (i === 3) {
            return i;
        }
    }
    return -1; // Should not reach
}

returnInWhile();

function returnInFor() {
    for (var j = 0; j < 5; j++) {
        if (j === 2) {
            return j * 10;
        }
    }
    return -1; // Should not reach
}

returnInFor();

function noReturnInLoop() {
    var sum = 0;
    for (var k = 0; k < 3; k++) {
        sum += k;
    }
    return sum;
}

noReturnInLoop();
