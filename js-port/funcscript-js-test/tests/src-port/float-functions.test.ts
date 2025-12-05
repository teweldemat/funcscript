import { describe, it, expect } from 'vitest';
import * as FuncScriptModule from '@tewelde/funcscript';

const FuncScript: any = (FuncScriptModule as any).Engine ? FuncScriptModule : (FuncScriptModule as any).default;
const { Engine, valueOf, typeOf, FSDataType, makeValue, ParameterList } = FuncScript;

class ArrayParameterList extends ParameterList {
  values: any[];
  constructor(values: any[]) {
    super();
    this.values = values;
  }

  get count() {
    return this.values.length;
  }

  getParameter(_: any, index: number) {
    return this.values[index];
  }
}

function callBool(fn: any, raw: number) {
  const callable = valueOf(fn);
  const params = new ArrayParameterList([makeValue(FSDataType.Float, raw)]);
  const result = callable.evaluate(new Engine.DefaultFsDataProvider(), params);
  expect(typeOf(result)).toBe(FSDataType.Boolean);
  return valueOf(result);
}

describe('float classification functions', () => {
  it('registers under the float collection', () => {
    const provider = new Engine.DefaultFsDataProvider();
    const floatCollection = valueOf(provider.get('float'));

    expect(floatCollection).toBeTruthy();
    expect(floatCollection.isDefined('isnormal')).toBe(true);
    expect(floatCollection.isDefined('isnan')).toBe(true);
    expect(floatCollection.isDefined('isinfinity')).toBe(true);
  });

  it('detects normal and non-normal', () => {
    const provider = new Engine.DefaultFsDataProvider();
    const floatCollection = valueOf(provider.get('float'));
    const isNormal = floatCollection.get('isnormal');

    expect(callBool(isNormal, 1)).toBe(true);
    expect(callBool(isNormal, 0)).toBe(false);
    expect(callBool(isNormal, Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('detects infinity', () => {
    const provider = new Engine.DefaultFsDataProvider();
    const floatCollection = valueOf(provider.get('float'));
    const isInfinity = floatCollection.get('isinfinity');

    expect(callBool(isInfinity, Number.POSITIVE_INFINITY)).toBe(true);
    expect(callBool(isInfinity, Number.NEGATIVE_INFINITY)).toBe(true);
    expect(callBool(isInfinity, 5)).toBe(false);
  });

  it('detects NaN', () => {
    const provider = new Engine.DefaultFsDataProvider();
    const floatCollection = valueOf(provider.get('float'));
    const isNaN = floatCollection.get('isnan');

    expect(callBool(isNaN, Number.NaN)).toBe(true);
    expect(callBool(isNaN, 42)).toBe(false);
    expect(callBool(isNaN, Number.POSITIVE_INFINITY)).toBe(false);
  });
});
