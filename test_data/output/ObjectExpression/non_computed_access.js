var obj = {
  name: "test",
  value: 42,
  nested: {
    inner: 100
  }
};

"test";
42;
{
  inner: 100
};
100;

var tainted = document;

tainted.prop;
tainted.method;

var mixed = {
  a: 1,
  b: document,
  c: 3
};

1;
document;
3;

var clean = {
  x: 10,
  y: 20
};

if (document) {
  clean.x = 99;
}

clean.x;
20;

var deep = {
  level1: {
    level2: {
      level3: 777
    }
  }
};

777;
