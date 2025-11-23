const { expect } = require('chai');
const { evaluate, DefaultFsDataProvider, typeOf, valueOf, FSDataType } = require('@tewelde/funcscript');

// Mirrors FuncScript.Test/TextFunctionTests.cs.
describe('TextFunctions', () => {
  it('exposes string helpers through the text provider', () => {
    const provider = new DefaultFsDataProvider();
    const textValue = provider.get('text');

    expect(typeOf(textValue)).to.equal(FSDataType.KeyValueCollection);
    const textCollection = valueOf(textValue);

    expect(textCollection.isDefined('upper')).to.be.true;
    expect(textCollection.isDefined('lower')).to.be.true;
    expect(textCollection.isDefined('regex')).to.be.true;

    const upperFromCollection = textCollection.get('upper');
    const globalUpper = provider.get('upper');
    expect(upperFromCollection).to.equal(globalUpper);
  });

  it('upper and lower return transformed strings', () => {
    const cases = [
      { expression: 'upper("hello")', expected: 'HELLO' },
      { expression: 'text.upper("Hello world")', expected: 'HELLO WORLD' },
      { expression: 'lower("HELLO")', expected: 'hello' },
      { expression: 'text.lower("MiXeD")', expected: 'mixed' }
    ];

    for (const { expression, expected } of cases) {
      const result = evaluate(expression);
      expect(typeOf(result), expression).to.equal(FSDataType.String);
      expect(valueOf(result), expression).to.equal(expected);
    }
  });

  it('lower returns null for null input', () => {
    const result = evaluate('lower(null)');
    expect(typeOf(result)).to.equal(FSDataType.Null);
    expect(valueOf(result)).to.equal(null);
  });

  it('regex function matches with optional flags', () => {
    const cases = [
      { expression: 'regex("Hello world", "world")', expected: true },
      { expression: 'regex("Hello world", "^world$")', expected: false },
      { expression: 'regex("Hello", "^hello$", "i")', expected: true }
    ];

    for (const { expression, expected } of cases) {
      const result = evaluate(expression);
      expect(typeOf(result), expression).to.equal(FSDataType.Boolean);
      expect(valueOf(result), expression).to.equal(expected);
    }
  });
});
