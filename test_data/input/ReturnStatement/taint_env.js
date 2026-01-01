var c = 2;

function foo() {
    var a = 6;
    a += 5;
    a;
    c;

    if (tainted) {
        return 0;

        c;
    }

    // Not guarenteed to execute!
    c++;
    c;

    var d = 6;
    d += 2;
    d;

    return -1;
}

c;
foo();
c;