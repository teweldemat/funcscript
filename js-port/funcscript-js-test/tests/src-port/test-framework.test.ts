import { describe, expect, it } from 'vitest';
import * as FuncScriptModule from '@tewelde/funcscript';
const FuncScript: any = (FuncScriptModule as any).test ? FuncScriptModule : (FuncScriptModule as any).default;
const { test: runTests, DefaultFsDataProvider } = FuncScript;

describe('FuncScript test runner', () => {
  it('evaluates suites and reports passing cases', () => {
    const expression = 'a + b';
    const testExpression = `
{
  suite: {
    name: "adds numbers";
    cases: [
      { "a": 1, "b": 2 },
      { "a": -5, "b": 5 }
    ],
    test: (resData, caseData) => resData = caseData.a + caseData.b
  };

  return [suite];
}`;

    const provider = new DefaultFsDataProvider();
    const result = runTests(expression, testExpression, provider);

    expect(result.summary.passed).toBe(2);
    expect(result.summary.failed).toBe(0);
    expect(result.suites).toHaveLength(1);
    expect(result.suites[0].cases.every((c) => c.passed)).toBe(true);
  });

  it('captures assertion failures with context', () => {
    const expression = 'a - b';
    const testExpression = `
{
  suite: {
    name: "difference check";
    cases: [
      { "a": 10, "b": 2 },
      { "a": 4, "b": 1 }
    ],
    test: (resData, caseData) => resData = caseData.a + caseData.b
  };

  return [suite];
}`;

    const result = runTests(expression, testExpression);
    const [first, second] = result.suites[0].cases;

    expect(result.summary.failed).toBe(2);
    expect(first.passed).toBe(false);
    expect(first.error?.type).toBe('assertion');
    expect(first.error?.reason).toBe('boolean_false');
    expect(second.passed).toBe(false);
  });

  it('supports legacy tests arrays by running each assertion sequentially', () => {
    const expression = 'a * b';
    const testExpression = `
{
  legacy: {
    name: "legacy tests";
    cases: [
      { "a": 2, "b": 3 }
    ],
    tests: [
      (resData, caseData) => resData = caseData.a * caseData.b,
      (resData) => resData > 0
    ]
  };

  return [legacy];
}`;

    const result = runTests(expression, testExpression);
    const legacySuite = result.suites[0];
    expect(legacySuite.cases[0].passed).toBe(true);
    expect(Array.isArray(legacySuite.cases[0].assertionResult)).toBe(true);
    expect(legacySuite.cases[0].assertionResult).toHaveLength(2);
  });

  it('injects the assert helper collection into test expressions', () => {
    const expression = 'if x>0 then x else -x';
    const testExpression = `
{
  suite: {
    name: "abs";
    cases: [{"x": -5}, {"x": 7}];
    test: (res, data) => assert.equal(res, math.abs(data.x))
  };

  return [suite];
}`;

    const result = runTests(expression, testExpression);
    expect(result.summary.failed).toBe(0);
    expect(result.summary.passed).toBe(2);
  });

  it('invokes function expressions using ambient data and input lists', () => {
    const expression = '(a, b) => (a + b) * scale';
    const testExpression = `
{
  suite: {
    name: "function inputs";
    cases: [
      { ambient: { scale: 2 }, input: [3, 4] },
      { ambient: { scale: 3 }, input: [1, 5] }
    ];
    test: (res, caseData) => {
      sum: caseData.input reduce (acc, value) => acc + value ~ 0;
      eval assert.equal(res, sum * caseData.ambient.scale);
    };
  };

  return [suite];
}`;

    const result = runTests(expression, testExpression);
    expect(result.summary.failed).toBe(0);
    expect(result.summary.passed).toBe(2);
    expect(result.suites[0].cases.map((c) => c.expressionResult)).toEqual([14, 18]);
  });

  it('runs a single implicit case when cases are omitted', () => {
    const expression = '(x)=> x * 2';
    const testExpression = `
{
  suite: {
    name: "implicit case";
    test: (fn) => assert.equal(fn(3), 6);
  };

  eval [suite];
}`;

    const result = runTests(expression, testExpression);
    expect(result.summary.failed).toBe(0);
    expect(result.summary.passed).toBe(1);
  });

  it('treats null ambient as empty for function suites', () => {
    const expression = '(value) => value';
    const testExpression = `
{
  suite: {
    name: "null ambient";
    cases: [
      { ambient: null, input: [7] }
    ];
    test: (res, data) => assert.equal(res, data.input[0]);
  };

  return [suite];
}`;

    const result = runTests(expression, testExpression);
    expect(result.summary.failed).toBe(0);
    expect(result.summary.passed).toBe(1);
    expect(result.suites[0].cases[0].expressionResult).toBe(7);
  });
});
