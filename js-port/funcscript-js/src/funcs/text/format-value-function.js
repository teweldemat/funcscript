const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');
const { FSDataType } = require('../../core/fstypes');

function convertToString(value) {
  const typed = helpers.ensureTyped(value);
  switch (helpers.typeOf(typed)) {
    case FSDataType.Null:
      return 'null';
    case FSDataType.Boolean:
    case FSDataType.Integer:
    case FSDataType.Float:
    case FSDataType.BigInteger:
      return String(helpers.valueOf(typed));
    case FSDataType.String:
      return helpers.valueOf(typed);
    case FSDataType.List: {
      const list = helpers.valueOf(typed);
      const parts = [];
      for (const item of list) {
        parts.push(convertToString(item));
      }
      return `[${parts.join(', ')}]`;
    }
    case FSDataType.KeyValueCollection: {
      const kv = helpers.valueOf(typed);
      const entries = kv
        .getAll()
        .map(([key, val]) => `"${key}":${convertToString(val)}`);
      return `{ ${entries.join(', ')} }`;
    }
    case FSDataType.Function: {
      const fn = helpers.valueOf(typed);
      if (fn && typeof fn.toString === 'function') {
        return fn.toString();
      }
      return '<function>';
    }
    default:
      return String(helpers.valueOf(typed));
  }
}

function formatNumberWithPattern(number, pattern) {
  const normalizedPattern = pattern.trim();
  if (!normalizedPattern) {
    return String(number);
  }

  const hasGrouping = normalizedPattern.includes(',');
  const decimalIndex = normalizedPattern.indexOf('.');
  const integerPart = decimalIndex >= 0 ? normalizedPattern.slice(0, decimalIndex) : normalizedPattern;
  const fractionalPart = decimalIndex >= 0 ? normalizedPattern.slice(decimalIndex + 1) : '';

  const integerZeros = (integerPart.match(/0/g) || []).length;
  const fractionalZeros = (fractionalPart.match(/0/g) || []).length;
  const fractionalLength = fractionalPart.length;

  const minimumIntegerDigits = integerZeros > 0 ? integerZeros : 1;
  const minimumFractionDigits = fractionalZeros;
  const maximumFractionDigits = Math.max(fractionalLength, fractionalZeros);

  const formatter = new Intl.NumberFormat('en-US', {
    useGrouping: hasGrouping,
    minimumIntegerDigits,
    minimumFractionDigits,
    maximumFractionDigits
  });

  return formatter.format(number);
}

function tryFormatWithPattern(value, pattern) {
  const typed = helpers.ensureTyped(value);
  const formatPattern = pattern.trim();
  if (!formatPattern) {
    return convertToString(typed);
  }

  if (helpers.typeOf(typed) === FSDataType.Null) {
    return 'null';
  }

  const isNumeric = helpers.isNumeric(typed);
  if (isNumeric) {
    const numeric = Number(helpers.valueOf(typed));
    if (Number.isFinite(numeric)) {
      return formatNumberWithPattern(numeric, formatPattern);
    }
    return String(numeric);
  }

  if (helpers.typeOf(typed) === FSDataType.String) {
    const str = helpers.valueOf(typed);
    const numeric = Number(str);
    if (!Number.isNaN(numeric)) {
      return formatNumberWithPattern(numeric, formatPattern);
    }
    return str;
  }

  return null;
}

class FormatValueFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'format';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    if (parameters.count < 1) {
      return helpers.makeError(helpers.FsError.ERROR_PARAMETER_COUNT_MISMATCH, `${this.symbol} requires at least one parameter`);
    }
    const value = parameters.getParameter(provider, 0);
    const formatParameter = parameters.count > 1 ? helpers.ensureTyped(parameters.getParameter(provider, 1)) : null;

    if (formatParameter && helpers.typeOf(formatParameter) === FSDataType.String) {
      const rawFormat = helpers.valueOf(formatParameter);
      const format = rawFormat.toLowerCase();
      if (format === 'json') {
        return helpers.makeValue(FSDataType.String, convertToString(value));
      }

      const formatted = tryFormatWithPattern(value, rawFormat);
      if (formatted !== null && typeof formatted !== 'undefined') {
        return helpers.makeValue(FSDataType.String, formatted);
      }
    }

    return helpers.makeValue(FSDataType.String, convertToString(value));
  }
}

module.exports = {
  FormatValueFunction
};
