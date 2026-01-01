var a = 10;

outer_loop:
while (a > 0) {
    a -= 5;
    a;

    while (a > 2) {
        a;

        if (a == 3) continue outer_loop;

        a--;
    }

    a -= 2;
}

a;