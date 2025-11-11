const { expect } = require('chai');
const {
  evaluate,
  typeOf,
  valueOf,
  FSDataType,
  DefaultFsDataProvider
} = require('@tewelde/funcscript');
const { toPlain } = require('../helpers/runtime');

describe('KvcTests', () => {
  const provider = new DefaultFsDataProvider();

  it('parses simple KVC', () => {
    const result = evaluate('{a:3,c:5}', provider);
    expect(typeOf(result)).to.equal(FSDataType.KeyValueCollection);
    expect(toPlain(result)).to.deep.equal({ a: 3, c: 5 });
  });

  it('supports cross references', () => {
    const result = evaluate('{a:3,c:5,d:a*c}', provider);
    expect(toPlain(result)).to.deep.equal({ a: 3, c: 5, d: 15 });
  });

  it('resolves return expression', () => {
    const result = evaluate('{a:3,c:5,d:a*c,return d}', provider);
    expect(toPlain(result)).to.equal(15);
  });

  it('resolves eval expression', () => {
    const result = evaluate('{a:3,c:5,d:a*c,eval d}', provider);
    expect(toPlain(result)).to.equal(15);
  });

  it('selector expression keeps references', () => {
    const result = evaluate('{a:4,b:5,c:6}{a,c}', provider);
    expect(toPlain(result)).to.deep.equal({ a: 4, c: 6 });
  });

  it('selector chain', () => {
    const result = evaluate('{a:{id:3}}.a.id', provider);
    expect(toPlain(result)).to.equal(3);
  });

  it('selector on array', () => {
    const result = evaluate('[{a:4,b:5,c:6},{a:7,b:8,c:9}] {a,c}', provider);
    expect(toPlain(result)).to.deep.equal([
      { a: 4, c: 6 },
      { a: 7, c: 9 }
    ]);
  });

  it('Select merges with overrides', () => {
    const result = evaluate("Select({'a':1,'b':2},{'b':5,'c':8})", provider);
    expect(toPlain(result)).to.deep.equal({ b: 5, c: 8 });
  });

  it('adds key-value collections with +', () => {
    const result = evaluate('{a:5}+{b:6}', provider);
    expect(typeOf(result)).to.equal(FSDataType.KeyValueCollection);
    expect(toPlain(result)).to.deep.equal({ a: 5, b: 6 });
  });

  it('KeyWord mixup still returns values', () => {
    const result = evaluate('{ null1:5; y:null1;}', provider);
    expect(toPlain(result)).to.deep.equal({ null1: 5, y: 5 });
  });

  it('indexing respects case-insensitive keys', () => {
    expect(toPlain(evaluate('{"A":5}["A"]', provider))).to.equal(5);
    expect(toPlain(evaluate('{"A":5}["a"]', provider))).to.equal(5);
  });
});
