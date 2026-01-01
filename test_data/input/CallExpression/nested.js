function foo() {
    function inner() {
        return 67;
    }

    return inner();
}

foo();