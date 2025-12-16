const { BaseFunction, CallType } = require('../../core/function-base');
const { assertTyped, typeOf, valueOf, makeValue, typedNull } = require('../../core/value');
const { FSDataType } = require('../../core/fstypes');

class MultiplyFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = '*';
    this.callType = CallType.Infix;
    this.precidence = 50;
  }

  evaluate(provider, parameters) {
    let mode = null;
    let intTotal = 1;
    let longTotal = 1n;
    let doubleTotal = 1.0;

    for (let i = 0; i < parameters.count; i += 1) {
      const operand = assertTyped(parameters.getParameter(provider, i));
      const operandType = typeOf(operand);
      if (operandType === FSDataType.Error) {
        return operand;
      }

      if (mode === null) {
        if (operandType === FSDataType.Integer) {
          mode = FSDataType.Integer;
        } else if (operandType === FSDataType.BigInteger) {
          mode = FSDataType.BigInteger;
        } else if (operandType === FSDataType.Float) {
          mode = FSDataType.Float;
        }
      }

      if (mode === FSDataType.Integer) {
        if (operandType === FSDataType.Integer) {
          intTotal *= valueOf(operand);
        } else if (operandType === FSDataType.BigInteger) {
          mode = FSDataType.BigInteger;
          longTotal = BigInt(intTotal) * valueOf(operand);
        } else if (operandType === FSDataType.Float) {
          mode = FSDataType.Float;
          doubleTotal = intTotal * valueOf(operand);
        }
      } else if (mode === FSDataType.BigInteger) {
        if (operandType === FSDataType.Integer) {
          longTotal *= BigInt(valueOf(operand));
        } else if (operandType === FSDataType.BigInteger) {
          longTotal *= valueOf(operand);
        } else if (operandType === FSDataType.Float) {
          mode = FSDataType.Float;
          doubleTotal = Number(longTotal) * valueOf(operand);
        }
      } else if (mode === FSDataType.Float) {
        if (operandType === FSDataType.Integer) {
          doubleTotal *= valueOf(operand);
        } else if (operandType === FSDataType.BigInteger) {
          doubleTotal *= Number(valueOf(operand));
        } else if (operandType === FSDataType.Float) {
          doubleTotal *= valueOf(operand);
        }
      }
    }

    if (mode === FSDataType.Float) {
      return makeValue(FSDataType.Float, doubleTotal);
    }
    if (mode === FSDataType.BigInteger) {
      return makeValue(FSDataType.BigInteger, longTotal);
    }
    if (mode === FSDataType.Integer) {
      return makeValue(FSDataType.Integer, intTotal);
    }
    return typedNull();
  }
}

module.exports = {
  MultiplyFunction
};
