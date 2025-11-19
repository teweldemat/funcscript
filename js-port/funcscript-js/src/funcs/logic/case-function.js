const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');

class CaseFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'case';
    this.callType = CallType.Prefix;
  }

  evaluate(provider, parameters) {
    const count = parameters.count;
    for (let i = 0; i < Math.floor(count / 2); i += 1) {
      const condition = helpers.ensureTyped(parameters.getParameter(provider, 2 * i));
      const conditionType = helpers.typeOf(condition);

      if (conditionType === helpers.FSDataType.Error) {
        return condition;
      }

      if (conditionType !== helpers.FSDataType.Boolean) {
        return helpers.makeError(
          helpers.FsError.ERROR_TYPE_MISMATCH,
          `${this.symbol}: Condition ${i + 1} must evaluate to a boolean value.`
        );
      }

      if (helpers.valueOf(condition)) {
        return helpers.ensureTyped(parameters.getParameter(provider, 2 * i + 1));
      }
    }
    if (count % 2 === 1) {
      return helpers.ensureTyped(parameters.getParameter(provider, count - 1));
    }
    return helpers.typedNull();
  }
}

module.exports = {
  CaseFunction
};
