const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');

class InFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'in';
    this.callType = CallType.Infix;
    this.precidence = 150;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    const error = helpers.expectParamCount(this.symbol, parameters, this.maxParameters);
    if (error) {
      return error;
    }

    const target = helpers.assertTyped(parameters.getParameter(provider, 0));
    const rawList = helpers.assertTyped(parameters.getParameter(provider, 1));

    if (helpers.typeOf(rawList) === helpers.FSDataType.Null) {
      return helpers.typedNull();
    }

    if (helpers.typeOf(rawList) !== helpers.FSDataType.List) {
      return helpers.makeError(
        helpers.FsError.ERROR_TYPE_MISMATCH,
        `${this.symbol}: second parameter must be a list`
      );
    }

    const list = helpers.valueOf(rawList);
    const targetNumeric = helpers.isNumeric(target);

    for (let i = 0; i < list.length; i += 1) {
      const item = list.get(i);
      if (!item || helpers.typeOf(item) === helpers.FSDataType.Null) {
        continue;
      }

      let left = target;
      let right = item;

      if (targetNumeric && helpers.isNumeric(item)) {
        [left, right] = helpers.convertToCommonNumericType(target, item);
      }

      if (helpers.typeOf(left) === helpers.FSDataType.Null || helpers.typeOf(right) === helpers.FSDataType.Null) {
        continue;
      }

      if (helpers.typeOf(left) !== helpers.typeOf(right)) {
        continue;
      }

      if (helpers.valueOf(left) === helpers.valueOf(right)) {
        return helpers.makeValue(helpers.FSDataType.Boolean, true);
      }
    }

    return helpers.makeValue(helpers.FSDataType.Boolean, false);
  }
}

module.exports = {
  InFunction
};
