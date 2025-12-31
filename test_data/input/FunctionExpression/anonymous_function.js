// Anonymous function immediately invoked
var result1 = (function() {
    return 42;
})();

result1;

// Anonymous function with parameters
var result2 = (function(a, b) {
    return a + b;
})(3, 5);

result2;

// Anonymous function assigned to variable
var add = function(x, y) {
    return x + y;
};

add(10, 20);

// Anonymous function as callback (simplified)
var numbers = [1, 2, 3];
var doubled = [0, 0, 0];
for (var i = 0; i < 3; i++) {
    doubled[i] = (function(n) {
        return n * 2;
    })(numbers[i]);
}

doubled[0];
doubled[1];
doubled[2];

// Nested anonymous functions
var outer = (function() {
    var inner = function() {
        return 99;
    };
    return inner();
})();

outer;
