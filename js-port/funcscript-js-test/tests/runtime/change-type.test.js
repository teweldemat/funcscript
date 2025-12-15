const { expect } = require('chai');
const { evaluate, DefaultFsDataProvider, typeOf, valueOf, FSDataType } = require('@tewelde/funcscript');
const { toPlain } = require('../helpers/runtime');

function evalExpression(expression) {
  return evaluate(expression, new DefaultFsDataProvider());
}

describe('ChangeType', () => {
  it('converts string to integer (case-insensitive type name)', () => {
    const result = evalExpression('ChangeType("123","InTeGeR")');
    expect(typeOf(result)).to.equal(FSDataType.Integer);
    expect(valueOf(result)).to.equal(123);
  });

  it('converts integer to float', () => {
    const result = evalExpression('ChangeType(1,"Float")');
    expect(typeOf(result)).to.equal(FSDataType.Float);
    expect(valueOf(result)).to.equal(1);
  });

  it('converts integer to bigint', () => {
    const result = evalExpression('ChangeType(1,"BigInteger")');
    expect(typeOf(result)).to.equal(FSDataType.BigInteger);
    expect(valueOf(result)).to.equal(1n);
  });

  it('converts base64 string to byte array', () => {
    const result = evalExpression('ChangeType("AQID","ByteArray")');
    expect(typeOf(result)).to.equal(FSDataType.ByteArray);
    expect(Array.from(toPlain(result))).to.deep.equal([1, 2, 3]);
  });

  it('propagates error values', () => {
    const result = evalExpression('ChangeType(error("boom"),"String")');
    expect(typeOf(result)).to.equal(FSDataType.Error);
    const plain = toPlain(result);
    expect(plain.errorType).to.equal('Default');
    expect(plain.errorMessage).to.equal('boom');
  });
});
