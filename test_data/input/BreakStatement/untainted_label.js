var a = 5;

outer_loop:
while (a > 0) {
    a;

    while (a > 2) {
        a;

        if (a == 3) break outer_loop;

        a--;
    }

    a -= 2;
}

a;