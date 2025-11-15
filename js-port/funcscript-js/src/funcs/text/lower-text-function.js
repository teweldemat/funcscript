const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');
const { FSDataType } = require('../../core/fstypes');

class LowerTextFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'lower';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const error = helpers.expectParamCount(this.symbol, parameters, this.maxParameters);
    if (error) {
      return error;
    }

    const value = helpers.ensureTyped(parameters.getParameter(provider, 0));
    if (helpers.typeOf(value) === FSDataType.Null) {
      return helpers.typedNull();
    }
    if (helpers.typeOf(value) !== FSDataType.String) {
      return helpers.makeError(helpers.FsError.ERROR_TYPE_MISMATCH, `${this.symbol}: string parameter expected`);
    }

    const text = helpers.valueOf(value);
    return helpers.makeValue(FSDataType.String, text.toLowerCase());
  }

  parName(index) {
    return index === 0 ? 'text' : '';
  }
}

module.exports = {
  LowerTextFunction
};
