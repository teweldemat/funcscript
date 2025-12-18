import { describe, it, expect, vi } from 'vitest';
import {
  createParsedResolver,
  DefaultFsDataProvider,
  FuncScriptParser,
  valueOf
} from '../src/funcscript.js';

describe('ParsedResolver', () => {
  it('parses a package expression only once per path+source', () => {
    const resolver = {
      listChildren() {
        return [];
      },
      getExpression(path) {
        return path.length === 0 ? '1' : null;
      }
    };

    const parseSpy = vi.spyOn(FuncScriptParser, 'parse');
    const parsed = createParsedResolver(resolver);
    const provider = new DefaultFsDataProvider();

    const first = parsed.EvalExpressionBlock(provider, []);
    const second = parsed.EvalExpressionBlock(provider, []);

    expect(valueOf(first)).toBe(1);
    expect(valueOf(second)).toBe(1);
    expect(parseSpy).toHaveBeenCalledTimes(1);
  });

  it('re-parses when the expression source changes', () => {
    let expr = '1';
    const resolver = {
      listChildren() {
        return [];
      },
      getExpression(path) {
        return path.length === 0 ? expr : null;
      }
    };

    const parseSpy = vi.spyOn(FuncScriptParser, 'parse');
    const parsed = createParsedResolver(resolver);
    const provider = new DefaultFsDataProvider();

    expect(valueOf(parsed.EvalExpressionBlock(provider, []))).toBe(1);
    expr = '2';
    expect(valueOf(parsed.EvalExpressionBlock(provider, []))).toBe(2);
    expect(parseSpy).toHaveBeenCalledTimes(2);
  });
});

