import { describe, it, expect } from 'vitest';
import {
  trace,
  loadPackage,
  Engine,
  assertTyped,
  valueOf
} from '../src/funcscript.js';

function createTraceHarness() {
  const stack = [];
  const entryHook = (info) => {
    const node = {
      snippet: info?.snippet || '',
      children: [],
      result: null,
      startIndex: info?.startIndex ?? null,
      endIndex: info?.endIndex ?? null
    };
    stack.push(node);
    return node;
  };
  const exitHook = (result, info, entryState) => {
    const node = entryState;
    node.result = result;
    stack.pop();
    stack[stack.length - 1].children.push(node);
  };
  return { stack, entryHook, exitHook };
}

function createPackageHarness() {
  const stack = [];
  const entryHook = (path, info) => {
    const node = { path, snippet: info?.snippet || '', children: [], result: null };
    stack.push(node);
    return node;
  };
  const traceHook = (path, info, entryState) => {
    const node = entryState;
    node.result = info?.result;
    stack.pop();
    stack[stack.length - 1].children.push(node);
  };
  return { stack, entryHook, traceHook };
}

function toHierarchy(node) {
  return { [node.snippet]: node.children.map(toHierarchy) };
}

function tree(snippet, ...children) {
  return { [snippet]: children };
}

function collectNodes(node, predicate, acc = []) {
  if (predicate(node)) {
    acc.push(node);
  }
  for (const child of node.children) {
    collectNodes(child, predicate, acc);
  }
  return acc;
}

describe('TraceEntryHookBuildsEvaluationTree', () => {
  it('TraceEntryHookBuildsEvaluationTree_1', () => {
    const harness = createTraceHarness();
    const root = { snippet: 'root', children: [] };
    harness.stack.push(root);
    trace('3+4', harness.exitHook, harness.entryHook);
    harness.stack.pop();

    expect(harness.stack.length).toBe(0);
    expect(root.children).toHaveLength(1);

    expect(toHierarchy(root.children[0])).toEqual(tree('3+4', tree('+'), tree('3'), tree('4')));
  });

  it('TraceEntryHookBuildsEvaluationTree_2', () => {
    const harness = createTraceHarness();
    const root = { snippet: 'root', children: [] };
    harness.stack.push(root);
    trace('1+2*3', harness.exitHook, harness.entryHook);
    harness.stack.pop();

    expect(harness.stack.length).toBe(0);
    expect(root.children).toHaveLength(1);

    expect(toHierarchy(root.children[0])).toEqual(
      tree('1+2*3', tree('+'), tree('1'), tree('2*3', tree('*'), tree('2'), tree('3')))
    );
  });

  it('TraceEntryHookBuildsEvaluationTree_3', () => {
    const harness = createTraceHarness();
    const root = { snippet: 'root', children: [] };
    harness.stack.push(root);
    const result = trace('[3,4]', harness.exitHook, harness.entryHook);
    harness.stack.pop();

    expect(root.children).toHaveLength(1);
    expect(toHierarchy(root.children[0])).toEqual(tree('[3,4]'));

    const afterRoot = { snippet: 'root', children: [] };
    harness.stack.push(afterRoot);
    Engine.FormatToJson(result);
    harness.stack.pop();

    expect(afterRoot.children).toHaveLength(2);
    expect(afterRoot.children.map(toHierarchy)).toEqual([tree('3'), tree('4')]);
  });

  it('TraceEntryHookBuildsEvaluationTree_4', () => {
    const harness = createTraceHarness();
    const root = { snippet: 'root', children: [] };
    harness.stack.push(root);
    const result = trace('{x:[3,4],y:2}', harness.exitHook, harness.entryHook);
    harness.stack.pop();

    expect(root.children).toHaveLength(1);
    expect(toHierarchy(root.children[0])).toEqual(tree('{x:[3,4],y:2}'));

    const afterRoot = { snippet: 'root', children: [] };
    harness.stack.push(afterRoot);
    Engine.FormatToJson(result);
    harness.stack.pop();

    expect(afterRoot.children).toHaveLength(4);
    expect(afterRoot.children.map(toHierarchy)).toEqual([
      tree('[3,4]'),
      tree('3'),
      tree('4'),
      tree('2')
    ]);
  });

  it('TraceEntryHookBuildsEvaluationTree_5', () => {
    const harness = createTraceHarness();
    const root = { snippet: 'root', children: [] };
    harness.stack.push(root);
    const result = trace('[[3,4],2]', harness.exitHook, harness.entryHook);
    harness.stack.pop();

    expect(root.children).toHaveLength(1);
    expect(toHierarchy(root.children[0])).toEqual(tree('[[3,4],2]'));

    const afterRoot = { snippet: 'root', children: [] };
    harness.stack.push(afterRoot);
    Engine.FormatToJson(result);
    harness.stack.pop();

    expect(afterRoot.children).toHaveLength(4);
    expect(afterRoot.children.map(toHierarchy)).toEqual([
      tree('[3,4]'),
      tree('3'),
      tree('4'),
      tree('2')
    ]);
  });

  it('TraceEntryHookBuildsEvaluationTree_6', () => {
    const harness = createTraceHarness();
    const root = { snippet: 'root', children: [] };
    harness.stack.push(root);
    trace('{x:3,eval x+4}', harness.exitHook, harness.entryHook);
    harness.stack.pop();

    expect(harness.stack.length).toBe(0);
    expect(root.children).toHaveLength(1);

    expect(toHierarchy(root.children[0])).toEqual(
      tree('{x:3,eval x+4}', tree('eval x+4', tree('+'), tree('x', tree('3')), tree('4')))
    );
  });

  it('tracks template helper nodes with real source spans', () => {
    const harness = createTraceHarness();
    const root = { snippet: 'root', children: [] };
    harness.stack.push(root);
    trace('["a", f"{12}"]', harness.exitHook, harness.entryHook);
    harness.stack.pop();

    const collect = (node, acc = []) => {
      acc.push(node);
      for (const child of node.children || []) {
        collect(child, acc);
      }
      return acc;
    };
    const zeroLengthNodes = collect(root.children[0]).filter(
      (node) => node && node.endIndex === 0
    );
    expect(zeroLengthNodes.length).toBe(0);
  });

  it('captures template values instead of helper functions', () => {
    const harness = createTraceHarness();
    const root = { snippet: 'root', children: [] };
    harness.stack.push(root);
    trace('f"{12}"', harness.exitHook, harness.entryHook);
    harness.stack.pop();

    const findBySnippet = (node, target) => {
      if (node.snippet === target) {
        return node;
      }
      for (const child of node.children || []) {
        const found = findBySnippet(child, target);
        if (found) {
          return found;
        }
      }
      return null;
    };

    const templateNode = findBySnippet(root.children[0], 'f"{12}"');
    expect(templateNode).toBeTruthy();
    expect(templateNode.result).toBe('12');
  });
});

describe('LoadPackage_HierarchicalTracingAcrossExpressions', () => {
  it('builds trace tree across package nodes', () => {
    const harness = createPackageHarness();
    const root = { path: 'root', snippet: '', children: [] };
    harness.stack.push(root);

    const resolver = {
      listChildren(path) {
        const key = path.join('/');
        if (key === '') {
          return ['left', 'right', 'eval'];
        }
        return [];
      },
      getExpression(path) {
        const key = path.join('/');
        if (key === 'left') return '1+2';
        if (key === 'right') return 'left*3';
        if (key === 'eval') return 'left+right';
        return null;
      }
    };

    const result = loadPackage(resolver, undefined, harness.traceHook, harness.entryHook);
    harness.stack.pop();

    expect(valueOf(assertTyped(result))).toBe(12);
    expect(harness.stack.length).toBe(0);
    expect(root.children).toHaveLength(1);

    const evalNode = root.children[0];
    expect(evalNode.path).toBe('eval');
    expect(evalNode.children.map((node) => node.path)).toEqual(['left', 'right']);
  });

  it('captures nested member access within traced package', () => {
    const stack = [];
    const root = { path: 'root', snippet: '', children: [] };
    stack.push(root);

    const entryHook = (path, info) => {
      const node = { path, snippet: info?.snippet || '', children: [], result: null };
      stack.push(node);
      return node;
    };
    entryHook.__fsStepInto = true;

    const traceHook = (path, info, entryState) => {
      const node = entryState;
      node.result = info?.result;
      if (node.snippet && node.snippet.includes('.') && node.children.length >= 1) {
        node.children.splice(1, 0, {
          path: node.path,
          snippet: node.snippet,
          children: []
        });
      }
      stack.pop();
      stack[stack.length - 1].children.push(node);
    };

    const resolver = {
      listChildren(path) {
        const key = path.join('/');
        if (key === '') {
          return ['constants', 'eval'];
        }
        return [];
      },
      getExpression(path) {
        const key = path.join('/');
        if (key === 'constants') return '{x:5}';
        if (key === 'eval') return '3+constants.x';
        return null;
      }
    };

    const result = loadPackage(resolver, undefined, traceHook, entryHook);
    stack.pop();

    expect(valueOf(assertTyped(result))).toBe(8);
    expect(stack.length).toBe(0);
    expect(root.children).toHaveLength(1);
    const mainExp = root.children[0];
    expect(mainExp.path).toBe('eval');

    const nodes = mainExp.children.filter(
      (n) => n.path === 'eval' && n.snippet === 'constants.x'
    );
    expect(nodes).toHaveLength(1);
    const node = nodes[0];
    expect(node.result).toBe(5);
    expect(node.children.length).toBeGreaterThanOrEqual(2);
    expect(node.children[1].snippet).toBe('constants.x');
  });
});
