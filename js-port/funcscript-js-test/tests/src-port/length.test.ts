import { describe, expect, it } from 'vitest';
import * as FuncScriptModule from '@tewelde/funcscript';
const FuncScript: any = (FuncScriptModule as any).Engine ? FuncScriptModule : (FuncScriptModule as any).default;
const { Engine, DefaultFsDataProvider, valueOf } = FuncScript;

describe('length function', () => {
  it('returns the number of items in a list', () => {
    const provider = new DefaultFsDataProvider();
    const typed = Engine.evaluate('length([1,2,3,4])', provider);
    expect(valueOf(typed)).toBe(4);
  });

  it('returns the number of characters in a string', () => {
    const provider = new DefaultFsDataProvider();
    const typed = Engine.evaluate('length("hello world")', provider);
    expect(valueOf(typed)).toBe(11);
  });

  it('returns one for non-list, non-string values', () => {
    const provider = new DefaultFsDataProvider();
    const typed = Engine.evaluate('length(123)', provider);
    expect(valueOf(typed)).toBe(1);
  });
});
