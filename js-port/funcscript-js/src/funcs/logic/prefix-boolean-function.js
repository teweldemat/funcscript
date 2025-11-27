const { BaseFunction, CallType } = require('../../core/function-base');
const { assertTyped, typeOf, valueOf, makeValue } = require('../../core/value');
const { FSDataType } = require('../../core/fstypes');
const { FsError } = require('../../model/fs-error');

class PrefixBooleanFunction extends BaseFunction {
  constructor(symbol, implementation) {
    super();
    this.symbol = symbol;
    this.callType = CallType.Prefix;
    this.implementation = implementation;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const operand = assertTyped(parameters.getParameter(provider, 0));
    if (typeOf(operand) !== FSDataType.Boolean) {
      return makeValue(
        FSDataType.Error,
        new FsError(FsError.ERROR_TYPE_MISMATCH, `${this.symbol} expects a boolean operand`)
      );
    }
    const result = this.implementation(valueOf(operand));
    return makeValue(FSDataType.Boolean, result);
  }
}

module.exports = {
  PrefixBooleanFunction
};
