const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');
const { FSDataType } = require('../../core/fstypes');
const { ArrayFsList } = require('../../model/fs-list');

class LengthFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'Length';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const error = helpers.expectParamCount(this.symbol, parameters, this.maxParameters);
    if (error) {
      return error;
    }

    const typedArg = helpers.assertTyped(parameters.getParameter(provider, 0));
    const argType = helpers.typeOf(typedArg);

    if (argType === FSDataType.Null) {
      return helpers.makeValue(FSDataType.Integer, 0);
    }

    if (argType === FSDataType.List) {
      return helpers.makeValue(FSDataType.Integer, helpers.valueOf(typedArg).length);
    }

    if (argType === FSDataType.String) {
      const text = helpers.valueOf(typedArg) ?? '';
      return helpers.makeValue(FSDataType.Integer, text.length);
    }

    return helpers.makeValue(FSDataType.Integer, 1);
  }

  parName(index) {
    return index === 0 ? 'List or String' : '';
  }
}

module.exports = {
  LengthFunction
};
