const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');
const { FSDataType } = require('../../core/fstypes');

class ParseTextFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'parse';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    if (parameters.count < 1 || parameters.count > this.maxParameters) {
      return helpers.makeError(helpers.FsError.ERROR_PARAMETER_COUNT_MISMATCH, `${this.symbol} requires one or two parameters`);
    }

    const textResult = helpers.requireString(this.symbol, parameters.getParameter(provider, 0), 'text');
    if (!textResult.ok) {
      return textResult.error;
    }
    const text = textResult.value;

    const formatParam = parameters.count === 2 ? helpers.assertTyped(parameters.getParameter(provider, 1)) : null;
    let formatString = null;
    if (formatParam) {
      if (helpers.typeOf(formatParam) !== FSDataType.String) {
        return helpers.makeError(helpers.FsError.ERROR_TYPE_MISMATCH, `${this.symbol}: format must be a string`);
      }
      formatString = helpers.valueOf(formatParam).toLowerCase();
    }

    if (!formatString) {
      return helpers.makeValue(FSDataType.String, text);
    }

    switch (formatString) {
      case 'hex': {
        const value = text.startsWith('0x') ? text : `0x${text}`;
        const parsed = Number.parseInt(value, 16);
        if (Number.isNaN(parsed)) {
          return helpers.makeError(helpers.FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: invalid hex value`);
        }
        return helpers.makeValue(FSDataType.Integer, parsed);
      }
      case 'l': {
        try {
          return helpers.makeValue(FSDataType.BigInteger, BigInt(text));
        } catch (error) {
          return helpers.makeError(helpers.FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: invalid long value`);
        }
      }
      case 'fs': {
        try {
          const { evaluate } = require('../../funcscript.browser');
          const result = evaluate(text, provider);
          return result;
        } catch (error) {
          return helpers.makeError(helpers.FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: error evaluating expression`);
        }
      }
      default:
        return helpers.makeValue(FSDataType.String, text);
    }
  }
}

module.exports = {
  ParseTextFunction
};
