const { BaseFunction, CallType } = require('../../core/function-base');
const { assertTyped, typeOf, valueOf, makeValue } = require('../../core/value');
const { FSDataType } = require('../../core/fstypes');
const { makeError, FsError } = require('../helpers');

function ensureNumeric(symbol, parameter, parameterName = 'number') {
  const typed = assertTyped(parameter);
  if (typeOf(typed) === FSDataType.Integer || typeOf(typed) === FSDataType.Float || typeOf(typed) === FSDataType.BigInteger) {
    return { ok: true, value: Number(valueOf(typed)) };
  }
  return { ok: false, error: makeError(FsError.ERROR_TYPE_MISMATCH, `${symbol}: ${parameterName} expected`) };
}

class SineFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'sin';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0));
    if (!result.ok) {
      return result.error;
    }
    return makeValue(FSDataType.Float, Math.sin(result.value));
  }
}

class CosineFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'cos';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0));
    if (!result.ok) {
      return result.error;
    }
    return makeValue(FSDataType.Float, Math.cos(result.value));
  }
}

class TangentFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'tan';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0));
    if (!result.ok) {
      return result.error;
    }
    return makeValue(FSDataType.Float, Math.tan(result.value));
  }
}

class ArcSineFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'asin';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0));
    if (!result.ok) {
      return result.error;
    }
    return makeValue(FSDataType.Float, Math.asin(result.value));
  }
}

class ArcCosineFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'acos';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0));
    if (!result.ok) {
      return result.error;
    }
    return makeValue(FSDataType.Float, Math.acos(result.value));
  }
}

class ArcTangentFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'atan';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0));
    if (!result.ok) {
      return result.error;
    }
    return makeValue(FSDataType.Float, Math.atan(result.value));
  }
}

class HyperbolicSineFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'sinh';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0));
    if (!result.ok) {
      return result.error;
    }
    return makeValue(FSDataType.Float, Math.sinh(result.value));
  }
}

class HyperbolicCosineFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'cosh';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0));
    if (!result.ok) {
      return result.error;
    }
    return makeValue(FSDataType.Float, Math.cosh(result.value));
  }
}

class HyperbolicTangentFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'tanh';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0));
    if (!result.ok) {
      return result.error;
    }
    return makeValue(FSDataType.Float, Math.tanh(result.value));
  }
}

class InverseHyperbolicSineFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'asinh';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0));
    if (!result.ok) {
      return result.error;
    }
    return makeValue(FSDataType.Float, Math.asinh(result.value));
  }
}

class InverseHyperbolicCosineFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'acosh';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0));
    if (!result.ok) {
      return result.error;
    }
    if (result.value < 1) {
      return makeError(FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: number must be greater than or equal to 1`);
    }
    return makeValue(FSDataType.Float, Math.acosh(result.value));
  }
}

class InverseHyperbolicTangentFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'atanh';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const result = ensureNumeric(this.symbol, parameters.getParameter(provider, 0));
    if (!result.ok) {
      return result.error;
    }
    if (result.value <= -1 || result.value >= 1) {
      return makeError(FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: number must be between -1 and 1 (exclusive)`);
    }
    return makeValue(FSDataType.Float, Math.atanh(result.value));
  }
}

class ArcTangent2Function extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'atan2';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    const y = ensureNumeric(this.symbol, parameters.getParameter(provider, 0), 'y');
    if (!y.ok) {
      return y.error;
    }
    const x = ensureNumeric(this.symbol, parameters.getParameter(provider, 1), 'x');
    if (!x.ok) {
      return x.error;
    }
    return makeValue(FSDataType.Float, Math.atan2(y.value, x.value));
  }
}

module.exports = {
  SineFunction,
  CosineFunction,
  TangentFunction,
  ArcSineFunction,
  ArcCosineFunction,
  ArcTangentFunction,
  HyperbolicSineFunction,
  HyperbolicCosineFunction,
  HyperbolicTangentFunction,
  InverseHyperbolicSineFunction,
  InverseHyperbolicCosineFunction,
  InverseHyperbolicTangentFunction,
  ArcTangent2Function
};
