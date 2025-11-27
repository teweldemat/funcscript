const { BaseFunction, CallType } = require('../../core/function-base');
const { ArrayFsList } = require('../../model/fs-list');
const helpers = require('../helpers');
const { FSDataType } = require('../../core/fstypes');

class FilterListFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'Filter';
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
        `${this.symbol} function: The first parameter should be ${this.parName(0)}`
      );
    }

    const fn = helpers.ensureFunction(parameters.getParameter(provider, 1));
    if (!fn) {
      return helpers.makeError(
        helpers.FsError.ERROR_TYPE_MISMATCH,
        `${this.symbol} function: The second parameter should be ${this.parName(1)}`
      );
    }

    const results = [];
    for (let i = 0; i < list.length; i += 1) {
      const args = new helpers.ArrayParameterList([
        list.get(i),
        helpers.makeValue(FSDataType.Integer, i)
      ]);
      const match = fn.evaluate(provider, args);
      const typedMatch = helpers.assertTyped(match);
      if (helpers.typeOf(typedMatch) === FSDataType.Boolean && helpers.valueOf(typedMatch)) {
        results.push(list.get(i));
      }
    }

    return helpers.makeValue(FSDataType.List, new ArrayFsList(results));
  }

  parName(index) {
    return index === 0 ? 'List' : index === 1 ? 'Filter Function' : '';
  }
}

module.exports = {
  FilterListFunction
};
