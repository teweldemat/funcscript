const { BaseFunction, CallType } = require('../../core/function-base');
const { assertTyped, typeOf, valueOf, makeValue, typedNull } = require('../../core/value');
const { FSDataType } = require('../../core/fstypes');

class SwitchFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'switch';
    this.callType = CallType.Prefix;
  }

  evaluate(provider, parameters) {
    if (parameters.count === 0) {
      return typedNull();
    }
    const selector = assertTyped(parameters.getParameter(provider, 0));
    const selectorType = typeOf(selector);
    const selectorValue = valueOf(selector);

    for (let i = 1; i < parameters.count - 1; i += 2) {
      const key = assertTyped(parameters.getParameter(provider, i));
      const value = parameters.getParameter(provider, i + 1);
      if (typeOf(key) === selectorType && valueOf(key) === selectorValue) {
        return assertTyped(value);
      }
    }

    if (parameters.count % 2 === 0) {
      return assertTyped(parameters.getParameter(provider, parameters.count - 1));
    }

    return typedNull();
  }
}

module.exports = {
  SwitchFunction
};
