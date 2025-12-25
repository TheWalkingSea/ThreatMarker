// Test non-computed (dot notation) property access
var obj = {
  name: "test",
  value: 42,
  nested: {
    inner: 100
  }
};

obj.name;         // Should be "test"
obj.value;        // Should be 42
obj.nested;       // Should be the nested object
obj.nested.inner; // Should be 100

// With tainted object
var tainted = document;

tainted.prop;     // Should be tainted
tainted.method;   // Should be tainted

// Mixed tainted/untainted
var mixed = {
  a: 1,
  b: document,
  c: 3
};

mixed.a;  // Should be 1 (untainted)
mixed.b;  // Should be document (tainted)
mixed.c;  // Should be 3 (untainted)

// In tainted environment
var clean = {
    x: 10,
    y: 20
};

if (document) {
    clean.x = 99;
}

clean.x;  // Should be clean.x (tainted)
clean.y;  // Should be 20 (untainted)

// Nested non-computed access
var deep = {
  level1: {
    level2: {
      level3: 777
    }
  }
};

deep.level1.level2.level3;  // Should be 777
