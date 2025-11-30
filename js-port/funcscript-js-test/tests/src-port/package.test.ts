import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { testPackage } = require('@tewelde/funcscript');

interface ResolverNode {
  expression?: string | { expression: string; language?: string };
  children?: Record<string, ResolverNode>;
}

function createMockResolver(root: ResolverNode) {
  const resolveNode = (segments: readonly string[] = []) => {
    let current: ResolverNode | null | undefined = root;
    for (const segment of segments) {
      if (!current || !current.children) {
        return null;
      }
      current = current.children[segment];
      if (!current) {
        return null;
      }
    }
    return current ?? null;
  };

  return {
    listChildren(path: readonly string[] = []) {
      const node = resolveNode(path);
      if (!node || !node.children) {
        return [];
      }
      return Object.keys(node.children);
    },
    getExpression(path: readonly string[] = []) {
      const node = resolveNode(path);
      return node && node.expression !== undefined ? node.expression : null;
    }
  };
}

describe('testPackage', () => {
  it('runs package tests for matching script/.test pairs', () => {
    const resolver = createMockResolver({
      children: {
        total: { expression: 'a + b' },
        'total.test': {
          expression: `
{
  suite: {
    name: "adds values";
    cases: [
      { "a": 1, "b": 2 },
      { "a": -3, "b": 5 }
    ];
    test: (res, data) => assert.equal(res, data.a + data.b);
  };

  eval [suite];
}`
        },
        eval: { expression: 'total' },
        'eval.test': {
          expression: `
{
  suite: {
    name: "exports total";
    cases: [
      { "a": 2, "b": 3 }
    ];
    test: (res) => assert.equal(res, 5);
  };

  eval [suite];
}`
        }
      }
    });

    const result = testPackage(resolver);
    expect(result.summary.scripts).toBe(2);
    expect(result.summary.failed).toBe(0);
    expect(result.tests).toHaveLength(2);
    const totalTest = result.tests.find((entry) => entry.path === 'total');
    const evalTest = result.tests.find((entry) => entry.path === 'eval');
    expect(totalTest?.result.summary.passed).toBe(2);
    expect(evalTest?.result.summary.passed).toBe(1);
  });

  it('runs FuncScript expressions tested by JavaScript suites', () => {
    const resolver = createMockResolver({
      children: {
        total: { expression: 'a + b' },
        'total.test': {
          expression: {
            expression: `
const suite = {
  name: "js tests funcscript",
  cases: [
    { a: 5, b: 7 },
    { a: -2, b: 4 }
  ],
  test: (res, data) => assert.equal(res, data.a + data.b)
};
return [suite];
`,
            language: 'javascript'
          }
        }
      }
    });

    const result = testPackage(resolver);
    expect(result.summary.failed).toBe(0);
    expect(result.summary.scripts).toBe(1);
    expect(result.tests).toHaveLength(1);
    const totalTest = result.tests.find((entry) => entry.path === 'total');
    expect(totalTest?.result.summary.passed).toBe(2);
  });

  it('runs JavaScript expressions tested by FuncScript suites', () => {
    const resolver = createMockResolver({
      children: {
        total: { expression: { expression: 'return a + b;', language: 'javascript' } },
        'total.test': {
          expression: `
{
  suite: {
    name: "funcscript tests js";
    cases: [
      { "a": 3, "b": 4 },
      { "a": -5, "b": 6 }
    ];
    test: (res, data) => assert.equal(res, data.a + data.b);
  };

  eval [suite];
}
`
        }
      }
    });

    const result = testPackage(resolver);
    expect(result.summary.failed).toBe(0);
    expect(result.summary.scripts).toBe(1);
    const totalTest = result.tests.find((entry) => entry.path === 'total');
    expect(totalTest?.result.summary.passed).toBe(2);
  });

  it('runs FuncScript functions tested by FuncScript suites', () => {
    const resolver = createMockResolver({
      children: {
        multiplier: { expression: '(value)=> value * scale' },
        'multiplier.test': {
          expression: `
{
  suite: {
    name: "funcscript tests func";
    cases: [
      { ambient: { scale: 2 }, input: [3] },
      { ambient: { scale: 4 }, input: [5] }
    ];
    test: (res, data) => assert.equal(res, data.input[0] * data.ambient.scale);
  };

  eval [suite];
}
`
        }
      }
    });

    const result = testPackage(resolver);
    expect(result.summary.failed).toBe(0);
    expect(result.summary.scripts).toBe(1);
    const multiplierTest = result.tests.find((entry) => entry.path === 'multiplier');
    expect(multiplierTest?.result.summary.passed).toBe(2);
  });

  it('runs FuncScript functions tested by JavaScript suites', () => {
    const resolver = createMockResolver({
      children: {
        multiplier: { expression: '(value)=> value * scale' },
        'multiplier.test': {
          expression: {
            expression: `
const suite = {
  name: "js tests func function",
  cases: [
    { ambient: { scale: 3 }, input: [4] },
    { ambient: { scale: -1 }, input: [7] }
  ],
  test: (res, data) => assert.equal(res, data.input[0] * data.ambient.scale)
};
return [suite];
`,
            language: 'javascript'
          }
        }
      }
    });

    const result = testPackage(resolver);
    expect(result.summary.failed).toBe(0);
    expect(result.summary.scripts).toBe(1);
    const multiplierTest = result.tests.find((entry) => entry.path === 'multiplier');
    expect(multiplierTest?.result.summary.passed).toBe(2);
  });

  it('runs module eval.js expressions tested by FuncScript suites', () => {
    const resolver = createMockResolver({
      children: {
        math: {
          children: {
            eval: { expression: { expression: 'return a * factor;', language: 'javascript' } },
            'eval.test': {
              expression: `
{
  suite: {
    name: "funcscript tests module eval";
    cases: [
      { a: 2, factor: 3 },
      { a: -4, factor: 5 }
    ];
    test: (res, data) => assert.equal(res, data.a * data.factor);
  };

  eval [suite];
}
`
            }
          }
        }
      }
    });

    const result = testPackage(resolver);
    expect(result.summary.failed).toBe(0);
    expect(result.summary.scripts).toBe(1);
    const evalTest = result.tests.find((entry) => entry.path === 'math/eval');
    expect(evalTest?.result.summary.passed).toBe(2);
  });
});
