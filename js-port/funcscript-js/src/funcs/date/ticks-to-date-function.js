const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');
const { FSDataType } = require('../../core/fstypes');

const TICKS_PER_MILLISECOND = 10000;
const EPOCH_TICKS = 621355968000000000n; // .NET ticks at Unix epoch

class TicksToDateFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'tickstodate';
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

    const ticksValue = helpers.ensureTyped(parameters.getParameter(provider, 0));
    if (helpers.typeOf(ticksValue) !== FSDataType.BigInteger && helpers.typeOf(ticksValue) !== FSDataType.Integer) {
      return helpers.makeError(helpers.FsError.ERROR_TYPE_MISMATCH, `${this.symbol}: ticks must be an integer`);
    }

    const ticks = helpers.typeOf(ticksValue) === FSDataType.BigInteger
      ? helpers.valueOf(ticksValue)
      : BigInt(helpers.valueOf(ticksValue));

    const unixTicks = ticks - EPOCH_TICKS;
    const milliseconds = Number(unixTicks / BigInt(TICKS_PER_MILLISECOND));
    const date = new Date(milliseconds);

    if (Number.isNaN(date.getTime())) {
      return helpers.makeError(helpers.FsError.ERROR_TYPE_INVALID_PARAMETER, `${this.symbol}: invalid tick value`);
    }

    return helpers.makeValue(FSDataType.DateTime, date);
  }
}

module.exports = {
  TicksToDateFunction
};
