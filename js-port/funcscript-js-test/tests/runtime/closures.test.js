const { expect } = require('chai');
const { evaluate, DefaultFsDataProvider } = require('@tewelde/funcscript');
const { toPlain } = require('../helpers/runtime');

function buildExpression(invocationValue) {
  return `G:(t)=>
{
  Z:1;
  H:(s)=>t=s;
};

b1:G(3);
b2:G(4);

X:[b1.Z,b2.Z],
J:b1.H
  
eval [X,J(${invocationValue})]`;
}

function evaluateClosure(invocationValue) {
  const expression = buildExpression(invocationValue);
  return toPlain(evaluate(expression, new DefaultFsDataProvider()));
}

describe('Closures', () => {
  it('keeps instances isolated between invocations', () => {
    expect(evaluateClosure(4)).to.deep.equal([[1, 1], false]);
  });

  it('returns true when invocation matches captured value', () => {
    expect(evaluateClosure(3)).to.deep.equal([[1, 1], true]);
  });
});
