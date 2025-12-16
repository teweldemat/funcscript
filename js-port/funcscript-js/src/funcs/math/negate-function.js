const { BaseFunction, CallType } = require('../../core/function-base');
const { assertTyped, typeOf, valueOf, makeValue } = require('../../core/value');
const { FSDataType } = require('../../core/fstypes');

class NegateFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = '-';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const operand = assertTyped(parameters.getParameter(provider, 0));
    switch (typeOf(operand)) {
      case FSDataType.Error:
        return operand;
      case FSDataType.Integer:
        return makeValue(FSDataType.Integer, -valueOf(operand));
      case FSDataType.Float:
        return makeValue(FSDataType.Float, -valueOf(operand));
      case FSDataType.BigInteger:
        return makeValue(FSDataType.BigInteger, -valueOf(operand));
      default:
        throw new Error('Numeric operand expected for unary minus');
    }
  }
}

module.exports = {
  NegateFunction
};
