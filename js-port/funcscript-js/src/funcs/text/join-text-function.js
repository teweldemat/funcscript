const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');
const { FSDataType } = require('../../core/fstypes');

class JoinTextFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'join';
    this.callType = CallType.Dual;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    const error = helpers.expectParamCount(this.symbol, parameters, this.maxParameters);
    if (error) {
      return error;
    }

    const list = helpers.ensureList(parameters.getParameter(provider, 0));
    if (!list) {
      return helpers.makeError(
        helpers.FsError.ERROR_TYPE_MISMATCH,
        `${this.symbol}: first parameter should be a list`
      );
    }

    const separatorResult = helpers.requireString(this.symbol, parameters.getParameter(provider, 1), 'separator');
    if (!separatorResult.ok) {
      return separatorResult.error;
    }
    const separator = separatorResult.value;

    const parts = [];
    for (const item of list) {
      if (item == null) continue;
      const str = helpers.assertTyped(item);
      if (helpers.typeOf(str) === FSDataType.Null) continue;
      parts.push(String(helpers.valueOf(str)));
    }

    return helpers.makeValue(FSDataType.String, parts.join(separator));
  }

  parName(index) {
    return index === 0 ? 'List' : index === 1 ? 'Separator' : '';
  }
}

module.exports = {
  JoinTextFunction
};
