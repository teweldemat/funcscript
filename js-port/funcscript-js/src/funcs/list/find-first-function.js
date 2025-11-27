const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');

class FindFirstFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'First';
    this.callType = CallType.Dual;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    const error = helpers.expectParamCount(this.symbol, parameters, this.maxParameters);
    if (error) {
      return error;
    }

    const list = helpers.ensureList(parameters.getParameter(provider, 0));
    if (!list) {
      return helpers.makeError(
        helpers.FsError.ERROR_TYPE_MISMATCH,
        `${this.symbol} function: The first parameter should be ${this.parName(0)}`
      );
    }

    const fn = helpers.ensureFunction(parameters.getParameter(provider, 1));
    if (!fn) {
      return helpers.makeError(
        helpers.FsError.ERROR_TYPE_MISMATCH,
        `${this.symbol} function: The second parameter should be ${this.parName(1)}`
      );
    }

    for (let i = 0; i < list.length; i += 1) {
      const args = new helpers.ArrayParameterList([
        list.get(i),
        helpers.makeValue(helpers.FSDataType.Integer, i)
      ]);
      const result = helpers.assertTyped(fn.evaluate(provider, args));
      if (helpers.typeOf(result) === helpers.FSDataType.Boolean && helpers.valueOf(result)) {
        return list.get(i);
      }
    }

    return helpers.typedNull();
  }

  parName(index) {
    return index === 0 ? 'List' : index === 1 ? 'Filter Function' : '';
  }
}

module.exports = {
  FindFirstFunction
};
