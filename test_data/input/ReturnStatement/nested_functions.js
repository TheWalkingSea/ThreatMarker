// Return statements in nested functions
function outer() {
    var x = 10;

    function inner() {
        var y = 5;
        return y + 3;
    }

    var result = inner();
    return result + x;
}

outer();

function outerTainted() {
    var a = 20;

    if (tainted) {
        return 99;
    }

    function innerFunc() {
        return 7;
    }

    // Not guaranteed to execute
    a += innerFunc();
    return a;
}

outerTainted();
