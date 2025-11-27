const { BaseFunction, CallType } = require('../core/function-base');
const { assertTyped, normalize } = require('../core/value');
const { convertTypedValueToJs } = require('../core/fs-to-js');

class DelegateFunction extends BaseFunction {
  constructor(delegate) {
    super();
    if (typeof delegate !== 'function') {
      throw new Error('DelegateFunction requires a function');
    }
    this.delegate = delegate;
  }

  get maxParameters() {
    return -1;
  }

  evaluate(provider, parameters) {
    const args = [];
    const count = parameters ? parameters.count : 0;
    for (let i = 0; i < count; i += 1) {
      args.push(assertTyped(parameters.getParameter(provider, i), 'Delegate arguments must be typed'));
    }
    const jsArgs = args.map((arg) => convertTypedValueToJs(arg, provider));
    const result = this.delegate(...jsArgs);
    try {
      return assertTyped(result);
    } catch (error) {
      return normalize(result);
    }
  }

  get callType() {
    return CallType.Infix;
  }
}

module.exports = {
  DelegateFunction
};
