const { BaseFunction, CallType } = require('../../core/function-base');
const {
  assertTyped,
  typeOf,
  valueOf
} = require('../../core/value');
const { FSDataType } = require('../../core/fstypes');
const helpers = require('../helpers');

class ErrorFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'error';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    if (parameters.count < 1 || parameters.count > 2) {
      return helpers.makeError(
        helpers.FsError.ERROR_PARAMETER_COUNT_MISMATCH,
        `${this.symbol}: message and optional type expected`
      );
    }

    const messageTyped = assertTyped(parameters.getParameter(provider, 0));
    if (typeOf(messageTyped) !== FSDataType.String) {
      return helpers.makeError(
        helpers.FsError.ERROR_TYPE_MISMATCH,
        `${this.symbol}: message must be a string`
      );
    }

    let typeValue = helpers.FsError.ERROR_DEFAULT;
    if (parameters.count > 1) {
      const typeTyped = assertTyped(parameters.getParameter(provider, 1));
      const typeKind = typeOf(typeTyped);
      if (typeKind === FSDataType.Null) {
        typeValue = helpers.FsError.ERROR_DEFAULT;
      } else if (typeKind === FSDataType.String) {
        const raw = valueOf(typeTyped);
        typeValue = raw && raw.length > 0 ? raw : helpers.FsError.ERROR_DEFAULT;
      } else {
        return helpers.makeError(
          helpers.FsError.ERROR_TYPE_MISMATCH,
          `${this.symbol}: optional type must be a string`
        );
      }
    }

    const message = valueOf(messageTyped);
    return helpers.makeError(typeValue, message);
  }
}

module.exports = {
  ErrorFunction
};
