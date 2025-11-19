const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');

function formatLogValue(input) {
  const typed = helpers.ensureTyped(input);
  const value = helpers.valueOf(typed);
  return value === null || typeof value === 'undefined' ? '<null>' : value;
}

function writeLog(input) {
  console.log('FuncScript:', formatLogValue(input));
}

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
        const result = fn.evaluate(provider, args);
        writeLog(typeof result === 'undefined' ? helpers.typedNull() : result);
      } else {
        writeLog(handlerParam);
      }
    }

    return value;
  }
}

module.exports = {
  LogFunction
};
