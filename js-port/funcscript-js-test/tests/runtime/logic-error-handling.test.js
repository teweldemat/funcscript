const { expect } = require('chai');
const { evaluate, typeOf, valueOf, FSDataType } = require('@tewelde/funcscript');

describe('Logic error handling', () => {
  it('handles errors in or operations', () => {
    const result1 = evaluate("true or error('the error')");
    expect(typeOf(result1)).to.equal(FSDataType.Boolean);
    expect(valueOf(result1)).to.equal(true);

    const result2 = evaluate("error('the error') or true");
    expect(typeOf(result2)).to.equal(FSDataType.Boolean);
    expect(valueOf(result2)).to.equal(true);

    const result3 = evaluate("error('the error') or false");
    expect(typeOf(result3)).to.equal(FSDataType.Error);
    expect(valueOf(result3).errorMessage).to.equal('the error');
  });

  it('handles errors in and operations', () => {
    const result1 = evaluate("false and error('boom')");
    expect(typeOf(result1)).to.equal(FSDataType.Boolean);
    expect(valueOf(result1)).to.equal(false);

    const result2 = evaluate("error('boom') and false");
    expect(typeOf(result2)).to.equal(FSDataType.Error);
    expect(valueOf(result2).errorMessage).to.equal('boom');

    const result3 = evaluate("error('boom') and true");
    expect(typeOf(result3)).to.equal(FSDataType.Error);
    expect(valueOf(result3).errorMessage).to.equal('boom');
  });
});
