const { BaseFunction, CallType } = require('../../core/function-base');
const { ensureTyped, typeOf, valueOf, makeValue } = require('../../core/value');
const { FSDataType } = require('../../core/fstypes');
const { FsError } = require('../../model/fs-error');

class IFFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'If';
    this.callType = CallType.Infix;
  }

  get maxParameters() {
    return 3;
  }

  evaluate(provider, parameters) {
    const condition = ensureTyped(parameters.getParameter(provider, 0));
    const conditionType = typeOf(condition);

    if (conditionType === FSDataType.Error) {
      return condition;
    }

    if (conditionType !== FSDataType.Boolean) {
      return makeValue(
        FSDataType.Error,
        new FsError(FsError.ERROR_TYPE_MISMATCH, `${this.symbol}: The first parameter must be a boolean value.`)
      );
    }

    const conditionValue = valueOf(condition);

    if (conditionValue) {
      if (parameters.count > 1) {
        return ensureTyped(parameters.getParameter(provider, 1));
      }
      return ensureTyped(condition);
    }

    if (parameters.count > 2) {
      return ensureTyped(parameters.getParameter(provider, 2));
    }
    return ensureTyped(condition);
  }

}

module.exports = {
  IFFunction
};
