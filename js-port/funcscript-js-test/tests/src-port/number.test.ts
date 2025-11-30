import { describe, expect, it } from 'vitest';
import * as FuncScriptModule from '@tewelde/funcscript';
const FuncScript: any = (FuncScriptModule as any).Engine ? FuncScriptModule : (FuncScriptModule as any).default;
const { Engine, DefaultFsDataProvider, valueOf } = FuncScript;

describe('number literals', () => {
  it('allows underscores in integer and long literals', () => {
    const provider = new DefaultFsDataProvider();

    expect(valueOf(Engine.evaluate('1_000', provider))).toBe(1000);
    expect(valueOf(Engine.evaluate('1_0e2', provider))).toBe(1000);
    expect(valueOf(Engine.evaluate('-1_000', provider))).toBe(-1000);
    expect(valueOf(Engine.evaluate('1_000l', provider))).toBe(1000n);
    expect(valueOf(Engine.evaluate('-1_000l', provider))).toBe(-1000n);
    expect(valueOf(Engine.evaluate('1_0e2l', provider))).toBe(1000n);
  });

  it('allows underscores in floating point literals', () => {
    const provider = new DefaultFsDataProvider();

    expect(valueOf(Engine.evaluate('1_0.5', provider))).toBeCloseTo(10.5, 12);
    expect(valueOf(Engine.evaluate('1.0_5', provider))).toBeCloseTo(1.05, 12);
    expect(valueOf(Engine.evaluate('-1_000.5', provider))).toBeCloseTo(-1000.5, 12);
  });
});
