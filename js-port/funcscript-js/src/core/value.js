const { FSDataType, getTypeName } = require('./fstypes');
const { FsError } = require('../model/fs-error');

let listModule;
function ensureListModule() {
  if (!listModule) {
    // Lazy load to avoid circular dependency
    listModule = require('../model/fs-list');
  }
  return listModule;
}

let kvcModule;
function ensureKvcModule() {
  if (!kvcModule) {
    kvcModule = require('../model/key-value-collection');
  }
  return kvcModule;
}

let funcsModule;
function ensureFuncModule() {
  if (!funcsModule) {
    funcsModule = require('./function-base');
  }
  return funcsModule;
}

function makeValue(type, value) {
  return [type, value];
}

function typeOf(value) {
  return assertTyped(value)[0];
}

function valueOf(value) {
  return assertTyped(value)[1];
}

function typedNull() {
  return makeValue(FSDataType.Null, null);
}

function assertTyped(value, message) {
  if (!Array.isArray(value) || value.length !== 2) {
    const detail =
      value === null || value === undefined ? String(value) : typeof value === 'object' ? value.constructor?.name ?? 'object' : typeof value;
    throw new Error(message || `Expected typed value but received ${detail}`);
  }
  const [type] = value;
  if (!Number.isInteger(type) || type < FSDataType.Null || type > FSDataType.Error) {
    throw new Error(message || 'Expected typed value but received invalid type identifier');
  }
  return value;
}

function normalize(value) {
  if (value === null || value === undefined) {
    return typedNull();
  }
  if (typeof value === 'boolean') {
    return makeValue(FSDataType.Boolean, value);
  }
  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return makeValue(FSDataType.Float, value);
    }
    if (Number.isInteger(value)) {
      return makeValue(FSDataType.Integer, value);
    }
    return makeValue(FSDataType.Float, value);
  }
  if (typeof value === 'bigint') {
    return makeValue(FSDataType.BigInteger, value);
  }
  if (value instanceof Date) {
    return makeValue(FSDataType.DateTime, value);
  }
  if (typeof value === 'string') {
    return makeValue(FSDataType.String, value);
  }
  if (value instanceof Uint8Array) {
    return makeValue(FSDataType.ByteArray, value);
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return makeValue(FSDataType.ByteArray, Uint8Array.from(value));
  }
  const { FsList } = ensureListModule();
  if (value instanceof FsList) {
    return makeValue(FSDataType.List, value);
  }
  const { KeyValueCollection } = ensureKvcModule();
  if (value instanceof KeyValueCollection) {
    return makeValue(FSDataType.KeyValueCollection, value);
  }
  const { BaseFunction } = ensureFuncModule();
  if (value instanceof BaseFunction) {
    return makeValue(FSDataType.Function, value);
  }
  if (typeof value === 'function') {
    const { DelegateFunction } = require('../model/delegate-function');
    return makeValue(FSDataType.Function, new DelegateFunction(value));
  }
  if (value instanceof FsError) {
    return makeValue(FSDataType.Error, value);
  }
  throw new Error(`Unsupported JS value for FuncScript: ${value}`);
}

function expectType(value, expectedType, message) {
  const typed = assertTyped(value);
  if (typeOf(typed) !== expectedType) {
    const expected = getTypeName(expectedType);
    const actual = getTypeName(typeOf(typed));
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
  return typed;
}

function convertToCommonNumericType(v1, v2) {
  const tv1 = assertTyped(v1);
  const tv2 = assertTyped(v2);
  const t1 = typeOf(tv1);
  const t2 = typeOf(tv2);
  const n1 = valueOf(tv1);
  const n2 = valueOf(tv2);
  if (t1 === t2 && (t1 === FSDataType.Integer || t1 === FSDataType.Float || t1 === FSDataType.BigInteger)) {
    return [tv1, tv2];
  }
  if (t1 === FSDataType.Integer) {
    if (t2 === FSDataType.BigInteger) {
      return [makeValue(FSDataType.BigInteger, BigInt(n1)), tv2];
    }
    if (t2 === FSDataType.Float) {
      return [makeValue(FSDataType.Float, Number(n1)), tv2];
    }
  } else if (t1 === FSDataType.BigInteger) {
    if (t2 === FSDataType.Integer) {
      return [tv1, makeValue(FSDataType.BigInteger, BigInt(n2))];
    }
    if (t2 === FSDataType.Float) {
      return [makeValue(FSDataType.Float, Number(n1)), tv2];
    }
  } else if (t1 === FSDataType.Float) {
    if (t2 === FSDataType.Integer || t2 === FSDataType.BigInteger) {
      return [tv1, makeValue(FSDataType.Float, Number(n2))];
    }
  }
  throw new Error('Incompatible numeric types');
}

module.exports = {
  makeValue,
  assertTyped,
  typeOf,
  valueOf,
  normalize,
  expectType,
  convertToCommonNumericType,
  typedNull
};
