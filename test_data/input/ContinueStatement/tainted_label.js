var a = 3;
var b = document;
var c = 5;

outer_loop:
while (b > 0) {
    a;

    while (c > 0) {
        if (b == 2) {
            continue outer_loop;
        }

        c -= 1;
    }

    a -= 1;
}

a;