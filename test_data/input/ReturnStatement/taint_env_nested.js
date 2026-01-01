var c = 2;
var d = 3;

function foo() {
    var a = 6;
    a += 5;
    a;
    c;

    if (tainted) {
        return 0;

        c;
    } else {
        d = 6;
    }

    // Putting a second statement for a test
    if (tainted) {
        return 0;

        c;
    }

    // Putting a third, nested statement
    if (true) {
        if (tainted) {
            if (tainted2) {
                return 3;

                c;
            }

            c;
        }
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
d;
foo();
c;
d;