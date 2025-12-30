// Basic for loop with untainted condition
var sum = 0;
for (var i = 0; i < 5; i++) {
    sum += i;
    i;
}
sum;

// For loop with decrement
var countdown = 0;
for (var j = 10; j > 5; j--) {
    countdown += j;
    j;
}
countdown;
