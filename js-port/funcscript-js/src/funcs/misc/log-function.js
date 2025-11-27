const { BaseFunction, CallType } = require('../../core/function-base');
const { FSDataType } = require('../../core/fstypes');
const helpers = require('../helpers');

function encodeByteArray(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  if (typeof btoa === 'function') {
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }
  return Array.from(bytes);
}

function toPlainValue(typed, seenKvcs = new WeakSet(), seenLists = new WeakSet()) {
  const dataType = helpers.typeOf(typed);
  const raw = helpers.valueOf(typed);
  switch (dataType) {
    case FSDataType.Null:
      return null;
    case FSDataType.Boolean:
    case FSDataType.Integer:
    case FSDataType.Float:
      return raw;
    case FSDataType.BigInteger:
      return raw.toString();
    case FSDataType.String:
      return raw;
    case FSDataType.DateTime:
      return raw instanceof Date ? raw.toISOString() : String(raw);
    case FSDataType.Guid:
      return String(raw);
    case FSDataType.ByteArray:
      return encodeByteArray(raw);
    case FSDataType.List: {
      if (seenLists.has(raw)) {
        return '[Circular List]';
      }
      seenLists.add(raw);
      const arr = [];
      for (const entry of raw) {
        arr.push(toPlainValue(entry, seenKvcs, seenLists));
      }
      seenLists.delete(raw);
      return arr;
    }
    case FSDataType.KeyValueCollection: {
      if (seenKvcs.has(raw)) {
        return '[Circular Object]';
      }
      seenKvcs.add(raw);
      const obj = {};
      for (const [key, value] of raw.getAll()) {
        obj[key] = toPlainValue(value, seenKvcs, seenLists);
      }
      seenKvcs.delete(raw);
      return obj;
    }
    case FSDataType.Error: {
      const errorPayload = raw || {};
      const payload = {
        errorType: errorPayload.errorType || 'Error',
        errorMessage: errorPayload.errorMessage || ''
      };
      if (errorPayload.errorData !== undefined) {
        payload.errorData = errorPayload.errorData;
      }
      return payload;
    }
    case FSDataType.Function:
      return '[Function]';
    default:
      return raw;
  }
}

function formatStructuredValue(input) {
  try {
    const typed = helpers.assertTyped(input);
    const json = JSON.stringify(toPlainValue(typed));
    if (typeof json === 'undefined') {
      return String(helpers.valueOf(typed));
    }
    return json;
  } catch (error) {
    return String(error?.message ?? error ?? input);
  }
}

function writeLog(input, { formatted = false } = {}) {
  if (formatted) {
    console.log('FuncScript:', formatStructuredValue(input));
    return;
  }

  const typed = helpers.assertTyped(input);
  const dataType = helpers.typeOf(typed);
  let message;
  switch (dataType) {
    case FSDataType.Null:
      message = '<null>';
      break;
    case FSDataType.String:
      message = helpers.valueOf(typed);
      break;
    default:
      message = helpers.valueOf(typed);
      break;
  }
  console.log('FuncScript:', message);
}

class LogFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'log';
    this.callType = CallType.Infix;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    if (parameters.count === 0) {
      return helpers.makeError(helpers.FsError.ERROR_PARAMETER_COUNT_MISMATCH, `${this.symbol}: value expected`);
    }

    if (parameters.count > this.maxParameters) {
      return helpers.makeError(
        helpers.FsError.ERROR_PARAMETER_COUNT_MISMATCH,
        `${this.symbol}: expected at most ${this.maxParameters} parameters, got ${parameters.count}`
      );
    }

    const value = helpers.assertTyped(parameters.getParameter(provider, 0));

    if (parameters.count > 1) {
      const handlerParam = parameters.getParameter(provider, 1);
      const fn = helpers.ensureFunction(handlerParam);
      if (fn) {
        const args = new helpers.ArrayParameterList([value]);
        const result = fn.evaluate(provider, args);
        writeLog(typeof result === 'undefined' ? helpers.typedNull() : result);
      } else {
        writeLog(handlerParam);
      }
    } else {
      writeLog(value, { formatted: true });
    }

    return value;
  }
}

module.exports = {
  LogFunction
};
