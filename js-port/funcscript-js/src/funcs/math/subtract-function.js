const { BaseFunction, CallType } = require('../../core/function-base');
const { assertTyped, typeOf, valueOf, makeValue, convertToCommonNumericType } = require('../../core/value');
const { FSDataType } = require('../../core/fstypes');

function assertNumeric(typed) {
  const t = typeOf(typed);
  if (t !== FSDataType.Integer && t !== FSDataType.Float && t !== FSDataType.BigInteger) {
    throw new Error('Numeric operand expected');
  }
}

class SubtractFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = '-';
    this.callType = CallType.Infix;
  }

  evaluate(provider, parameters) {
    if (parameters.count === 0) {
      return makeValue(FSDataType.Integer, 0);
    }
    let result = assertTyped(parameters.getParameter(provider, 0));
    assertNumeric(result);

    for (let i = 1; i < parameters.count; i += 1) {
      const next = assertTyped(parameters.getParameter(provider, i));
      assertNumeric(next);
      let [left, right] = convertToCommonNumericType(result, next);
      if (typeOf(left) === FSDataType.BigInteger) {
        result = makeValue(FSDataType.BigInteger, valueOf(left) - valueOf(right));
      } else if (typeOf(left) === FSDataType.Float) {
        result = makeValue(FSDataType.Float, valueOf(left) - valueOf(right));
      } else {
        result = makeValue(FSDataType.Integer, valueOf(left) - valueOf(right));
      }
    }
    return result;
  }
}

module.exports = {
  SubtractFunction
};
