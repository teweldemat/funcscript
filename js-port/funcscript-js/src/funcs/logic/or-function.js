const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');

class OrFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'or';
    this.callType = CallType.Infix;
    this.precidence = 400;
  }

  get maxParameters() {
    return -1;
  }

  evaluate(provider, parameters) {
    const count = parameters.count;
    let hasBooleanValue = false;
    for (let i = 0; i < count; i += 1) {
      const param = parameters.getParameter(provider, i);
      const paramType = helpers.typeOf(param);
      if (paramType === helpers.FSDataType.Null) {
        continue;
      }
      if (paramType !== helpers.FSDataType.Boolean) {
        return helpers.makeError(
          helpers.FsError.ERROR_TYPE_MISMATCH,
          `${this.symbol} doesn't apply to this type: ${paramType}`
        );
      }
      hasBooleanValue = true;
      if (helpers.valueOf(param)) {
        return helpers.makeValue(helpers.FSDataType.Boolean, true);
      }
    }
    if (!hasBooleanValue) {
      return helpers.typedNull();
    }
    return helpers.makeValue(helpers.FSDataType.Boolean, false);
  }
}

module.exports = {
  OrFunction
};
