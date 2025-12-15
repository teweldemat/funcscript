const { expect } = require('chai');
const { evaluate, typeOf, valueOf, FSDataType } = require('@tewelde/funcscript');

// Mirrors FuncScript.Test/ErrorPropagationTests.cs.
describe('ErrorPropagation', () => {
  function expectBoom(expression) {
    const result = evaluate(expression);
    expect(typeOf(result), expression).to.equal(FSDataType.Error);
    const err = valueOf(result);
    expect(err.errorMessage).to.equal('boom');
    expect(err.errorData).to.be.an('object');
    expect(err.errorData.expression).to.equal('error(\"boom\")');
  }

  it('propagates errors through arithmetic operators', () => {
    const cases = [
      '1-error(\"boom\")',
      'error(\"boom\")-1',
      '1*error(\"boom\")',
      'error(\"boom\")*1',
      '1/error(\"boom\")',
      'error(\"boom\")/1',
      '1%error(\"boom\")',
      'error(\"boom\")%1',
      '1^error(\"boom\")',
      'error(\"boom\")^1'
    ];

    for (const expression of cases) {
      expectBoom(expression);
    }
  });

  it('propagates errors through comparison operators', () => {
    const cases = [
      '1>error(\"boom\")',
      'error(\"boom\")>1',
      '1>=error(\"boom\")',
      'error(\"boom\")>=1',
      '1<error(\"boom\")',
      'error(\"boom\")<1',
      '1<=error(\"boom\")',
      'error(\"boom\")<=1',
      '1=error(\"boom\")',
      'error(\"boom\")=1',
      '1!=error(\"boom\")',
      'error(\"boom\")!=1'
    ];

    for (const expression of cases) {
      expectBoom(expression);
    }
  });

  it('propagates errors through math functions', () => {
    const cases = [
      'math.abs(error(\"boom\"))',
      'math.pow(2,error(\"boom\"))',
      'math.pow(error(\"boom\"),2)',
      'math.min(5,error(\"boom\"))'
    ];

    for (const expression of cases) {
      expectBoom(expression);
    }
  });
});

