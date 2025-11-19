const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');

class ReplaceIfNullFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = '??';
    this.callType = CallType.Infix;
    this.precidence = 0;
  }

  evaluate(provider, parameters) {
    if (parameters.count < 2) {
      return helpers.makeError(helpers.FsError.ERROR_PARAMETER_COUNT_MISMATCH,
        `${this.symbol}: expected at least 2 parameters but got ${parameters.count}`);
    }

    for (let i = 0; i < parameters.count; i += 1) {
      const candidate = parameters.getParameter(provider, i);
      if (helpers.typeOf(candidate) !== helpers.FSDataType.Null) {
        return candidate;
      }
    }

    return helpers.typedNull();
  }
}

module.exports = {
  ReplaceIfNullFunction
};
