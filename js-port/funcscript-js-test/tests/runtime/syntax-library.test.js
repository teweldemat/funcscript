const { expect } = require('chai');
const {
  evaluate,
  typeOf,
  valueOf,
  FSDataType,
  DefaultFsDataProvider,
  FsError,
  FuncScriptParser
} = require('@tewelde/funcscript');
const { toPlain } = require('../helpers/runtime');

describe('SyntaxLibrary', () => {
  const provider = new DefaultFsDataProvider();

  function expectEvaluationCases(cases) {
    for (const { expression, expected, errorType, errorMessage } of cases) {
      const result = evaluate(expression, provider);
      if (errorType) {
        expect(typeOf(result), expression).to.equal(FSDataType.Error);
        const err = valueOf(result);
        expect(err.errorType, expression).to.equal(errorType);
        if (errorMessage) {
          expect(err.errorMessage, expression).to.equal(errorMessage);
        }
      } else {
        expect(typeOf(result), expression).to.not.equal(FSDataType.Error);
        expect(toPlain(result), expression).to.deep.equal(expected);
      }
    }
  }

  it('matches C# SyntaxLibrary core cases', () => {
    const cases = [
      { expression: '1<3', expected: true },
      { expression: '1<=3', expected: true },
      { expression: '3<3', expected: false },
      { expression: '3<=3', expected: true },
      { expression: '5<=3', expected: false },
      { expression: '5<3', expected: false },
      { expression: '1>3', expected: false },
      { expression: '1>=3', expected: false },
      { expression: '3>3', expected: false },
      { expression: '3>=3', expected: true },
      { expression: '5>=3', expected: true },
      { expression: '5>3', expected: true },
      { expression: '1>3.0', expected: false },
      { expression: '1>=3.0', expected: false },
      { expression: '3>3.0', expected: false },
      { expression: '3>=3.0', expected: true },
      { expression: '5>=3.0', expected: true },
      { expression: '5>3.0', expected: true },
      { expression: '3=3.0', expected: true },
      { expression: '3=3L', expected: true },
      { expression: '3L=3', expected: true },
      { expression: '3.0=3L', expected: true },
      { expression: '3L=3.0', expected: true },
      { expression: '1==1', expected: true },
      { expression: '1==2', expected: false },
      { expression: '3="3.0"', expected: false },
      { expression: '"99"="99"', expected: true },
      { expression: '"99">"98"', expected: true },
      { expression: '"90"<"99"', expected: true },
      { expression: '"99"!="99"', expected: false },
      { expression: '"99"<"98"', expected: false },
      { expression: '"90">"99"', expected: false },
      { expression: 'null!="99"', expected: true },
      { expression: 'null<"98"', expected: null },
      { expression: '"90">null', expected: null },
      { expression: 'null=null', expected: true },
      { expression: '12=[1,2,3,4]', expected: false },
      { expression: '12>[1,2,3,4]', errorType: FsError.ERROR_TYPE_MISMATCH },
      { expression: '12>=[1,2,3,4]', errorType: FsError.ERROR_TYPE_MISMATCH },
      { expression: '12<[1,2,3,4]', errorType: FsError.ERROR_TYPE_MISMATCH },
      { expression: '12<=[1,2,3,4]', errorType: FsError.ERROR_TYPE_MISMATCH },
      { expression: '1>2>3', errorType: FsError.ERROR_PARAMETER_COUNT_MISMATCH },
      { expression: '1<2<3', errorType: FsError.ERROR_PARAMETER_COUNT_MISMATCH },
      { expression: '1=2=3', errorType: FsError.ERROR_PARAMETER_COUNT_MISMATCH },
      { expression: '1!=2!=3', errorType: FsError.ERROR_PARAMETER_COUNT_MISMATCH },
      { expression: 'if(2=null,0,1)', expected: 1 },
      { expression: 'if 1=1 then "yes" else "no"', expected: 'yes' },
      { expression: 'if 1=2 then "yes" else "no"', expected: 'no' },
      { expression: 'if (1=2) then 10 else 20', expected: 20 },
      { expression: 'if 1=1 then (if 2=2 then 1 else 2) else 3', expected: 1 },
      { expression: '{return if true then 3 else 5 }', expected: 3 },
      { expression: ' if true then 2 else 3', expected: 2 },
      { expression: 'not(1=1)', expected: false },
      { expression: 'not(3=1)', expected: true },
      { expression: 'not(null)', errorType: FsError.ERROR_TYPE_MISMATCH },
      { expression: 'not("0")', errorType: FsError.ERROR_TYPE_MISMATCH },
      { expression: '{"a":45}.A', expected: 45 },
      { expression: '{"A":45}.a', expected: 45 },
      { expression: '1+2//that is it', expected: 3 },
      { expression: '1+2//that is it\n+5', expected: 8 },
      { expression: '1+/*multi\nline*/2', expected: 3 },
      { expression: '3%2', expected: 1 },
      { expression: '2%2', expected: 0 },
      { expression: '3%2%2', expected: 1 },
      { expression: '3%2.0', expected: 1 },
      { expression: '2%2.0', expected: 0 },
      { expression: '3%2%2.0', expected: 1 },
      { expression: '3.0%2.0%2', expected: 1 },
      { expression: '3/2', expected: 1.5 },
      { expression: '2/2', expected: 1 },
      { expression: '3/2/2', expected: 0.75 },
      { expression: '3/2.0', expected: 1.5 },
      { expression: '2/2.0', expected: 1 },
      { expression: '3/2/2.0', expected: 0.75 },
      { expression: '3.0/2.0/2', expected: 0.75 },
      { expression: '9 div 2', expected: 4 },
      { expression: '18 div 3 div 2', expected: 3 },
      { expression: '9l div 2', expected: 4n },
      { expression: '9 div 2l', expected: 4n },
      { expression: '1 in [1,2]', expected: true },
      { expression: '0 in [1,2]', expected: false },
      { expression: '0 in [1,2,0]', expected: true },
      { expression: '0 in [1,0,2]', expected: true },
      { expression: 'if(0 in [1,2],1,2)', expected: 2 },
      { expression: 'if(1 in [1,2],1,2)', expected: 1 },
      { expression: 'if(null,1,2)', expected: 2 },
      { expression: 'if(5,1,2)', expected: 1 },
      { expression: '"1" in ["1",1,2]', expected: true },
      { expression: '1 in ["1",2]', expected: false },
      { expression: 'not("1" in ["1",2])', expected: false },
      { expression: 'true and true', expected: true },
      { expression: 'true and false', expected: false },
      { expression: 'true and true and true', expected: true },
      { expression: 'true and false and true', expected: false },
      { expression: 'true and null', expected: true },
      { expression: 'false and null', expected: false },
      { expression: 'null and null', expected: null },
      { expression: 'true or true', expected: true },
      { expression: 'true or false', expected: true },
      { expression: 'true or true or true', expected: true },
      { expression: 'true or false or true', expected: true },
      { expression: 'true or null', expected: true },
      { expression: 'false or null', expected: false },
      { expression: 'null or null', expected: null },
      { expression: 'false or false or true', expected: true },
      { expression: 'true and true or false and false', expected: false },
      { expression: 'true or false and true', expected: true },
      { expression: 'false and ([34]>5)', expected: false },
      { expression: 'true and ([34]>5)', errorType: FsError.ERROR_TYPE_MISMATCH },
      { expression: 'false or  ([34]>5)', errorType: FsError.ERROR_TYPE_MISMATCH },
      { expression: 'true or ([34]>5)', expected: true },
      { expression: 'error("boom")', errorType: FsError.ERROR_DEFAULT, errorMessage: 'boom' },
      { expression: 'error("boom", "CUSTOM")', errorType: 'CUSTOM', errorMessage: 'boom' },
      { expression: '2*3 in [4,6]', expected: true },
      { expression: '2=2 and 3=4', expected: false },
      { expression: '2=2 or 3=4', expected: true },
      { expression: '{ x:5; return f"ab{x}";}', expected: 'ab5' },
      { expression: '{ x:5; return f"ab{ x}";}', expected: 'ab5' },
      { expression: '{ x:5; return f"ab{ x }";}', expected: 'ab5' },
      { expression: '{ x:5; return f"ab{x }";}', expected: 'ab5' },
      { expression: "f'{1}\\''", expected: "1'" },
      { expression: 'format(12.123,"#,0.00")', expected: '12.12' },
      { expression: 'format(null,"#,0.00")', expected: 'null' },
      { expression: '[4,5,6][1]', expected: 5 },
      { expression: '{x:[4,5,6];return x[1]}', expected: 5 },
      { expression: '[2,3,4](0)', expected: 2 },
      { expression: '([[2,3,4],[3,4,5]])(0)(1)', expected: 3 },
      { expression: '1!=2', expected: true },
      { expression: '1!=1', expected: false },
      { expression: '1*2*3*4', expected: 24 }
    ];
    expectEvaluationCases(cases);
  });

  it('handles number type mixing - level 1', () => {
    const cases = [
      { expression: '10 - 6.0', expected: 4 },
      { expression: '15 + 5l', expected: 20n },
      { expression: '20 - 4l', expected: 16n },
      { expression: '7.5 + 2.5', expected: 10 },
      { expression: '8 * 2.0', expected: 16 },
      { expression: '5.0 / 2', expected: 2.5 },
      { expression: '100L - 50', expected: 50n },
      { expression: '2L * 3.0', expected: 6 },
      { expression: '12 / 3L', expected: 4n },
      { expression: '3.0 + 4.0', expected: 7 },
      { expression: '100 - 50.0', expected: 50 },
      { expression: '5 + 5', expected: 10 },
      { expression: '25L / 5', expected: 5n },
      { expression: '9.0 - 3L', expected: 6 },
      { expression: '6L * 2', expected: 12n }
    ];
    expectEvaluationCases(cases);
  });

  it('handles number type mixing - level 2', () => {
    const cases = [
      { expression: '10 - 6.0 + 2 * 3', expected: 10 },
      { expression: '(15 + 5l) / 2', expected: 10n },
      { expression: '20 - (4l + 6)', expected: 10n },
      { expression: '7.5 + (2.5 * 2)', expected: 12.5 },
      { expression: '(8 * 2.0) / 4', expected: 4 },
      { expression: '5.0 / 2 + 3', expected: 5.5 },
      { expression: '100L - (50 + 25)', expected: 25n },
      { expression: '2L * (3.0 + 1)', expected: 8 },
      { expression: '(12 / 3L) * 2', expected: 8n },
      { expression: '3.0 + 4.0 - 2', expected: 5 },
      { expression: '100 - (50.0 + 25)', expected: 25 },
      { expression: '(5 + 5) * 2', expected: 20 },
      { expression: '(25L / 5) + 3', expected: 8n },
      { expression: '9.0 - (3L + 1)', expected: 5 },
      { expression: '6L * 2 - 4', expected: 8n },
      { expression: '10 + (20 - 5L) * 2', expected: 40n },
      { expression: '(5.0 * 3) - (2 + 1)', expected: 12 },
      { expression: '50 % 3 + 1.0', expected: 3 },
      { expression: '100L / (5 + 5)', expected: 10n },
      { expression: '(8.0 / 2) * (2 + 1)', expected: 12 },
      { expression: '20 % 3L + 2.0', expected: 4 },
      { expression: '7.5 * 2 - (4 / 2L)', expected: 13 },
      { expression: '(50L - 25) % 4', expected: 1n },
      { expression: '2L + (6 * 3.0) / 2', expected: 11 }
    ];
    expectEvaluationCases(cases);
  });

  it('handles number type mixing - level 3', () => {
    const cases = [
      { expression: '10 + 5L + 2.5', expected: 17.5 },
      { expression: '20 - 4.0 - 3L', expected: 13 },
      { expression: '3 * 2L * 4.0', expected: 24 },
      { expression: '100 / 5L / 2.0', expected: 10 },
      { expression: '50 % 7L % 3.0', expected: 1 },
      { expression: '5 + 10L + 3 + 2.5', expected: 20.5 },
      { expression: '30 - 10L - 5 - 2.0', expected: 13 },
      { expression: '2 * 3L * 2.0 * 2', expected: 24 },
      { expression: '120 / 4L / 2 / 3.0', expected: 5 },
      { expression: '35 % 6L % 5 % 2.0', expected: 0 },
      { expression: '1 + 2L + 3 + 4 + 5.0', expected: 15 },
      { expression: '50 - 10L - 5 - 3 - 2.0', expected: 30 },
      { expression: '2 * 3L * 4 * 5 * 1.0', expected: 120 },
      { expression: '200 / 4L / 5 / 2 / 2.0', expected: 2.5 },
      { expression: '55 % 7L % 3 % 2 % 1.0', expected: 0 },
      { expression: '3 + 5L + 7 + 2.5 + 1', expected: 18.5 },
      { expression: '60 - 20L - 10 - 5 - 3.0', expected: 22 },
      { expression: '2 * 3L * 2 * 4.0 * 1', expected: 48 },
      { expression: '180 / 3L / 2 / 5.0 / 2', expected: 3 },
      { expression: '70 % 10L % 6 % 4.0 % 2', expected: 0 }
    ];
    expectEvaluationCases(cases);
  });

  it('formats lists without whitespace', () => {
    const result = evaluate('format([1,2,3])', provider);
    expect(typeOf(result)).to.equal(FSDataType.String);
    const normalized = valueOf(result).replace(/[\s]/g, '');
    expect(normalized).to.equal('[1,2,3]');
  });

  it('formats lists and quotes nested strings', () => {
    const result = evaluate("format([4,'5'])", provider);
    expect(typeOf(result)).to.equal(FSDataType.String);
    const normalized = valueOf(result).replace(/[\s]/g, '');
    expect(normalized).to.equal('[4,\"5\"]');
  });

  it('formats functions inside json output', () => {
    const result = evaluate("format({x:(a)=>1},'json')", provider);
    expect(typeOf(result)).to.equal(FSDataType.String);
    const normalized = valueOf(result).replace(/[\s]/g, '');
    expect(normalized).to.equal('{"x":(a)=>1}');
  });

  it('produces expected range output', () => {
    const result = evaluate('range(1,5)', provider);
    expect(toPlain(result)).to.deep.equal([1, 2, 3, 4, 5]);
  });

  it('uses start type for range output', () => {
    const bigintRange = evaluate('range(1L,3)', provider);
    expect(toPlain(bigintRange)).to.deep.equal([1n, 2n, 3n]);

    const floatRange = evaluate('range(1.5,3)', provider);
    expect(toPlain(floatRange)).to.deep.equal([1.5, 2.5, 3.5]);
  });

  it('coerces range count to an integer', () => {
    const coerced = evaluate('range(1,3.9)', provider);
    expect(toPlain(coerced)).to.deep.equal([1, 2, 3]);

    const bigintCount = evaluate('range(1,5L)', provider);
    expect(toPlain(bigintCount)).to.deep.equal([1, 2, 3, 4, 5]);
  });

  it('evaluates nested function scopes', () => {
    const expression = '{\n      r:5;\n      f:(a,b)=>r*a*b;\n      return f(1,2);\n}';
    const result = evaluate(expression, provider);
    expect(toPlain(result)).to.equal(10);
  });

  it('supports first() predicate search', () => {
    const firstNegative = evaluate('first([1,2,4,-5,3],(x)=>x<0)', provider);
    expect(toPlain(firstNegative)).to.equal(-5);
    const noMatch = evaluate('first([1,2,4,5,3],(x)=>x<0)', provider);
    expect(toPlain(noMatch)).to.equal(null);
  });

  it('returns FsError when accessing member of null', () => {
    const result = evaluate('x.a', provider);
    expect(typeOf(result)).to.equal(FSDataType.Error);
    expect(valueOf(result).errorType).to.equal(FsError.ERROR_TYPE_MISMATCH);
  });

  it('returns FsError when member access occurs in if condition', () => {
    const result = evaluate('if a.b then true else false', provider);
    expect(typeOf(result)).to.equal(FSDataType.Error);
    expect(valueOf(result).errorType).to.equal(FsError.ERROR_TYPE_MISMATCH);
  });

  it('short-circuits logical condition before member access', () => {
    const result = evaluate("if false and a.b then 'x' else 'y'", provider);
    expect(typeOf(result)).to.equal(FSDataType.String);
    expect(valueOf(result)).to.equal('y');
  });

  it('parses if-then-else syntax to a function call', () => {
    const expression = 'if 1=1 then "yes" else "no"';
    const errors = [];
    const parseResult = FuncScriptParser.parse(provider, expression, errors);
    expect(errors, 'parser errors').to.be.empty;
    expect(parseResult.block.constructor.name).to.equal('FunctionCallExpression');
    expect(parseResult.nextIndex).to.equal(expression.length);
    const result = evaluate(expression, provider);
    expect(toPlain(result)).to.equal('yes');
  });
});
