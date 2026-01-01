function foo() {
    function inner() {
        return 67;
    }

    return (inner(), 67);
}

(foo(), 67);