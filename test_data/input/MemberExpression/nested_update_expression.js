// Test UpdateExpression with arrays containing arrays
// Note: Nested member expressions like arr[0][1]++ are not supported by UpdateExpression
// This test focuses on UpdateExpression with simple member expressions on nested data

var arr = [[10, 20], [30, 40]];

// Access and increment top-level array elements (which happen to be arrays)
arr[0];  // Get first sub-array
arr[1];  // Get second sub-array

// Test tainted index in UpdateExpression
var tainted = document;
var simpleArr = [1, 2, 3, 4, 5];

simpleArr[tainted]++;  // Tainted index in update expression

simpleArr;  // Should be tainted

// UpdateExpression in tainted environment
var clean = [100, 200, 300];

if (document) {
    clean[0]++;
    ++clean[1];
}

clean[0];  // Should be clean[0] (tainted)
clean[1];  // Should be clean[1] (tainted)
clean[2];  // Should be 300 (untainted)
