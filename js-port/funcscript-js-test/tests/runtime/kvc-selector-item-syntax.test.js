const { expect } = require('chai');
const { evaluateWithVars, toPlain } = require('../helpers/runtime');
const { evaluate, DefaultFsDataProvider } = require('@tewelde/funcscript');

describe('KVC selector item shorthand', () => {
  it('parses `<identifier> <selector>` as `<identifier>: <identifier> <selector>`', () => {
    const result = evaluateWithVars('{person {name,age}}', {
      person: { name: 'Alice', age: 30, extra: true }
    });
    expect(toPlain(result)).to.deep.equal({
      person: { name: 'Alice', age: 30 }
    });
  });

  it('works inside eval blocks', () => {
    const expression = `{
  x:{a:3,b:4},
  eval {
    x {a}
  }
}`;
    const result = evaluate(expression, new DefaultFsDataProvider());
    expect(toPlain(result)).to.deep.equal({ x: { a: 3 } });
  });
});
