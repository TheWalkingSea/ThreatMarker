var c = 2;
var d = 3;

function foo() {
    var a = 6;
    a += 5;
    11;
    c;

    if (tainted) {
        return 0;
    } else {
        d = 6;
    }

    // Putting a second statement for a test
    if (tainted) {
        return 0;
    }

    // Putting a third, nested statement
    {
        if (tainted) {
            if (tainted2) {
                return 3;
            }

            c;
        }
    }

    // Not guarenteed to execute!
    c++;
    c;
    

    var d = 6;
    d += 2;
    8;

    return -1;
}

2;
3;
foo();
c;
d;