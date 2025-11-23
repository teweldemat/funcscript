const { expect } = require('chai');
const { evaluate, valueOf, DefaultFsDataProvider } = require('@tewelde/funcscript');

describe('SyntaxAdditions', () => {
  const provider = new DefaultFsDataProvider();

  it('parses whitespace and semicolon separated list literals', () => {
    expect(valueOf(evaluate('length([1 2])', provider))).to.equal(2);
    expect(valueOf(evaluate('length([1;2])', provider))).to.equal(2);
  });

  it('resolves boolean-ish if expressions', () => {
    expect(valueOf(evaluate('if null then 1 else 2', provider))).to.equal(2);
    expect(valueOf(evaluate('if 1 then 2 else 3', provider))).to.equal(2);
  });

  it('treats null as zero in additive chains', () => {
    expect(valueOf(evaluate('1 + null + 2', provider))).to.equal(3);
  });
});
