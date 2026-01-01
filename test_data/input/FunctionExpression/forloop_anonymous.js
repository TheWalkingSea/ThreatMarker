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