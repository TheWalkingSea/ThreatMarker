// Early return - code after return should not execute
function earlyReturn() {
    var x = 1;
    x += 2;
    return x;

    // These should never execute
    x += 100;
    x;
}

earlyReturn();

function multipleReturns(flag) {
    var result = 0;

    if (flag === 1) {
        result = 10;
        result;
        return result;
        result = 999; // Should not execute
    }
    result;

    if (flag === 2) {
        result = 20;
        return result;
    }

    result = 30;
    return result;
}

multipleReturns(1);
multipleReturns(2);
multipleReturns(3);
