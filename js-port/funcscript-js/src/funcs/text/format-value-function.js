const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');
const { FSDataType } = require('../../core/fstypes');

function toHex4(codePoint) {
  return codePoint.toString(16).padStart(4, '0');
}

function escapeStringLiteral(value) {
  if (value == null) {
    return '';
  }
  const str = String(value);
  let out = '';
  for (let i = 0; i < str.length; i += 1) {
    const ch = str[i];
    const code = ch.charCodeAt(0);
    if (code < 0x20) {
      out += `\\u${toHex4(code)}`;
      continue;
    }
    switch (ch) {
      case '\n':
        out += '\\n';
        break;
      case '\r':
        out += '\\r';
        break;
      case '\t':
        out += '\\t';
        break;
      case '"':
        out += '\\"';
        break;
      case '\\':
        out += '\\\\';
        break;
      default:
        out += ch;
        break;
    }
  }
  return out;
}

function applyGrouping(digits) {
  const len = digits.length;
  let firstGroupLen = len % 3;
  if (firstGroupLen === 0) {
    firstGroupLen = 3;
  }
  let out = digits.slice(0, firstGroupLen);
  for (let i = firstGroupLen; i < len; i += 3) {
    out += `,${digits.slice(i, i + 3)}`;
  }
  return out;
}

function parseFormatPattern(pattern) {
  const normalized = String(pattern).trim();
  if (!normalized) {
    return null;
  }
  const dotIndex = normalized.indexOf('.');
  const integerPattern = dotIndex >= 0 ? normalized.slice(0, dotIndex) : normalized;
  const fractionPattern = dotIndex >= 0 ? normalized.slice(dotIndex + 1) : '';
  const useGrouping = integerPattern.includes(',');
  const minIntegerDigits = Math.max(1, (integerPattern.replaceAll(',', '').match(/0/g) || []).length);
  const maxFractionDigits = fractionPattern.length;
  const minFractionDigits = (fractionPattern.match(/0/g) || []).length;
  return {
    useGrouping,
    minIntegerDigits,
    maxFractionDigits,
    minFractionDigits
  };
}

function roundToEven(value, digits) {
  if (!Number.isFinite(value)) {
    return value;
  }
  const places = Math.max(0, digits);
  const factor = 10 ** places;
  const scaled = value * factor;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  if (diff === 0.5) {
    return ((floor % 2 === 0 ? floor : floor + 1) / factor);
  }
  if (diff === -0.5) {
    return (((floor % 2 === 0 ? floor : floor - 1)) / factor);
  }
  return (Math.round(scaled) / factor);
}

function trimOptionalFraction(fractionDigits, minDigits) {
  let end = fractionDigits.length;
  while (end > minDigits && fractionDigits[end - 1] === '0') {
    end -= 1;
  }
  return fractionDigits.slice(0, end);
}

function formatNumberWithPattern(number, pattern) {
  const parsed = parseFormatPattern(pattern);
  if (!parsed) {
    return String(number);
  }
  if (!Number.isFinite(number)) {
    return String(number);
  }

  const { useGrouping, minIntegerDigits, maxFractionDigits, minFractionDigits } = parsed;
  const rounded = roundToEven(number, maxFractionDigits);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);

  const fixed = maxFractionDigits > 0 ? abs.toFixed(maxFractionDigits) : String(Math.trunc(abs));
  const [rawInteger, rawFraction = ''] = fixed.split('.');

  let integerText = rawInteger.padStart(minIntegerDigits, '0');
  if (useGrouping) {
    integerText = applyGrouping(integerText);
  }
  if (maxFractionDigits === 0) {
    return `${sign}${integerText}`;
  }

  const trimmedFraction = trimOptionalFraction(rawFraction, minFractionDigits);
  if (!trimmedFraction) {
    return `${sign}${integerText}`;
  }
  return `${sign}${integerText}.${trimmedFraction}`;
}

function convertToString(value, options = {}) {
  const { quoteStrings = false, jsonMode = false } = options;
  const typed = helpers.assertTyped(value);
  switch (helpers.typeOf(typed)) {
    case FSDataType.Null:
      return 'null';
    case FSDataType.Boolean:
    case FSDataType.Integer:
    case FSDataType.Float:
      return String(helpers.valueOf(typed));
    case FSDataType.BigInteger: {
      const raw = helpers.valueOf(typed);
      const text = String(raw);
      if (jsonMode) {
        return `"${escapeStringLiteral(text)}"`;
      }
      return text;
    }
    case FSDataType.String: {
      const raw = helpers.valueOf(typed);
      if (!quoteStrings) {
        return raw;
      }
      return `"${escapeStringLiteral(raw)}"`;
    }
    case FSDataType.List: {
      const list = helpers.valueOf(typed);
      const parts = [];
      for (const item of list) {
        parts.push(convertToString(item, { quoteStrings: true, jsonMode }));
      }
      return `[ ${parts.join(', ')} ]`;
    }
    case FSDataType.KeyValueCollection: {
      const kv = helpers.valueOf(typed);
      const entries = kv
        .getAll()
        .map(([key, val]) => `"${key}":${convertToString(val, { quoteStrings: true, jsonMode })}`);
      return '{ ' + entries.join(', ') + '}';
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

function tryFormatWithPattern(value, pattern) {
  const typed = helpers.assertTyped(value);
  const formatPattern = pattern.trim();
  if (!formatPattern) {
    return convertToString(typed);
  }

  if (helpers.typeOf(typed) === FSDataType.Null) {
    return 'null';
  }

  const type = helpers.typeOf(typed);
  if (type === FSDataType.Integer || type === FSDataType.Float) {
    const numeric = Number(helpers.valueOf(typed));
    return formatNumberWithPattern(numeric, formatPattern);
  }

  if (type === FSDataType.BigInteger) {
    const bigint = helpers.valueOf(typed);
    const str = String(bigint);
    const dotIndex = formatPattern.indexOf('.');
    const integerPattern = dotIndex >= 0 ? formatPattern.slice(0, dotIndex) : formatPattern;
    const useGrouping = integerPattern.includes(',');
    const minIntegerDigits = Math.max(1, (integerPattern.replaceAll(',', '').match(/0/g) || []).length);
    let integerText = str.padStart(minIntegerDigits, '0');
    if (useGrouping) {
      integerText = applyGrouping(integerText);
    }
    return integerText;
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
    const formatParameter = parameters.count > 1 ? helpers.assertTyped(parameters.getParameter(provider, 1)) : null;

    if (formatParameter && helpers.typeOf(formatParameter) === FSDataType.String) {
      const rawFormat = helpers.valueOf(formatParameter);
      const format = rawFormat.toLowerCase();
      if (format === 'json') {
        return helpers.makeValue(
          FSDataType.String,
          convertToString(value, { quoteStrings: true, jsonMode: true })
        );
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
