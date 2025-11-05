const { BaseFunction, CallType } = require('../../core/function-base');
const { ArrayFsList } = require('../../model/fs-list');
const helpers = require('../helpers');
const { FSDataType } = require('../../core/fstypes');

class RangeFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'Range';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    const error = helpers.expectParamCount(this.symbol, parameters, this.maxParameters);
    if (error) {
      return error;
    }

    const startResult = helpers.requireInteger(this.symbol, parameters.getParameter(provider, 0), 'start');
    if (!startResult.ok) {
      return startResult.error;
    }

    const countResult = helpers.requireInteger(this.symbol, parameters.getParameter(provider, 1), 'count');
    if (!countResult.ok) {
      return countResult.error;
    }

    const start = startResult.value;
    const count = countResult.value;
    const values = [];
    for (let i = 0; i < count; i += 1) {
      values.push(helpers.makeValue(FSDataType.Integer, start + i));
    }
    return helpers.makeValue(FSDataType.List, new ArrayFsList(values));
  }
}

module.exports = {
  RangeFunction
};
