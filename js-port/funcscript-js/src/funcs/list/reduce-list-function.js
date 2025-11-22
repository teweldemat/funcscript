const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');
const { FSDataType } = require('../../core/fstypes');
const { ArrayFsList } = require('../../model/fs-list');

class ReduceListFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'Reduce';
    this.callType = CallType.Dual;
  }

  get maxParameters() {
    return 3;
  }

  evaluate(provider, parameters) {
    if (parameters.count !== 2 && parameters.count !== 3) {
      return helpers.makeError(
        helpers.FsError.ERROR_PARAMETER_COUNT_MISMATCH,
        `${this.symbol}: expected 2 or 3 got ${parameters.count}`
      );
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

    let total;
    let indexStart = 0;

    if (parameters.count === 3) {
      total = parameters.getParameter(provider, 2);
    } else {
      if (list.length === 0) {
        return helpers.typedNull();
      }
      total = list.get(0);
      indexStart = 1;
    }

    for (let i = indexStart; i < list.length; i += 1) {
      const args = new helpers.ArrayParameterList([
        list.get(i),
        total,
        helpers.makeValue(FSDataType.Integer, i)
      ]);
      total = fn.evaluate(provider, args);
    }

    return helpers.ensureTyped(total);
  }

  parName(index) {
    return index === 0 ? 'List' : index === 1 ? 'Transform Function' : 'Seed';
  }
}

module.exports = {
  ReduceListFunction
};
