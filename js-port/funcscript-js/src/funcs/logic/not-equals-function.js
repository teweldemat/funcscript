const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');

class NotEqualsFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = '!=';
    this.callType = CallType.Infix;
    this.precidence = 200;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    const error = helpers.expectParamCount(this.symbol, parameters, this.maxParameters);
    if (error) {
      return error;
    }
    let left = parameters.getParameter(provider, 0);
    let right = parameters.getParameter(provider, 1);

    if (helpers.typeOf(left) === helpers.FSDataType.Error) {
      return left;
    }
    if (helpers.typeOf(right) === helpers.FSDataType.Error) {
      return right;
    }

    if (helpers.typeOf(left) === helpers.FSDataType.Null && helpers.typeOf(right) === helpers.FSDataType.Null) {
      return helpers.makeValue(helpers.FSDataType.Boolean, false);
    }
    if (helpers.typeOf(left) === helpers.FSDataType.Null || helpers.typeOf(right) === helpers.FSDataType.Null) {
      return helpers.makeValue(helpers.FSDataType.Boolean, true);
    }

    if (helpers.isNumeric(left) && helpers.isNumeric(right)) {
      [left, right] = helpers.convertToCommonNumericType(left, right);
    }

    if (helpers.typeOf(left) !== helpers.typeOf(right)) {
      return helpers.makeValue(helpers.FSDataType.Boolean, true);
    }

    return helpers.makeValue(helpers.FSDataType.Boolean, helpers.valueOf(left) !== helpers.valueOf(right));
  }
}

module.exports = {
  NotEqualsFunction
};
