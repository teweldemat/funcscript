const { BaseFunction, CallType } = require('../../core/function-base');
const { ArrayFsList } = require('../../model/fs-list');
const helpers = require('../helpers');
const { FsError } = helpers;
const { FSDataType } = require('../../core/fstypes');

class SortListFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'Sort';
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
        FsError.ERROR_TYPE_MISMATCH,
        `${this.symbol} function: The first parameter should be ${this.parName(0)}`
      );
    }

    const fn = helpers.ensureFunction(parameters.getParameter(provider, 1));
    if (!fn) {
      return helpers.makeError(
        FsError.ERROR_TYPE_MISMATCH,
        `${this.symbol} function: The second parameter should be ${this.parName(1)}`
      );
    }

    const copy = [];
    for (let i = 0; i < list.length; i += 1) {
      copy.push(list.get(i));
    }

    copy.sort((left, right) => {
      const args = new helpers.ArrayParameterList([left, right]);
      const result = fn.evaluate(provider, args);
      const typedResult = helpers.assertTyped(result);
      if (helpers.typeOf(typedResult) !== FSDataType.Integer) {
        throw new Error(`${this.symbol} function: sorting function must return an integer`);
      }
      return helpers.valueOf(typedResult);
    });

    return helpers.makeValue(FSDataType.List, new ArrayFsList(copy));
  }

  parName(index) {
    return index === 0 ? 'List' : index === 1 ? 'Sorting Function' : '';
  }
}

module.exports = {
  SortListFunction
};
