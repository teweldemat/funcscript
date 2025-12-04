import { describe, it, expect } from 'vitest';
import {
  loadPackage,
  valueOf,
  FsError
} from '../src/funcscript';

class ObjectResolver {
  constructor(tree) {
    this.tree = tree || {};
  }

  listChildren(path = []) {
    const node = this.#resolve(path);
    if (!node || typeof node === 'string') {
      return [];
    }
    return Object.keys(node).map((name) => ({ name }));
  }

  getExpression(path = []) {
    const node = this.#resolve(path);
    if (typeof node === 'string') {
      return { expression: node, language: 'funcscript' };
    }
    return null;
  }

  package() {
    return null;
  }

  #resolve(path = []) {
    let current = this.tree;
    for (const segment of path) {
      if (!current || typeof current !== 'object' || !(segment in current)) {
        return null;
      }
      current = current[segment];
    }
    return current;
  }
}

describe('package loader traces', () => {
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
});
