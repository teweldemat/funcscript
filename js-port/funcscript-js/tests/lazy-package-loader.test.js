import { describe, it, expect } from 'vitest';
import { loadPackage, valueOf } from '../src/funcscript.js';

describe('Lazy package loader', () => {
  it('evaluates only referenced expressions inside a module folder', () => {
    const requested = [];
    const resolver = {
      listChildren(path) {
        const key = path.join('/');
        if (key === '') {
          return ['mod'];
        }
        if (key === 'mod') {
          return ['eval', 'a', 'b', 'c'];
        }
        return [];
      },
      getExpression(path) {
        const key = path.join('/');
        requested.push(key);
        if (key === 'mod') {
          return null;
        }
        if (key === 'mod/eval') {
          return 'a';
        }
        if (key === 'mod/a') {
          return '1';
        }
        if (key === 'mod/b') {
          return 'error(\"lazy loader should not request mod/b\")';
        }
        if (key === 'mod/c') {
          return 'error(\"lazy loader should not request mod/c\")';
        }
        return null;
      }
    };

    const evaluatePackage = loadPackage(resolver);
    const root = evaluatePackage();
    const rootKvc = valueOf(root);
    const value = rootKvc.get('mod');

    expect(value).not.toBeNull();
    expect(requested).toEqual(expect.arrayContaining(['mod', 'mod/eval', 'mod/a']));
    expect(requested).not.toEqual(expect.arrayContaining(['mod/b', 'mod/c']));
  });
});
