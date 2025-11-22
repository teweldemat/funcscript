const { expect } = require('chai');
const { evaluate, typeOf, valueOf, FSDataType } = require('@tewelde/funcscript');

// Mirrors FuncScript.Test/CircularReferences.cs.
describe('CircularReferences', () => {
  function expectDepthOverflow(expression) {
    const result = evaluate(expression);
    expect(typeOf(result), expression).to.equal(FSDataType.Error);
    const err = valueOf(result);
    expect(err).to.have.property('errorMessage');
    expect(err.errorMessage.toLowerCase()).to.include('maximum evaluation depth');
  }

  it('property self reference raises evaluation error', () => {
    expectDepthOverflow('{ a: a + 1; return a; }');
  });

  it('function self reference raises evaluation error', () => {
    expectDepthOverflow('{ f: (x)=>f(x); return f(1); }');
  });

  it('indirect property loop raises evaluation error', () => {
    expectDepthOverflow('{ a: b + 1; b: a + 1; return a; }');
  });
});
