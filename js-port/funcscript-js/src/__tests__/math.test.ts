import { describe, expect, it } from 'vitest';
import { Engine, DefaultFsDataProvider, valueOf } from '../funcscript.js';

function createProvider() {
  const provider = new DefaultFsDataProvider();
  provider.set('math', provider.get('math'));
  return provider;
}

describe('math runtime values', () => {
  it('exposes random pi and e', () => {
    const provider = createProvider();

    const random = valueOf(Engine.evaluate('math.random()', provider));
    const pi = valueOf(Engine.evaluate('math.pi', provider));
    const e = valueOf(Engine.evaluate('math.e', provider));

    expect(typeof random).toBe('number');
    expect(random).toBeGreaterThanOrEqual(0);
    expect(random).toBeLessThanOrEqual(1);

    expect(pi).toBeCloseTo(Math.PI, 12);
    expect(e).toBeCloseTo(Math.E, 12);
  });

  it('supports power aliases, ^ operator, and logarithmic helpers', () => {
    const provider = createProvider();

    expect(valueOf(Engine.evaluate('math.pow(2,3)', provider))).toBeCloseTo(8, 12);
    expect(valueOf(Engine.evaluate('math.power(2,4)', provider))).toBeCloseTo(16, 12);
    expect(valueOf(Engine.evaluate('2 ^ 5', provider))).toBeCloseTo(32, 12);
    expect(valueOf(Engine.evaluate('math.log2(8)', provider))).toBeCloseTo(3, 12);
    expect(valueOf(Engine.evaluate('math.cbrt(27)', provider))).toBeCloseTo(3, 12);
  });

  it('evaluates hyperbolic and inverse hyperbolic functions', () => {
    const provider = createProvider();

    expect(valueOf(Engine.evaluate('math.sinh(0)', provider))).toBeCloseTo(0, 12);
    expect(valueOf(Engine.evaluate('math.cosh(0)', provider))).toBeCloseTo(1, 12);
    expect(valueOf(Engine.evaluate('math.tanh(1)', provider))).toBeCloseTo(Math.tanh(1), 12);
    expect(valueOf(Engine.evaluate('math.asinh(1)', provider))).toBeCloseTo(Math.asinh(1), 12);
    expect(valueOf(Engine.evaluate('math.acosh(2)', provider))).toBeCloseTo(Math.acosh(2), 12);
    expect(valueOf(Engine.evaluate('math.atanh(0.5)', provider))).toBeCloseTo(Math.atanh(0.5), 12);
  });

  it('converts angles and computes atan2', () => {
    const provider = createProvider();

    expect(valueOf(Engine.evaluate('math.atan2(0, 1)', provider))).toBeCloseTo(0, 12);
    expect(valueOf(Engine.evaluate('math.degtorad(180)', provider))).toBeCloseTo(Math.PI, 12);
    expect(valueOf(Engine.evaluate('math.radtodeg(math.pi)', provider))).toBeCloseTo(180, 12);
  });
});
