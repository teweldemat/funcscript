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
      const condition = helpers.assertTyped(parameters.getParameter(provider, 2 * i));
      const conditionType = helpers.typeOf(condition);

      if (conditionType === helpers.FSDataType.Error) {
        return condition;
      }

      let conditionValue;
      if (conditionType === helpers.FSDataType.Boolean) {
        conditionValue = helpers.valueOf(condition);
      } else if (conditionType === helpers.FSDataType.Null) {
        conditionValue = false;
      } else {
        conditionValue = true;
      }

      if (conditionValue) {
        return helpers.assertTyped(parameters.getParameter(provider, 2 * i + 1));
      }
    }
    if (count % 2 === 1) {
      return helpers.assertTyped(parameters.getParameter(provider, count - 1));
    }
    return helpers.typedNull();
  }
}

module.exports = {
  CaseFunction
};
