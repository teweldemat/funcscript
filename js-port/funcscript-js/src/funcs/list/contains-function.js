const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');
const { makeValue, assertTyped, typeOf, valueOf } = require('../../core/value');
const { FSDataType } = require('../../core/fstypes');

class ContainsFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'Contains';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    const error = helpers.expectParamCount(this.symbol, parameters, this.maxParameters);
    if (error) {
      return error;
    }

    const container = parameters.getParameter(provider, 0);
    const item = parameters.getParameter(provider, 1);

    const list = helpers.ensureList(container);
    if (list) {
      for (const entry of list) {
        if (helpers.typeOf(entry) === helpers.typeOf(item) && helpers.valueOf(entry) === helpers.valueOf(item)) {
          return makeValue(FSDataType.Boolean, true);
        }
      }
      return makeValue(FSDataType.Boolean, false);
    }

    const contString = assertTyped(container);
    if (typeOf(contString) === FSDataType.String && typeOf(item) === FSDataType.String) {
      return makeValue(FSDataType.Boolean, valueOf(contString).toLowerCase().includes(valueOf(item).toLowerCase()));
    }

    return helpers.makeError(
      helpers.FsError.ERROR_TYPE_MISMATCH,
      `${this.symbol} function: Invalid types for parameters`
    );
  }
}

module.exports = {
  ContainsFunction
};
