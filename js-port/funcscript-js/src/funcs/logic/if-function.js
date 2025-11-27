const { BaseFunction, CallType } = require('../../core/function-base');
const { assertTyped, typeOf, valueOf, makeValue } = require('../../core/value');
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
    const condition = assertTyped(parameters.getParameter(provider, 0));
    const conditionType = typeOf(condition);

    if (conditionType === FSDataType.Error) {
      return condition;
    }

    let conditionValue;
    if (conditionType === FSDataType.Boolean) {
      conditionValue = valueOf(condition);
    } else if (conditionType === FSDataType.Null) {
      conditionValue = false;
    } else {
      conditionValue = true;
    }

    if (conditionValue) {
      if (parameters.count > 1) {
        return assertTyped(parameters.getParameter(provider, 1));
      }
      return assertTyped(condition);
    }

    if (parameters.count > 2) {
      return assertTyped(parameters.getParameter(provider, 2));
    }
    return assertTyped(condition);
  }

}

module.exports = {
  IFFunction
};
