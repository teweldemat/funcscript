const { expect } = require('chai');
const { evaluate, DefaultFsDataProvider } = require('@tewelde/funcscript');
const { toPlain } = require('../helpers/runtime');

function evalExpression(expression) {
  return evaluate(expression, new DefaultFsDataProvider());
}

describe('CacheIsolation', () => {
  it('does not reuse lambda results across calls', () => {
    const result = evalExpression('{ f:(x)=>x+1; return [f(1), f(2), f(3)]; }');
    expect(toPlain(result)).to.deep.equal([2, 3, 4]);
  });

  it('does not reuse selector results across list items', () => {
    const result = evalExpression('[{a:1,b:2},{a:3,b:4},{a:5,b:6}] {a}');
    expect(toPlain(result)).to.deep.equal([{ a: 1 }, { a: 3 }, { a: 5 }]);
  });
});
