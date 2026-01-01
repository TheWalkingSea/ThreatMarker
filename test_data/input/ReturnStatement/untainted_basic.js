// Basic untainted return statements
function simple() {
    return 42;
}

simple();

function withLocal() {
    var x = 10;
    x += 5;
    return x;
}

withLocal();

function withExpression() {
    return 3 + 4 * 2;
}

withExpression();

function noReturn() {
    var a = 5;
    a;
}

noReturn();
