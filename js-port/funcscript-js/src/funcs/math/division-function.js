const { BaseFunction, CallType } = require('../../core/function-base');
const { assertTyped, typeOf, valueOf, makeValue } = require('../../core/value');
const { FSDataType } = require('../../core/fstypes');
const { makeError, FsError } = require('../helpers');

function isNumericType(type) {
  return type === FSDataType.Integer || type === FSDataType.Float || type === FSDataType.BigInteger;
}

class DivisionFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = '/';
    this.callType = CallType.Infix;
    this.precidence = 50;
  }

  evaluate(provider, parameters) {
    if (parameters.count === 0) {
      return makeError(FsError.ERROR_PARAMETER_COUNT_MISMATCH, `${this.symbol}: at least one operand required`);
    }

    let current = assertTyped(parameters.getParameter(provider, 0));
    let mode = typeOf(current);

    if (!isNumericType(mode)) {
      mode = FSDataType.Integer;
      current = makeValue(FSDataType.Integer, 1);
    }

    let intTotal = mode === FSDataType.Integer ? valueOf(current) : 1;
    let longTotal = mode === FSDataType.BigInteger ? valueOf(current) : 1n;
    let doubleTotal = mode === FSDataType.Float ? valueOf(current) : 1.0;

    const zeroError = () => makeError(FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: division by zero`);

    const promoteIntToLong = () => {
      if (mode !== FSDataType.Integer) {
        return;
      }
      mode = FSDataType.BigInteger;
      longTotal = BigInt(intTotal);
    };

    const promoteIntToDouble = () => {
      if (mode === FSDataType.Float) {
        return;
      }
      mode = FSDataType.Float;
      doubleTotal = Number(intTotal);
    };

    const promoteLongToDouble = () => {
      if (mode === FSDataType.Float) {
        return;
      }
      mode = FSDataType.Float;
      doubleTotal = Number(longTotal);
    };

    const divideDouble = (divisor) => {
      if (divisor === 0) {
        return zeroError();
      }
      doubleTotal /= divisor;
      return null;
    };

    const divideInt = (divisor) => {
      if (divisor === 0) {
        return zeroError();
      }
      if (intTotal % divisor === 0) {
        intTotal = Math.trunc(intTotal / divisor);
        return null;
      }
      promoteIntToDouble();
      return divideDouble(divisor);
    };

    const divideLong = (divisor) => {
      if (divisor === 0n) {
        return zeroError();
      }
      if (longTotal % divisor === 0n) {
        longTotal = longTotal / divisor;
        return null;
      }
      promoteLongToDouble();
      return divideDouble(Number(divisor));
    };

    for (let i = 1; i < parameters.count; i += 1) {
      const operand = assertTyped(parameters.getParameter(provider, i));
      const operandType = typeOf(operand);

      if (!isNumericType(operandType)) {
        return makeError(FsError.ERROR_TYPE_MISMATCH, `${this.symbol}: numeric operand expected`);
      }

      let error = null;
      if (mode === FSDataType.Integer) {
        if (operandType === FSDataType.Integer) {
          error = divideInt(valueOf(operand));
        } else if (operandType === FSDataType.BigInteger) {
          promoteIntToLong();
          error = divideLong(valueOf(operand));
        } else {
          promoteIntToDouble();
          error = divideDouble(Number(valueOf(operand)));
        }
      } else if (mode === FSDataType.BigInteger) {
        if (operandType === FSDataType.Float) {
          promoteLongToDouble();
          error = divideDouble(Number(valueOf(operand)));
        } else {
          const divisor = operandType === FSDataType.BigInteger ? valueOf(operand) : BigInt(valueOf(operand));
          error = divideLong(divisor);
        }
      } else {
        error = divideDouble(Number(valueOf(operand)));
      }

      if (error) {
        return error;
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
  DivisionFunction
};
