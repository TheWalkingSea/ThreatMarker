var sum = 0;
for (var i = 0; i < 2; i++) {
    for (var j = 0; j < 2; j++) {
        sum += i + j;
    }
}
sum;


var sum = 0;
{
    var i = 0;
    {
        {
            var j = 0;
            {
                sum += 0 + 0;
                j++;
            }
            {
                sum += 0 + 1;
                j++;
            }
        }
        i++;
    }
    {
        {
            var j = 0;
            {
                sum += 1 + 0;
                j++;
            }
            {
                sum += 1 + 1;
                j++;
            }
        }
        i++
    }
}
4;