const {
  assertTyped: coreAssertTyped,
  typeOf,
  valueOf,
  makeValue,
  convertToCommonNumericType,
  typedNull
} = require('../core/value');
const { FSDataType } = require('../core/fstypes');
const { FsError } = require('../model/fs-error');
const { ParameterList } = require('../core/function-base');

function expectParamCount(symbol, parameters, expected) {
  if (parameters.count !== expected) {
    return makeError(FsError.ERROR_PARAMETER_COUNT_MISMATCH, `${symbol}: expected ${expected} got ${parameters.count}`);
  }
  return null;
}

function makeError(type, message, data = null) {
  return makeValue(FSDataType.Error, new FsError(type, message, data));
}

function isNumeric(typed) {
  const t = typeOf(typed);
  return t === FSDataType.Integer || t === FSDataType.Float || t === FSDataType.BigInteger;
}

function toBoolean(typed) {
  const t = typeOf(typed);
  switch (t) {
    case FSDataType.Boolean:
      return valueOf(typed);
    case FSDataType.Null:
      return false;
    case FSDataType.Integer:
    case FSDataType.Float:
    case FSDataType.BigInteger:
      return valueOf(typed) !== 0 && valueOf(typed) !== 0n;
    case FSDataType.String:
      return valueOf(typed).length > 0;
    default:
      return !!valueOf(typed);
  }
}

function compare(typedLeft, typedRight, symbol) {
  if (typeOf(typedLeft) === FSDataType.Null && typeOf(typedRight) === FSDataType.Null) {
    return typedNull();
  }
  if (typeOf(typedLeft) === FSDataType.Null || typeOf(typedRight) === FSDataType.Null) {
    return typedNull();
  }

  let left = coreAssertTyped(typedLeft);
  let right = coreAssertTyped(typedRight);

  if (isNumeric(left) && isNumeric(right)) {
    [left, right] = convertToCommonNumericType(left, right);
  }

  if (typeOf(left) !== typeOf(right)) {
    return makeError(FsError.ERROR_TYPE_MISMATCH, `${symbol}: Can't compare incompatible types`);
  }

  const lVal = valueOf(left);
  const rVal = valueOf(right);

  if (typeof lVal === 'string') {
    return lVal.localeCompare(rVal);
  }
  if (lVal instanceof Date) {
    return lVal - rVal;
  }
  if (typeof lVal === 'number' || typeof lVal === 'bigint') {
    if (lVal > rVal) return 1;
    if (lVal < rVal) return -1;
    return 0;
  }
  if (lVal && typeof lVal.compareTo === 'function') {
    return lVal.compareTo(rVal);
  }
  if (lVal === rVal) return 0;
  return lVal > rVal ? 1 : -1;
}

function ensureList(value) {
  const typed = coreAssertTyped(value);
  if (typeOf(typed) === FSDataType.List) {
    return valueOf(typed);
  }
  return null;
}

function ensureFunction(value) {
  const typed = coreAssertTyped(value);
  return typeOf(typed) === FSDataType.Function ? valueOf(typed) : null;
}

function requireInteger(symbol, parameter, name) {
  const typed = coreAssertTyped(parameter);
  if (typeOf(typed) === FSDataType.Integer) {
    return { ok: true, value: valueOf(typed) };
  }
  if (typeOf(typed) === FSDataType.Float || typeOf(typed) === FSDataType.BigInteger) {
    return { ok: true, value: Number(valueOf(typed)) };
  }
  return {
    ok: false,
    error: makeError(FsError.ERROR_TYPE_INVALID_PARAMETER, `${symbol}: ${name} must be an integer`)
  };
}

function requireString(symbol, parameter, name) {
  const typed = coreAssertTyped(parameter);
  if (typeOf(typed) === FSDataType.String) {
    return { ok: true, value: valueOf(typed) };
  }
  return {
    ok: false,
    error: makeError(FsError.ERROR_TYPE_MISMATCH, `${symbol}: ${name} must be a string`)
  };
}

class ArrayParameterList extends ParameterList {
  constructor(values) {
    super();
    this.values = values.map((v) => coreAssertTyped(v, 'ArrayParameterList values must be typed'));
  }

  get count() {
    return this.values.length;
  }

  getParameter(provider, index) {
    return this.values[index];
  }
}

module.exports = {
  expectParamCount,
  makeError,
  isNumeric,
  toBoolean,
  compare,
  ensureList,
  ensureFunction,
  requireInteger,
  requireString,
  typedNull,
  makeValue,
  assertTyped: coreAssertTyped,
  typeOf,
  valueOf,
  convertToCommonNumericType,
  FsError,
  FSDataType,
  ParameterList,
  ArrayParameterList
};
