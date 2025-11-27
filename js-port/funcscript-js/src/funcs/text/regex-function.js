const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');
const { FSDataType } = require('../../core/fstypes');

class RegexFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'regex';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 3;
  }

  evaluate(provider, parameters) {
    if (parameters.count < 2 || parameters.count > this.maxParameters) {
      return helpers.makeError(helpers.FsError.ERROR_PARAMETER_COUNT_MISMATCH, `${this.symbol}: two or three parameters expected`);
    }

    const textResult = helpers.requireString(this.symbol, parameters.getParameter(provider, 0), 'text');
    if (!textResult.ok) {
      return textResult.error;
    }
    const text = textResult.value;

    const patternResult = helpers.requireString(this.symbol, parameters.getParameter(provider, 1), 'pattern');
    if (!patternResult.ok) {
      return patternResult.error;
    }
    let pattern = patternResult.value;

    let flagsText = null;
    if (parameters.count === 3) {
      const flagValue = helpers.assertTyped(parameters.getParameter(provider, 2));
      if (helpers.typeOf(flagValue) !== FSDataType.Null) {
        if (helpers.typeOf(flagValue) !== FSDataType.String) {
          return helpers.makeError(helpers.FsError.ERROR_TYPE_MISMATCH, `${this.symbol}: flags parameter must be a string`);
        }
        flagsText = helpers.valueOf(flagValue);
      }
    }

    const flagResult = this.parseFlags(flagsText || '');
    if (!flagResult.ok) {
      return flagResult.error;
    }

    if (flagResult.ignoreWhitespace) {
      pattern = RegexFunction.stripPatternWhitespace(pattern);
    }

    try {
      const regex = new RegExp(pattern, flagResult.flags);
      return helpers.makeValue(FSDataType.Boolean, regex.test(text));
    } catch (error) {
      return helpers.makeError(helpers.FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: invalid regular expression`);
    }
  }

  parseFlags(flagsText) {
    if (!flagsText) {
      return { ok: true, flags: '', ignoreWhitespace: false };
    }

    let ignoreWhitespace = false;
    let flags = '';
    const seen = new Set();
    for (const raw of flagsText) {
      if (raw === ',' || raw === '|') {
        continue;
      }
      if (/\s/.test(raw)) {
        continue;
      }
      const ch = raw.toLowerCase();
      if (seen.has(ch)) {
        continue;
      }
      seen.add(ch);
      switch (ch) {
        case 'i':
          flags += 'i';
          break;
        case 'm':
          flags += 'm';
          break;
        case 's':
          flags += 's';
          break;
        case 'x':
          ignoreWhitespace = true;
          break;
        default:
          return {
            ok: false,
            error: helpers.makeError(helpers.FsError.ERROR_TYPE_MISMATCH, `${this.symbol}: unsupported regex option '${raw}'`)
          };
      }
    }

    return { ok: true, flags, ignoreWhitespace };
  }

  static stripPatternWhitespace(pattern) {
    let result = '';
    let escaping = false;
    let inCharClass = false;
    for (let i = 0; i < pattern.length; i += 1) {
      const ch = pattern[i];
      if (escaping) {
        result += ch;
        escaping = false;
        continue;
      }
      if (ch === '\\') {
        escaping = true;
        result += ch;
        continue;
      }
      if (ch === '[') {
        inCharClass = true;
        result += ch;
        continue;
      }
      if (ch === ']' && inCharClass) {
        inCharClass = false;
        result += ch;
        continue;
      }
      if (!inCharClass && ch === '#') {
        while (i + 1 < pattern.length) {
          const next = pattern[i + 1];
          if (next === '\\n' || next === '\\r') {
            break;
          }
          i += 1;
        }
        continue;
      }
      if (!inCharClass && /\s/.test(ch)) {
        continue;
      }
      result += ch;
    }
    if (escaping) {
      result += '\\';
    }
    return result;
  }

  parName(index) {
    return index === 0 ? 'text' : index === 1 ? 'pattern' : index === 2 ? 'flags' : '';
  }
}

module.exports = {
  RegexFunction
};
