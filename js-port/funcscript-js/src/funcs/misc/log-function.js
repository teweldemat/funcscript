const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');

class LogFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'log';
    this.callType = CallType.Infix;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    if (parameters.count === 0) {
      return helpers.makeError(helpers.FsError.ERROR_PARAMETER_COUNT_MISMATCH, `${this.symbol}: value expected`);
    }

    if (parameters.count > this.maxParameters) {
      return helpers.makeError(
        helpers.FsError.ERROR_PARAMETER_COUNT_MISMATCH,
        `${this.symbol}: expected at most ${this.maxParameters} parameters, got ${parameters.count}`
      );
    }

    const value = helpers.ensureTyped(parameters.getParameter(provider, 0));

    if (parameters.count > 1) {
      const handlerParam = parameters.getParameter(provider, 1);
      const fn = helpers.ensureFunction(handlerParam);
      if (fn) {
        const args = new helpers.ArrayParameterList([value]);
        fn.evaluate(provider, args);
      } else {
        const message = helpers.ensureTyped(handlerParam);
        console.log('FuncScript:', helpers.valueOf(message));
      }
    }

    return value;
  }
}

module.exports = {
  LogFunction
};
