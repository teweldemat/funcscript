import { describe, expect, it } from 'vitest';
import * as FuncScriptModule from '@tewelde/funcscript';
const FuncScript: any = (FuncScriptModule as any).Engine ? FuncScriptModule : (FuncScriptModule as any).default;
const { Engine, DefaultFsDataProvider, valueOf, typeOf, FSDataType } = FuncScript;

describe('key-value member access', () => {
  it('returns typed null for missing members', () => {
    const provider = new DefaultFsDataProvider();
    const typed = Engine.evaluate('a:{z:true}; eval a.r;', provider);
    expect(typeOf(typed)).toBe(FSDataType.Null);
    expect(valueOf(typed)).toBeNull();
  });
});
