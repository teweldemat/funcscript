const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');
const { FSDataType } = require('../../core/fstypes');

class IsBlankFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'isblank';
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

    const value = helpers.assertTyped(parameters.getParameter(provider, 0));
    if (helpers.typeOf(value) === helpers.FSDataType.Null) {
      return helpers.makeValue(FSDataType.Boolean, true);
    }
    if (helpers.typeOf(value) !== FSDataType.String) {
      return helpers.makeError(helpers.FsError.ERROR_TYPE_MISMATCH, `${this.symbol}: string expected`);
    }
    const text = helpers.valueOf(value);
    return helpers.makeValue(FSDataType.Boolean, text.trim().length === 0);
  }
}

module.exports = {
  IsBlankFunction
};
