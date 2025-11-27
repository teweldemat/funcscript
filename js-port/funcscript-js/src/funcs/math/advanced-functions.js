const { BaseFunction, CallType } = require('../../core/function-base');
const { assertTyped, typeOf, valueOf, makeValue } = require('../../core/value');
const { FSDataType } = require('../../core/fstypes');
const { makeError, FsError, requireInteger } = require('../helpers');

const NumericKind = {
  Integer: 'integer',
  BigInteger: 'bigint',
  Float: 'float'
};

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

function numericKindFromType(typed) {
  const t = typeOf(typed);
  if (t === FSDataType.Float) {
    return NumericKind.Float;
  }
  if (t === FSDataType.BigInteger) {
    return NumericKind.BigInteger;
  }
  return NumericKind.Integer;
}

function promoteNumericKind(left, right) {
  if (left === NumericKind.Float || right === NumericKind.Float) {
    return NumericKind.Float;
  }
  if (left === NumericKind.BigInteger || right === NumericKind.BigInteger) {
    return NumericKind.BigInteger;
  }
  return NumericKind.Integer;
}

function numericValueOf(typed) {
  const raw = valueOf(typed);
  return typeof raw === 'bigint' ? Number(raw) : Number(raw);
}

function ensureNumeric(symbol, parameter, name = 'number') {
  const typed = assertTyped(parameter);
  const t = typeOf(typed);
  if (t === FSDataType.Integer || t === FSDataType.Float || t === FSDataType.BigInteger) {
    return {
      ok: true,
      typed,
      kind: numericKindFromType(typed),
      number: numericValueOf(typed)
    };
  }
  return {
    ok: false,
    error: makeError(FsError.ERROR_TYPE_MISMATCH, `${symbol}: ${name} must be a number`)
  };
}

function buildNumericResult(kind, numeric) {
  switch (kind) {
    case NumericKind.Float:
      return makeValue(FSDataType.Float, numeric);
    case NumericKind.BigInteger: {
      return makeValue(FSDataType.BigInteger, BigInt(Math.trunc(numeric)));
    }
    default: {
      return makeValue(FSDataType.Integer, Math.trunc(numeric));
    }
  }
}

function normalizeSeedInput(input) {
  if (!Number.isFinite(input)) {
    return '0';
  }
  if (input === 0) {
    return '0';
  }
  return input.toString();
}

function buildSeedState(seedInput) {
  const text = normalizeSeedInput(seedInput);
  let hash = FNV_OFFSET_BASIS >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

function generateSeededRandom(seedInput) {
  let state = (buildSeedState(seedInput) + 0x9e3779b9) >>> 0;
  state = Math.imul(state ^ (state >>> 15), state | 1);
  state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
  const normalized = (state ^ (state >>> 14)) >>> 0;
  return normalized / 0x100000000;
}

class SquareRootFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'sqrt';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0));
    if (!result.ok) {
      return result.error;
    }
    if (result.number < 0) {
      return makeError(FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: number must be non-negative`);
    }
    return makeValue(FSDataType.Float, Math.sqrt(result.number));
  }
}

class AbsoluteValueFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'abs';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const typed = assertTyped(parameters.getParameter(provider, 0));
    const t = typeOf(typed);
    if (t === FSDataType.Integer) {
      return makeValue(FSDataType.Integer, Math.abs(valueOf(typed)));
    }
    if (t === FSDataType.Float) {
      return makeValue(FSDataType.Float, Math.abs(valueOf(typed)));
    }
    if (t === FSDataType.BigInteger) {
      const raw = valueOf(typed);
      return makeValue(FSDataType.BigInteger, raw < 0n ? -raw : raw);
    }
    return makeError(FsError.ERROR_TYPE_MISMATCH, `${this.symbol}: number expected`);
  }
}

class PowerFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'pow';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    if (parameters.count !== 2) {
      return makeError(FsError.ERROR_PARAMETER_COUNT_MISMATCH, `${this.symbol}: Expected 2 parameters, received ${parameters.count}`);
    }

    const baseResult = ensureNumeric(this.symbol, parameters.getParameter(provider, 0), 'base');
    if (!baseResult.ok) {
      return baseResult.error;
    }
    const exponentResult = ensureNumeric(this.symbol, parameters.getParameter(provider, 1), 'exponent');
    if (!exponentResult.ok) {
      return exponentResult.error;
    }

    return makeValue(FSDataType.Float, Math.pow(baseResult.number, exponentResult.number));
  }
}

class PowerOperatorFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = '^';
    this.callType = CallType.Infix;
  }

  get maxParameters() {
    return -1;
  }

  evaluate(provider, parameters) {
    if (parameters.count < 2) {
      return makeError(FsError.ERROR_PARAMETER_COUNT_MISMATCH, `${this.symbol}: Expected at least 2 parameters, received ${parameters.count}`);
    }

    const first = ensureNumeric(this.symbol, parameters.getParameter(provider, 0), 'base');
    if (!first.ok) {
      return first.error;
    }
    let current = first.number;

    for (let i = 1; i < parameters.count; i += 1) {
      const exponent = ensureNumeric(this.symbol, parameters.getParameter(provider, i), `exponent${i}`);
      if (!exponent.ok) {
        return exponent.error;
      }
      current = Math.pow(current, exponent.number);
    }

    return makeValue(FSDataType.Float, current);
  }
}

class ExponentialFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'exp';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0));
    if (!result.ok) {
      return result.error;
    }
    return makeValue(FSDataType.Float, Math.exp(result.number));
  }
}

class NaturalLogFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'ln';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    if (parameters.count === 0 || parameters.count > 2) {
      return makeError(FsError.ERROR_PARAMETER_COUNT_MISMATCH, `${this.symbol}: Expecting 1 or 2 parameters, received ${parameters.count}`);
    }
    const valueResult = ensureNumeric(this.symbol, parameters.getParameter(provider, 0), 'value');
    if (!valueResult.ok) {
      return valueResult.error;
    }
    if (valueResult.number <= 0) {
      return makeError(FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: value must be greater than 0`);
    }

    if (parameters.count === 1) {
      return makeValue(FSDataType.Float, Math.log(valueResult.number));
    }

    const baseResult = ensureNumeric(this.symbol, parameters.getParameter(provider, 1), 'base');
    if (!baseResult.ok) {
      return baseResult.error;
    }
    if (baseResult.number <= 0 || Math.abs(baseResult.number - 1) < Number.EPSILON) {
      return makeError(FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: base must be greater than 0 and not equal to 1`);
    }

    return makeValue(FSDataType.Float, Math.log(valueResult.number) / Math.log(baseResult.number));
  }
}

class Log10Function extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'log10';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0), 'value');
    if (!result.ok) {
      return result.error;
    }
    if (result.number <= 0) {
      return makeError(FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: value must be greater than 0`);
    }
    return makeValue(FSDataType.Float, Math.log10(result.number));
  }
}

class Log2Function extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'log2';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0), 'value');
    if (!result.ok) {
      return result.error;
    }
    if (result.number <= 0) {
      return makeError(FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: value must be greater than 0`);
    }
    return makeValue(FSDataType.Float, Math.log2(result.number));
  }
}

class CeilingFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'ceiling';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0));
    if (!result.ok) {
      return result.error;
    }
    return makeValue(FSDataType.Float, Math.ceil(result.number));
  }
}

class FloorFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'floor';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0));
    if (!result.ok) {
      return result.error;
    }
    return makeValue(FSDataType.Float, Math.floor(result.number));
  }
}

class RoundFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'round';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    if (parameters.count === 0 || parameters.count > 2) {
      return makeError(FsError.ERROR_PARAMETER_COUNT_MISMATCH, `${this.symbol}: Expecting 1 or 2 parameters, received ${parameters.count}`);
    }
    const valueResult = ensureNumeric(this.symbol, parameters.getParameter(provider, 0), 'value');
    if (!valueResult.ok) {
      return valueResult.error;
    }

    let digits = 0;
    if (parameters.count === 2) {
      const digitsResult = requireInteger(this.symbol, parameters.getParameter(provider, 1), 'digits');
      if (!digitsResult.ok) {
        return digitsResult.error;
      }
      digits = digitsResult.value;
    }

    const factor = Math.pow(10, digits);
    const rounded = Math.round(valueResult.number * factor) / factor;
    return makeValue(FSDataType.Float, rounded);
  }
}

class TruncateFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'trunc';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0));
    if (!result.ok) {
      return result.error;
    }
    return makeValue(FSDataType.Float, Math.trunc(result.number));
  }
}

class SignFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'sign';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0));
    if (!result.ok) {
      return result.error;
    }
    const sign = result.number === 0 ? 0 : (result.number > 0 ? 1 : -1);
    return makeValue(FSDataType.Integer, sign);
  }
}

class MinFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'min';
    this.callType = CallType.Prefix;
  }

  evaluate(provider, parameters) {
    if (parameters.count === 0) {
      return makeError(FsError.ERROR_PARAMETER_COUNT_MISMATCH, `${this.symbol}: At least one parameter is required`);
    }
    const first = ensureNumeric(this.symbol, parameters.getParameter(provider, 0));
    if (!first.ok) {
      return first.error;
    }

    let promotedKind = first.kind;
    let bestNumber = first.number;

    for (let i = 1; i < parameters.count; i += 1) {
      const current = ensureNumeric(this.symbol, parameters.getParameter(provider, i), `value${i + 1}`);
      if (!current.ok) {
        return current.error;
      }
      promotedKind = promoteNumericKind(promotedKind, current.kind);
      if (current.number < bestNumber) {
        bestNumber = current.number;
      }
    }

    return buildNumericResult(promotedKind, bestNumber);
  }
}

class MaxFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'max';
    this.callType = CallType.Prefix;
  }

  evaluate(provider, parameters) {
    if (parameters.count === 0) {
      return makeError(FsError.ERROR_PARAMETER_COUNT_MISMATCH, `${this.symbol}: At least one parameter is required`);
    }
    const first = ensureNumeric(this.symbol, parameters.getParameter(provider, 0));
    if (!first.ok) {
      return first.error;
    }

    let promotedKind = first.kind;
    let bestNumber = first.number;

    for (let i = 1; i < parameters.count; i += 1) {
      const current = ensureNumeric(this.symbol, parameters.getParameter(provider, i), `value${i + 1}`);
      if (!current.ok) {
        return current.error;
      }
      promotedKind = promoteNumericKind(promotedKind, current.kind);
      if (current.number > bestNumber) {
        bestNumber = current.number;
      }
    }

    return buildNumericResult(promotedKind, bestNumber);
  }
}

class ClampFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'clamp';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 3;
  }

  evaluate(provider, parameters) {
    if (parameters.count !== 3) {
      return makeError(FsError.ERROR_PARAMETER_COUNT_MISMATCH, `${this.symbol}: Expected 3 parameters, received ${parameters.count}`);
    }

    const valueResult = ensureNumeric(this.symbol, parameters.getParameter(provider, 0), 'value');
    if (!valueResult.ok) {
      return valueResult.error;
    }
    const minResult = ensureNumeric(this.symbol, parameters.getParameter(provider, 1), 'min');
    if (!minResult.ok) {
      return minResult.error;
    }
    const maxResult = ensureNumeric(this.symbol, parameters.getParameter(provider, 2), 'max');
    if (!maxResult.ok) {
      return maxResult.error;
    }

    if (minResult.number > maxResult.number) {
      return makeError(FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: min cannot be greater than max`);
    }

    const promotedKind = promoteNumericKind(valueResult.kind, promoteNumericKind(minResult.kind, maxResult.kind));
    const clamped = Math.max(minResult.number, Math.min(maxResult.number, valueResult.number));
    return buildNumericResult(promotedKind, clamped);
  }
}

class RandomFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'random';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    if (parameters.count !== 1) {
      return makeError(
        FsError.ERROR_PARAMETER_COUNT_MISMATCH,
        `${this.symbol}: Expected 1 parameter (seed), received ${parameters.count}`
      );
    }

    const seedResult = ensureNumeric(this.symbol, parameters.getParameter(provider, 0), 'seed');
    if (!seedResult.ok) {
      return seedResult.error;
    }

    return makeValue(FSDataType.Float, generateSeededRandom(seedResult.number));
  }
}

class CubeRootFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'cbrt';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0), 'value');
    if (!result.ok) {
      return result.error;
    }
    return makeValue(FSDataType.Float, Math.cbrt(result.number));
  }
}

class DegreesToRadiansFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'degtorad';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0), 'degrees');
    if (!result.ok) {
      return result.error;
    }
    return makeValue(FSDataType.Float, (result.number * Math.PI) / 180);
  }
}

class RadiansToDegreesFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'radtodeg';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0), 'radians');
    if (!result.ok) {
      return result.error;
    }
    return makeValue(FSDataType.Float, (result.number * 180) / Math.PI);
  }
}

module.exports = {
  SquareRootFunction,
  AbsoluteValueFunction,
  PowerFunction,
  PowerOperatorFunction,
  ExponentialFunction,
  NaturalLogFunction,
  Log10Function,
  Log2Function,
  CeilingFunction,
  FloorFunction,
  RoundFunction,
  TruncateFunction,
  SignFunction,
  MinFunction,
  MaxFunction,
  ClampFunction,
  RandomFunction,
  CubeRootFunction,
  DegreesToRadiansFunction,
  RadiansToDegreesFunction
};
