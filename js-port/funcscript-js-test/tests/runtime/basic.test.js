const { expect } = require('chai');
const {
  evaluate,
  typeOf,
  valueOf,
  FSDataType,
  DefaultFsDataProvider
} = require('@tewelde/funcscript');
const { toPlain } = require('../helpers/runtime');

function evalExpression(expression) {
  return evaluate(expression, new DefaultFsDataProvider());
}

describe('Basic', () => {
  it('evaluates simple literals and arithmetic', () => {
    expect(toPlain(evalExpression('1'))).to.equal(1);
    expect(toPlain(evalExpression('1+1'))).to.equal(2);
    expect(toPlain(evalExpression('1+2*3'))).to.equal(7);
  });

  it('handles strings and concatenation', () => {
    expect(toPlain(evalExpression('"12"'))).to.equal('12');
    expect(toPlain(evalExpression('"12"+3'))).to.equal('123');
    expect(toPlain(evalExpression('{x:5; return f"a{x}b";}'))).to.equal('a5b');
  });

  it('parses keywords', () => {
    const nullResult = evalExpression('null');
    expect(typeOf(nullResult)).to.equal(FSDataType.Null);
    expect(valueOf(nullResult)).to.equal(null);
    expect(toPlain(evalExpression('true'))).to.equal(true);
    expect(toPlain(evalExpression('false'))).to.equal(false);
  });

  it('coalesces chained null expressions', () => {
    expect(toPlain(evalExpression('null??null??null??5'))).to.equal(5);
  });

  it('skips null operands when adding', () => {
    expect(toPlain(evalExpression('null+5+null'))).to.equal(5);
    expect(toPlain(evalExpression('null+null'))).to.equal(null);
  });

  it('evaluates lambda expressions', () => {
    expect(toPlain(evalExpression('((a)=>a*a+a)(3)'))).to.equal(12);
    expect(toPlain(evalExpression('(x => x)(3)'))).to.equal(3);
    expect(toPlain(evalExpression('{return x=>x+3;}(3)'))).to.equal(6);
  });

  it('supports list literals and indexing', () => {
    const list = evalExpression('[1,2,3]');
    expect(typeOf(list)).to.equal(FSDataType.List);
    expect(toPlain(list)).to.deep.equal([1, 2, 3]);
    expect(toPlain(evalExpression('[4,5,6][1]'))).to.equal(5);
  });

  it('maps and reduces lists', () => {
    expect(toPlain(evalExpression('Map([1,2,4],(x)=>x*x)'))).to.deep.equal([1, 4, 16]);
    expect(toPlain(evalExpression('Map([1,2,4],x=>x*x)'))).to.deep.equal([1, 4, 16]);
    expect(toPlain(evalExpression('Reduce(Map([1,2,4],(x)=>x*x),(x,s)=>s+x,0)'))).to.equal(21);
  });

  it('supports triple-quoted multiline strings', () => {
    const result = evalExpression('"""one\ntwo"""');
    expect(toPlain(result)).to.equal('one\ntwo');
  });

  it('evaluates triple-quoted strings inside objects without trailing newlines', () => {
    const expression = '{x:"""One line\n"""\n}';
    expect(toPlain(evalExpression(expression))).to.deep.equal({ x: 'One line' });
  });

  it('supports recursive lambdas', () => {
    expect(toPlain(evalExpression('{fib:(x)=>if(x<2,1,fib(x-2)+fib(x-1)); return fib(4);}'))).to.equal(5);
  });

  it('selects from key-value collection', () => {
    const result = evalExpression("{a:4,b:5,c:6}{a,c}");
    expect(typeOf(result)).to.equal(FSDataType.KeyValueCollection);
    expect(toPlain(result)).to.deep.equal({ a: 4, c: 6 });
  });

  it('formats key-value collection to plain object', () => {
    const result = evalExpression('{a:5,b:6}');
    expect(typeOf(result)).to.equal(FSDataType.KeyValueCollection);
    expect(toPlain(result)).to.deep.equal({ a: 5, b: 6 });
  });

  it('logs formatted value when no message is provided', () => {
    const originalLog = console.log;
    const calls = [];
    console.log = (...args) => {
      calls.push(args);
    };

    try {
      const result = evalExpression('log({a:1})');
      expect(typeOf(result)).to.equal(FSDataType.KeyValueCollection);
    } finally {
      console.log = originalLog;
    }

    expect(calls).to.have.lengthOf(1);
    expect(calls[0][0]).to.equal('FuncScript:');
    expect(calls[0][1]).to.equal('{"a":1}');
  });
});
