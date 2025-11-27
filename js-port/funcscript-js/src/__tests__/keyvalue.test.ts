import { describe, expect, it } from 'vitest';
import { Engine, DefaultFsDataProvider, valueOf, typeOf, FSDataType } from '../funcscript.js';

describe('key-value member access', () => {
  it('returns typed null for missing members', () => {
    const provider = new DefaultFsDataProvider();
    const typed = Engine.evaluate('a:{z:true}; eval a.r;', provider);
    expect(typeOf(typed)).toBe(FSDataType.Null);
    expect(valueOf(typed)).toBeNull();
  });
});
