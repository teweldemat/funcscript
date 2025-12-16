const { BaseFunction, CallType } = require('../../core/function-base');
const { assertTyped, typeOf, valueOf, makeValue, typedNull } = require('../../core/value');
const { FSDataType } = require('../../core/fstypes');
const { makeError, FsError } = require('../helpers');

class DivFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'div';
    this.callType = CallType.Infix;
    this.precidence = 50;
  }

  evaluate(provider, parameters) {
    if (parameters.count === 0) {
      return typedNull();
    }

    const first = assertTyped(parameters.getParameter(provider, 0));
    let mode = typeOf(first);
    if (mode === FSDataType.Error) {
      return first;
    }

    if (mode !== FSDataType.Integer && mode !== FSDataType.BigInteger) {
      return makeError(FsError.ERROR_TYPE_MISMATCH, `${this.symbol}: integer parameters expected`);
    }

    let intTotal = mode === FSDataType.Integer ? valueOf(first) : 0;
    let longTotal = mode === FSDataType.BigInteger ? valueOf(first) : 0n;

    for (let i = 1; i < parameters.count; i += 1) {
      const operand = assertTyped(parameters.getParameter(provider, i));
      const operandType = typeOf(operand);
      if (operandType === FSDataType.Error) {
        return operand;
      }

      if (operandType !== FSDataType.Integer && operandType !== FSDataType.BigInteger) {
        return makeError(FsError.ERROR_TYPE_MISMATCH, `${this.symbol}: integer parameters expected`);
      }

      if (operandType === FSDataType.Integer) {
        const divisor = valueOf(operand);
        if (divisor === 0) {
          return makeError(FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: division by zero`);
        }
        if (mode === FSDataType.Integer) {
          intTotal = Math.trunc(intTotal / divisor);
        } else {
          longTotal /= BigInt(divisor);
        }
      } else {
        if (mode === FSDataType.Integer) {
          mode = FSDataType.BigInteger;
          longTotal = BigInt(intTotal);
        }
        const divisor = valueOf(operand);
        if (divisor === 0n) {
          return makeError(FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: division by zero`);
        }
        longTotal /= divisor;
      }
    }

    if (mode === FSDataType.BigInteger) {
      return makeValue(FSDataType.BigInteger, longTotal);
    }
    return makeValue(FSDataType.Integer, intTotal);
  }
}

module.exports = {
  DivFunction
};
