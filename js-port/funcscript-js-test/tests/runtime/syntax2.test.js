const { expect } = require('chai');
const {
  evaluate,
  evaluateTemplate,
  MapDataProvider,
  DefaultFsDataProvider,
  valueOf,
  typeOf,
  FSDataType
} = require('@tewelde/funcscript');
const { toPlain } = require('../helpers/runtime');

// Mirrors FuncScript.Test/Syntax2.cs.
describe('Syntax2', () => {
  const builtinProvider = () => new DefaultFsDataProvider();
  const createProvider = (bindings) => new MapDataProvider(bindings, builtinProvider());

  describe('String interpolation', () => {
    it('StringInterpolationBasic', () => {
      const provider = createProvider({ x: 100 });
      const result = evaluate("f'y={x+2}'", provider);
      expect(typeOf(result)).to.equal(FSDataType.String);
      expect(valueOf(result)).to.equal('y=102');
    });

    it('StringInterpolationEscape', () => {
      const provider = createProvider({ x: 100 });
      const result = evaluate("f'y=\\{x+2}'", provider);
      expect(typeOf(result)).to.equal(FSDataType.String);
      expect(valueOf(result)).to.equal('y={x+2}');
    });

    it('StringDoubleEscapeBug', () => {
      const expression = "'test\\'\\''";
      const result = evaluate(expression, builtinProvider());
      expect(typeOf(result)).to.equal(FSDataType.String);
      expect(valueOf(result)).to.equal("test''");
    });

    it('TripleQuotedStringSkipsInitialNewline', () => {
      const expression = '"""\nhello"""';
      const result = evaluate(expression, builtinProvider());
      expect(typeOf(result)).to.equal(FSDataType.String);
      expect(valueOf(result)).to.equal('hello');
    });

    it('TripleQuotedStringKeepsFirstLineWhenNotNewline', () => {
      const expression = '"""hello"""';
      const result = evaluate(expression, builtinProvider());
      expect(typeOf(result)).to.equal(FSDataType.String);
      expect(valueOf(result)).to.equal('hello');
    });

    it('ParseUnicodeString', () => {
      const expression = "'test\\u0020'";
      const result = evaluate(expression, builtinProvider());
      expect(typeOf(result)).to.equal(FSDataType.String);
      expect(valueOf(result)).to.equal('test ');
    });
  });

  describe('Null-safe accessors', () => {
    it('NullSafeGetMemberNullValue', () => {
      const result = evaluate('x?.y', builtinProvider());
      expect(typeOf(result)).to.equal(FSDataType.Null);
      expect(valueOf(result)).to.equal(null);
    });

    it('NullSafeGetMemberNoneNullValue', () => {
      const result = evaluate('{ x:{y:5}; return x?.y}', builtinProvider());
      expect(typeOf(result)).to.equal(FSDataType.Integer);
      expect(valueOf(result)).to.equal(5);
    });

    it('NullSafeExpressionNullValue', () => {
      const result = evaluate('x?!(x*200)', builtinProvider());
      expect(typeOf(result)).to.equal(FSDataType.Null);
    });

    it('NullSafeExpressionNoneNullValue', () => {
      const result = evaluate('{ x:5; return x?!(x*200)}', builtinProvider());
      expect(typeOf(result)).to.equal(FSDataType.Integer);
      expect(valueOf(result)).to.equal(1000);
    });
  });

  describe('Indexing and invocation', () => {
    it('SquareBraceIndexLiteral', () => {
      const result = evaluate('[4,5,6][1]', builtinProvider());
      expect(typeOf(result)).to.equal(FSDataType.Integer);
      expect(valueOf(result)).to.equal(5);
    });

    it('EmptyParameterList', () => {
      const expression = '{y:()=>5;return y()}';
      const result = evaluate(expression, builtinProvider());
      expect(typeOf(result)).to.equal(FSDataType.Integer);
      expect(valueOf(result)).to.equal(5);
    });

    it('SquareBraceIndexVariable', () => {
      const expression = '{x:[4,5,6];return x[1]}';
      const result = evaluate(expression, builtinProvider());
      expect(typeOf(result)).to.equal(FSDataType.Integer);
      expect(valueOf(result)).to.equal(5);
    });
  });

  describe('FS template evaluation', () => {
    it('TestFSTemplate1', () => {
      const template = 'abc';
      const result = evaluateTemplate(template, builtinProvider());
      expect(result).to.equal('abc');
    });

    it('TestFSTemplate2', () => {
      const template = "abc${'1'}";
      const result = evaluateTemplate(template, builtinProvider());
      expect(result).to.equal('abc1');
    });

    it('TestFSTemplate3', () => {
      const template = "abc${['d',1,['e',2]]}f";
      const result = evaluateTemplate(template, builtinProvider());
      expect(result).to.equal('abcd1e2f');
    });

    it('TestFSTemplate4', () => {
      const template = "abc${['d',1] map (x)=>'>'+x}f";
      const result = evaluateTemplate(template, builtinProvider());
      expect(result).to.equal('abc>d>1f');
    });
  });

  describe('CaseExpression', () => {
    const cases = [
      { expression: 'case 30', expected: 30 },
      { expression: 'case 1>2:1, 2>3:2, 10', expected: 10 },
      { expression: 'case 1>2:1, 2>1:2, 10', expected: 2 },
      { expression: 'case 1>2:1, 10', expected: 10 },
      { expression: '(case 1>2:[1], [10])[0]', expected: 10 }
    ];

    for (const { expression, expected } of cases) {
      it(expression, () => {
        const result = evaluate(expression, builtinProvider());
        expect(valueOf(result)).to.deep.equal(expected);
      });
    }
  });

  describe('SwitchExpression', () => {
    const cases = [
      { expression: 'switch 30', expected: null },
      { expression: "switch 4, 1:'a', 2:'b', 4:'c'", expected: 'c' },
      { expression: "switch 4, 1:'a', 2:'b', 3:'c'", expected: null },
      { expression: "switch 4, 1:'a', 2:'b', 3:'c','that'", expected: 'that' },
      { expression: 'switch a, b:1,2', expected: 1 }
    ];

    for (const { expression, expected } of cases) {
      it(expression, () => {
        const result = evaluate(expression, builtinProvider());
        if (expected === null) {
          expect(typeOf(result)).to.equal(FSDataType.Null);
          expect(valueOf(result)).to.equal(null);
        } else {
          expect(valueOf(result)).to.deep.equal(expected);
        }
      });
    }
  });
  describe('ListAddition', () => {
    const cases = [
      { expression: '[1]+[2]', expected: [1,2] },
    ];

    for (const { expression, expected } of cases) {
      it(expression, () => {
        const result = evaluate(expression, builtinProvider());
        expect(typeOf(result)).to.equal(FSDataType.List);
        expect(toPlain(result)).to.deep.equal(expected);
      });
    }
  });

});
