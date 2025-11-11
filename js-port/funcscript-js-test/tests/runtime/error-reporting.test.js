const { expect } = require('chai');
const {
  evaluate,
  MapDataProvider,
  DefaultFsDataProvider,
  typeOf,
  valueOf,
  FSDataType
} = require('@tewelde/funcscript');

// Mirrors core scenarios from FuncScript.Test/TestErrorReporting.cs

describe('ErrorReporting', () => {
  const builtinProvider = () => new DefaultFsDataProvider();

  function evaluateWithVars(expression, vars = {}) {
    const provider = new MapDataProvider(vars, builtinProvider());
    return evaluate(expression, provider);
  }

  it('reports function error span (length)', () => {
    const result = evaluate('length(a)', builtinProvider());
    expect(typeOf(result)).to.equal(FSDataType.Error);
    const err = valueOf(result);
    expect(err.errorType).to.equal('TYPE_MISMATCH');
    expect(err.errorMessage.toLowerCase()).to.include('length');
  });

  it('reports nested function error span', () => {
    expect(() => evaluate('10+length(a)', builtinProvider())).to.throw(/Length function:.*length\(a\)/);
  });

  it('reports type mismatch inside expression', () => {
    expect(() => evaluate('10+len(5)', builtinProvider())).to.throw('Function call target is not a function, list, or key-value collection');
  });

  it('reports null member access', () => {
    expect(() => evaluate('10+x.l', builtinProvider())).to.throw(/x\.l/);
  });

  it('includes failing member access in error message', () => {
    expect(() => evaluate('1+x.l', builtinProvider())).to.throw(/x\.l/);
  });

  it('reports member access on list', () => {
    expect(() => evaluate('10+[5,6].l', builtinProvider())).to.throw(/\[5,6\]\.l/);
  });

  it('reports function call errors with original expression', () => {
    expect(() => evaluate('1+z(a)', builtinProvider())).to.throw(/z\(a\)/);
  });

  it("spells out evaluation location for standalone call", () => {
    expect(() => evaluate('f(a)', builtinProvider())).to.throw(/Evaluation error at 'f\(a\)'/);
  });

  it('reports member access nested inside KVC', () => {
    const result = evaluate('{a:5; b:c.d;}', builtinProvider());
    expect(typeOf(result)).to.equal(FSDataType.KeyValueCollection);
    const collection = valueOf(result);
    const member = collection.get('b');
    expect(typeOf(member)).to.equal(FSDataType.Error);
    const err = valueOf(member);
    expect(err.errorType).to.equal('TYPE_MISMATCH');
  });

  it('allows list use without invoking error branches', () => {
    const result = evaluate('{a:x.y; b:3; return b}');
    expect(typeOf(result)).to.equal(FSDataType.Integer);
    expect(valueOf(result)).to.equal(3);
  });

  it('throws syntax error for missing operand', () => {
    expect(() => evaluate('3+')).to.throw('Failed to parse expression');
  });

  it('throws syntax error for incomplete KVC', () => {
    expect(() => evaluate('{a:3,c:')).to.throw('Failed to parse expression');
  });

  it('propagates lambda invocation errors', () => {
    const magicMessage = 'lambda boom';
    expect(() => evaluateWithVars('10+f(3)', {
      f: () => {
        throw new Error(magicMessage);
      }
    })).to.throw(magicMessage);
  });
});
