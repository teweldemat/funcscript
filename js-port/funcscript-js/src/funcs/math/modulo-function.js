const { BaseFunction, CallType } = require('../../core/function-base');
const { makeValue, assertTyped, convertToCommonNumericType, typeOf, valueOf, typedNull } = require('../../core/value');
const { FSDataType } = require('../../core/fstypes');
const { makeError, FsError } = require('../helpers');

class ModuloFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = '%';
    this.callType = CallType.Infix;
    this.precidence = 50;
  }

  get maxParameters() {
    return -1;
  }

  evaluate(provider, parameters) {
    if (parameters.count === 0) {
      return typedNull();
    }

    let current = assertTyped(parameters.getParameter(provider, 0));
    let mode = typeOf(current);
    if (mode === FSDataType.Error) {
      return current;
    }

    if (!isNumericType(mode)) {
      current = makeValue(FSDataType.Integer, 1);
      mode = FSDataType.Integer;
    }

    for (let i = 1; i < parameters.count; i += 1) {
      let next = assertTyped(parameters.getParameter(provider, i));
      const nextType = typeOf(next);
      if (nextType === FSDataType.Error) {
        return next;
      }
      if (!isNumericType(nextType)) {
        continue;
      }

      [current, next] = convertToCommonNumericType(current, next);
      mode = typeOf(current);

      const divisor = valueOf(next);
      if (divisor === 0 || divisor === 0n) {
        return makeError(FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: division by zero`);
      }

      const currentValue = valueOf(current);
      let result;
      if (mode === FSDataType.Integer) {
        result = currentValue % divisor;
      } else if (mode === FSDataType.BigInteger) {
        result = currentValue % divisor;
      } else {
        result = currentValue % Number(divisor);
      }

      current = makeValue(mode === FSDataType.BigInteger ? FSDataType.BigInteger : mode, result);
    }

    return current;
  }
}

function isNumericType(t) {
  return t === FSDataType.Integer || t === FSDataType.Float || t === FSDataType.BigInteger;
}

module.exports = {
  ModuloFunction
};
