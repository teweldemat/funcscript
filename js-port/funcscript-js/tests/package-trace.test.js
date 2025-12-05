import { describe, it, expect } from 'vitest';
import { loadPackage, valueOf, FsError, BaseFunction, KeyValueCollection } from '../src/funcscript';

class ObjectResolver {
  constructor(tree) {
    this.root = this.#buildNode(tree || {});
  }

  listChildren(path = []) {
    const node = this.#resolve(path);
    if (!node || !node.children) {
      return [];
    }
    return Array.from(node.children.values()).map((entry) => ({ name: entry.name }));
  }

  getExpression(path = []) {
    const node = this.#resolve(path);
    if (node && node.expr !== null && node.expr !== undefined) {
      return {
        expression: node.expr,
        language: node.language || 'funcscript'
      };
    }
    return null;
  }

  package() {
    return null;
  }

  #resolve(path = []) {
    let current = this.root;
    for (const segment of path || []) {
      if (!current?.children) {
        return null;
      }
      const lookup = String(segment).toLowerCase();
      current = current.children.get(lookup);
      if (!current) {
        return null;
      }
    }
    return current;
  }

  #buildNode(value, languageHint = 'funcscript') {
    if (typeof value === 'string') {
      return { name: null, expr: value, language: languageHint, children: null };
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { name: null, expr: String(value ?? ''), language: languageHint, children: null };
    }

    const children = new Map();
    for (const [rawName, childVal] of Object.entries(value)) {
      const { name, language } = normalizeName(rawName);
      const node = this.#buildNode(childVal, language || languageHint);
      node.name = name;
      children.set(name.toLowerCase(), node);
    }
    return { name: null, expr: null, language: languageHint, children };
  }
}

function normalizeName(rawName) {
  if (!rawName) {
    return { name: rawName || '', language: 'funcscript' };
  }
  const lower = rawName.toLowerCase();
  if (lower.endsWith('_js')) {
    return { name: rawName.slice(0, -3), language: 'javascript' };
  }
  return { name: rawName, language: 'funcscript' };
}

describe('package loader traces', () => {
  it('resolves sibling references when eval returns a collection', () => {
    const resolver = new ObjectResolver({
      theOne: '1',
      theTwo: '2',
      eval: '{theOne,theTwo}'
    });

    const traces = [];
    const result = loadPackage(resolver, undefined, (path, info) => traces.push({ path, info }));
    const raw = valueOf(result);

    expect(raw).toBeInstanceOf(KeyValueCollection);
    expect(valueOf(raw.get('theOne'))).toBe(1);
    expect(valueOf(raw.get('theTwo'))).toBe(2);
  });

  it('captures member-access traces with final error results', () => {
    const resolver = new ObjectResolver({
      h: {
        f: "error('err')",
        g: '5'
      },
      eval: 'h.g+h.f'
    });

    const traces = [];
    const traceHook = (path, info) => traces.push({ path, info });
    traceHook.__fsStepInto = true;

    const result = loadPackage(resolver, undefined, traceHook);
    const rawResult = valueOf(result);

    expect(rawResult).toBeInstanceOf(FsError);
    expect(rawResult.errorMessage).toBe('err');

    const evalTrace = traces.find((t) => t.path === 'eval' && t.info.snippet === 'h.g+h.f');
    expect(evalTrace).toBeTruthy();
    expect(evalTrace.info.result).toBeInstanceOf(FsError);
    expect(evalTrace.info.result.errorMessage).toBe('err');

    const hFTrace = traces.find((t) => t.path === 'h/f' && t.info.snippet === "error('err')");
    expect(hFTrace).toBeTruthy();
    expect(hFTrace.info.result).toBeInstanceOf(FsError);
    expect(hFTrace.info.result.errorMessage).toBe('err');

    const hGTrace = traces.find((t) => t.path === 'h/g' && t.info.snippet === '5');
    expect(hGTrace).toBeTruthy();
    expect(hGTrace.info.result).toBe(5);
  });

  it('captures language binding errors in traces', () => {
    const resolver = new ObjectResolver({
      h: {
        f_js: 'return z(5)',
        g: '5'
      },
      eval: 'h.g+h.f'
    });

    const traces = [];
    const traceHook = (path, info) => traces.push({ path, info });
    traceHook.__fsStepInto = true;

    const result = loadPackage(resolver, undefined, traceHook);
    const rawResult = valueOf(result);

    expect(rawResult).toBeInstanceOf(FsError);
    expect(rawResult.errorMessage.toLowerCase()).toContain('z');

    const evalTrace = traces.find((t) => t.path === 'eval' && t.info.snippet === 'h.g+h.f');
    expect(evalTrace).toBeTruthy();
    expect(evalTrace.info.result).toBeInstanceOf(FsError);
    expect(evalTrace.info.result.errorMessage.toLowerCase()).toContain('z');

    const hFTrace = traces.find(
      (t) => t.path === 'h/f' && t.info.snippet && t.info.snippet.includes('return z(5)')
    );
    expect(hFTrace).toBeTruthy();
    expect(hFTrace.info.result).toBeInstanceOf(FsError);
    expect(hFTrace.info.result.errorMessage.toLowerCase()).toContain('z');

    const hGTrace = traces.find((t) => t.path === 'h/g' && t.info.snippet === '5');
    expect(hGTrace).toBeTruthy();
    expect(hGTrace.info.result).toBe(5);
  });

  it('surfaces JS call failures only on the calling FuncScript node', () => {
    const resolver = new ObjectResolver({
      h: {
        f_js: 'return () => { throw new Error("boom"); };'
      },
      eval: '2+h.f(1)'
    });

    const traces = [];
    const traceHook = (path, info) => traces.push({ path, info });
    traceHook.__fsStepInto = true;

    const result = loadPackage(resolver, undefined, traceHook);
    const rawResult = valueOf(result);

    expect(rawResult).toBeInstanceOf(FsError);
    expect(rawResult.errorMessage.toLowerCase()).toContain('boom');

    const evalTrace = traces.find((t) => t.path === 'eval' && t.info.snippet === 'h.f(1)');
    expect(evalTrace).toBeTruthy();
    expect(evalTrace.info.result).toBeInstanceOf(FsError);
    expect(evalTrace.info.result.errorMessage.toLowerCase()).toContain('boom');

    const hFTrace = traces.find(
      (t) => t.path === 'h/f' && t.info.snippet && t.info.snippet.includes('return () =>')
    );
    expect(hFTrace).toBeTruthy();
    expect(hFTrace.info.result).toBeInstanceOf(BaseFunction);
    expect(hFTrace.info.result).not.toBeInstanceOf(FsError);
  });
});
