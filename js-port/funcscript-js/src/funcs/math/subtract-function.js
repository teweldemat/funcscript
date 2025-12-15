const { BaseFunction, CallType } = require('../../core/function-base');
const { assertTyped, typeOf, valueOf, makeValue, typedNull } = require('../../core/value');
const { FSDataType } = require('../../core/fstypes');

class SubtractFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = '-';
    this.callType = CallType.Infix;
    this.precidence = 100;
  }

  evaluate(provider, parameters) {
    if (parameters.count === 0) {
      return typedNull();
    }

    const first = assertTyped(parameters.getParameter(provider, 0));
    let mode = typeOf(first);

    let intTotal = 0;
    let longTotal = 0n;
    let doubleTotal = 0;

    if (mode === FSDataType.Integer) {
      intTotal = valueOf(first);
    } else if (mode === FSDataType.BigInteger) {
      longTotal = valueOf(first);
    } else if (mode === FSDataType.Float) {
      doubleTotal = valueOf(first);
    } else {
      return typedNull();
    }

    for (let i = 1; i < parameters.count; i += 1) {
      const operand = assertTyped(parameters.getParameter(provider, i));
      const operandType = typeOf(operand);

      if (mode === FSDataType.Integer) {
        if (operandType === FSDataType.Integer) {
          intTotal -= valueOf(operand);
        } else if (operandType === FSDataType.BigInteger) {
          mode = FSDataType.BigInteger;
          longTotal = BigInt(intTotal) - valueOf(operand);
        } else if (operandType === FSDataType.Float) {
          mode = FSDataType.Float;
          doubleTotal = intTotal - valueOf(operand);
        }
      } else if (mode === FSDataType.BigInteger) {
        if (operandType === FSDataType.Integer) {
          longTotal -= BigInt(valueOf(operand));
        } else if (operandType === FSDataType.BigInteger) {
          longTotal -= valueOf(operand);
        } else if (operandType === FSDataType.Float) {
          mode = FSDataType.Float;
          doubleTotal = Number(longTotal) - valueOf(operand);
        }
      } else if (mode === FSDataType.Float) {
        if (operandType === FSDataType.Integer) {
          doubleTotal -= valueOf(operand);
        } else if (operandType === FSDataType.BigInteger) {
          doubleTotal -= Number(valueOf(operand));
        } else if (operandType === FSDataType.Float) {
          doubleTotal -= valueOf(operand);
        }
      }
    }

    if (mode === FSDataType.Float) {
      return makeValue(FSDataType.Float, doubleTotal);
    }
    if (mode === FSDataType.BigInteger) {
      return makeValue(FSDataType.BigInteger, longTotal);
    }
    return makeValue(FSDataType.Integer, intTotal);
  }
}

module.exports = {
  SubtractFunction
};
