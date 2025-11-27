const { expect } = require('chai');
const {
  evaluate,
  typeOf,
  valueOf,
  FSDataType,
  DefaultFsDataProvider
} = require('@tewelde/funcscript');
const { toPlain } = require('../helpers/runtime');

describe('AdvancedSyntax', () => {
  const provider = new DefaultFsDataProvider();

  it('parses naked key/value pairs', () => {
    const result = evaluate('a:4,b:5', provider);
    expect(typeOf(result)).to.equal(FSDataType.KeyValueCollection);
    expect(toPlain(result)).to.deep.equal({ a: 4, b: 5 });
  });

  it('allows whitespace-separated key/value pairs', () => {
    const result = evaluate('{x:3 y:4\nz:x+y}', provider);
    expect(typeOf(result)).to.equal(FSDataType.KeyValueCollection);
    expect(toPlain(result)).to.deep.equal({ x: 3, y: 4, z: 7 });
  });

  const notCases = [
    ['!true', false],
    ['!false', true],
    ['!(1=2)', true]
  ];
  notCases.forEach(([expr, expected]) => {
    it(`evaluates NOT for ${expr}`, () => {
      const result = evaluate(expr, provider);
      expect(toPlain(result)).to.equal(expected);
    });
  });

  const negCases = [
    ['-5', -5],
    ['1--5', 6],
    ['1+-5', -4],
    ['{x:-5;return -x}', 5],
    ['{x:-5;return 1--x}', -4],
    ['{x:-5;return 1+-x}', 6]
  ];
  negCases.forEach(([expr, expected]) => {
    it(`handles negation in ${expr}`, () => {
      expect(toPlain(evaluate(expr, provider))).to.equal(expected);
    });
  });

  const generalInfixCases = [
    ['reduce([4,5,6],(s,x)=>s+x)', 15],
    ['reduce([4,5,6],(s,x)=>s+x,-2)', 13],
    ['[4,5,6] reduce (s,x)=>s+x ~ -2', 13],
    ['(range(0,4) reduce (s,x)=>s+x ~ 0)', 6],
    ['range(0,4) reduce (s,x)=>s+x ~ 0', 6],
    ['(range(1,3) map (a)=>a*a) reduce (s,x)=>s+x ~ 5', 19],
    ['[{a:5},{a:6}] reduce (s,x)=>s+x.a', 11],
    ['x?![1,2,3] first(x)=>x*x', null],
    ['{ b:x?! [1,2,3] map(x) => 5; return b}', null],
    ['{x:9; b:x?! [1,2,3] map(x) => 5; return b[1]}', 5]
  ];
  generalInfixCases.forEach(([expr, expected]) => {
    it(`evaluates general infix for ${expr}`, () => {
      const result = evaluate(expr, provider);
      expect(toPlain(result)).to.deep.equal(expected);
    });
  });

  const precedenceCases = [
    ['1+2*4', 9],
    ['1+4/2', 3]
  ];
  precedenceCases.forEach(([expr, expected]) => {
    it(`respects precedence for ${expr}`, () => {
      expect(toPlain(evaluate(expr, provider))).to.equal(expected);
    });
  });

  it('reports error for invalid operand', () => {
    const result = evaluate('!null', provider);
    expect(typeOf(result)).to.equal(FSDataType.Error);
    expect(valueOf(result).errorType).to.equal('TYPE_MISMATCH');
  });
});
