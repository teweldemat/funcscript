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

    const startTyped = helpers.assertTyped(parameters.getParameter(provider, 0));
    if (!helpers.isNumeric(startTyped)) {
      return helpers.makeError(helpers.FsError.ERROR_TYPE_MISMATCH, `${this.symbol}: start must be a number`);
    }

    const countTyped = helpers.assertTyped(parameters.getParameter(provider, 1));
    if (!helpers.isNumeric(countTyped)) {
      return helpers.makeError(helpers.FsError.ERROR_TYPE_MISMATCH, `${this.symbol}: count must be a number`);
    }

    const countRaw = helpers.valueOf(countTyped);
    const countNumber = Number(countRaw);
    if (!Number.isFinite(countNumber)) {
      return helpers.makeError(helpers.FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: count must be a finite number`);
    }

    const count = Math.trunc(countNumber);
    if (count <= 0) {
      return helpers.makeValue(FSDataType.List, new ArrayFsList([]));
    }

    const startType = helpers.typeOf(startTyped);
    const start = helpers.valueOf(startTyped);
    const values = [];
    for (let i = 0; i < count; i += 1) {
      if (startType === FSDataType.BigInteger) {
        values.push(helpers.makeValue(FSDataType.BigInteger, start + BigInt(i)));
      } else if (startType === FSDataType.Float) {
        values.push(helpers.makeValue(FSDataType.Float, start + i));
      } else {
        values.push(helpers.makeValue(FSDataType.Integer, start + i));
      }
    }
    return helpers.makeValue(FSDataType.List, new ArrayFsList(values));
  }
}

module.exports = {
  RangeFunction
};
