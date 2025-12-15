const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');
const { FSDataType } = require('../../core/fstypes');

const GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const TICKS_PER_MILLISECOND = 10000n;
const EPOCH_TICKS = 621355968000000000n; // .NET ticks at Unix epoch

function tryParseTargetType(typeName) {
  if (typeof typeName !== 'string' || !typeName.trim()) {
    return null;
  }
  const match = Object.keys(FSDataType).find((key) => key.toLowerCase() === typeName.toLowerCase());
  return match ? FSDataType[match] : null;
}

function decodeBase64(text) {
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    return Uint8Array.from(Buffer.from(text, 'base64'));
  }
  if (typeof atob === 'function') {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  throw new Error('Base64 decode is not available in this environment');
}

class ChangeTypeFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'changetype';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    const error = helpers.expectParamCount(this.symbol, parameters, this.maxParameters);
    if (error) {
      return error;
    }

    const value = helpers.assertTyped(parameters.getParameter(provider, 0));
    if (helpers.typeOf(value) === FSDataType.Error) {
      return value;
    }
    if (helpers.typeOf(value) === FSDataType.Null) {
      return helpers.typedNull();
    }

    const typeResult = helpers.requireString(this.symbol, parameters.getParameter(provider, 1), 'TypeName');
    if (!typeResult.ok) {
      return typeResult.error;
    }

    const targetType = tryParseTargetType(typeResult.value);
    if (targetType === null) {
      return helpers.makeError(helpers.FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: unknown target type "${typeResult.value}"`);
    }

    const sourceType = helpers.typeOf(value);
    const raw = helpers.valueOf(value);

    switch (targetType) {
      case FSDataType.Null:
        return helpers.typedNull();
      case FSDataType.Boolean: {
        if (sourceType === FSDataType.Boolean) return value;
        if (sourceType === FSDataType.Integer || sourceType === FSDataType.Float) {
          return helpers.makeValue(FSDataType.Boolean, Number(raw) !== 0);
        }
        if (sourceType === FSDataType.BigInteger) {
          return helpers.makeValue(FSDataType.Boolean, raw !== 0n);
        }
        if (sourceType === FSDataType.String) {
          const normalized = raw.trim().toLowerCase();
          if (normalized === 'true') return helpers.makeValue(FSDataType.Boolean, true);
          if (normalized === 'false') return helpers.makeValue(FSDataType.Boolean, false);
          return helpers.makeError(helpers.FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: value can't be converted to Boolean`);
        }
        return helpers.makeError(helpers.FsError.ERROR_TYPE_MISMATCH, `${this.symbol}: value can't be converted to Boolean`);
      }
      case FSDataType.Integer: {
        if (sourceType === FSDataType.Integer) return value;
        if (sourceType === FSDataType.Boolean) return helpers.makeValue(FSDataType.Integer, raw ? 1 : 0);
        if (sourceType === FSDataType.BigInteger) {
          const asNumber = Number(raw);
          if (!Number.isFinite(asNumber)) {
            return helpers.makeError(helpers.FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: value can't be converted to Integer`);
          }
          return helpers.makeValue(FSDataType.Integer, Math.trunc(asNumber));
        }
        if (sourceType === FSDataType.Float) return helpers.makeValue(FSDataType.Integer, Math.trunc(raw));
        if (sourceType === FSDataType.String) {
          const asNumber = Number(raw);
          if (!Number.isFinite(asNumber)) {
            return helpers.makeError(helpers.FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: value can't be converted to Integer`);
          }
          return helpers.makeValue(FSDataType.Integer, Math.trunc(asNumber));
        }
        return helpers.makeError(helpers.FsError.ERROR_TYPE_MISMATCH, `${this.symbol}: value can't be converted to Integer`);
      }
      case FSDataType.BigInteger: {
        if (sourceType === FSDataType.BigInteger) return value;
        if (sourceType === FSDataType.Integer) return helpers.makeValue(FSDataType.BigInteger, BigInt(raw));
        if (sourceType === FSDataType.Boolean) return helpers.makeValue(FSDataType.BigInteger, raw ? 1n : 0n);
        if (sourceType === FSDataType.Float) {
          if (!Number.isFinite(raw)) {
            return helpers.makeError(helpers.FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: value can't be converted to BigInteger`);
          }
          return helpers.makeValue(FSDataType.BigInteger, BigInt(Math.trunc(raw)));
        }
        if (sourceType === FSDataType.String) {
          try {
            return helpers.makeValue(FSDataType.BigInteger, BigInt(raw.trim()));
          } catch {
            return helpers.makeError(helpers.FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: value can't be converted to BigInteger`);
          }
        }
        return helpers.makeError(helpers.FsError.ERROR_TYPE_MISMATCH, `${this.symbol}: value can't be converted to BigInteger`);
      }
      case FSDataType.Float: {
        if (sourceType === FSDataType.Float) return value;
        if (sourceType === FSDataType.Integer || sourceType === FSDataType.Boolean) return helpers.makeValue(FSDataType.Float, Number(raw));
        if (sourceType === FSDataType.BigInteger) return helpers.makeValue(FSDataType.Float, Number(raw));
        if (sourceType === FSDataType.String) {
          const asNumber = Number(raw);
          if (!Number.isFinite(asNumber) && !Number.isNaN(asNumber)) {
            return helpers.makeError(helpers.FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: value can't be converted to Float`);
          }
          return helpers.makeValue(FSDataType.Float, asNumber);
        }
        return helpers.makeError(helpers.FsError.ERROR_TYPE_MISMATCH, `${this.symbol}: value can't be converted to Float`);
      }
      case FSDataType.String: {
        if (sourceType === FSDataType.String) return value;
        if (sourceType === FSDataType.DateTime && raw instanceof Date) return helpers.makeValue(FSDataType.String, raw.toISOString());
        if (sourceType === FSDataType.ByteArray) {
          if (typeof Buffer !== 'undefined' && Buffer.from) {
            return helpers.makeValue(FSDataType.String, Buffer.from(raw).toString('base64'));
          }
          return helpers.makeValue(FSDataType.String, Array.from(raw || []).join(','));
        }
        return helpers.makeValue(FSDataType.String, String(raw));
      }
      case FSDataType.Guid: {
        if (sourceType === FSDataType.Guid) return value;
        if (sourceType !== FSDataType.String) {
          return helpers.makeError(helpers.FsError.ERROR_TYPE_MISMATCH, `${this.symbol}: value can't be converted to Guid`);
        }
        if (!GUID_REGEX.test(raw)) {
          return helpers.makeError(helpers.FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: value can't be converted to Guid`);
        }
        return helpers.makeValue(FSDataType.Guid, raw.toLowerCase());
      }
      case FSDataType.DateTime: {
        if (sourceType === FSDataType.DateTime) return value;
        if (sourceType === FSDataType.String) {
          const date = new Date(raw);
          if (Number.isNaN(date.getTime())) {
            return helpers.makeError(helpers.FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: value can't be converted to DateTime`);
          }
          return helpers.makeValue(FSDataType.DateTime, date);
        }
        if (sourceType === FSDataType.Integer || sourceType === FSDataType.BigInteger) {
          const ticks = sourceType === FSDataType.BigInteger ? raw : BigInt(raw);
          const unixTicks = ticks - EPOCH_TICKS;
          const milliseconds = Number(unixTicks / TICKS_PER_MILLISECOND);
          const date = new Date(milliseconds);
          if (Number.isNaN(date.getTime())) {
            return helpers.makeError(helpers.FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: value can't be converted to DateTime`);
          }
          return helpers.makeValue(FSDataType.DateTime, date);
        }
        return helpers.makeError(helpers.FsError.ERROR_TYPE_MISMATCH, `${this.symbol}: value can't be converted to DateTime`);
      }
      case FSDataType.ByteArray: {
        if (sourceType === FSDataType.ByteArray) return value;
        if (sourceType !== FSDataType.String) {
          return helpers.makeError(helpers.FsError.ERROR_TYPE_MISMATCH, `${this.symbol}: value can't be converted to ByteArray`);
        }
        try {
          return helpers.makeValue(FSDataType.ByteArray, decodeBase64(raw));
        } catch {
          return helpers.makeError(helpers.FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: value can't be converted to ByteArray`);
        }
      }
      case FSDataType.List:
      case FSDataType.KeyValueCollection:
      case FSDataType.Function:
      case FSDataType.Error:
        if (sourceType === targetType) return value;
        return helpers.makeError(helpers.FsError.ERROR_TYPE_MISMATCH, `${this.symbol}: value can't be converted to ${Object.keys(FSDataType).find((k) => FSDataType[k] === targetType)}`);
      default:
        return helpers.makeError(helpers.FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: unsupported target type`);
    }
  }
}

module.exports = {
  ChangeTypeFunction
};

