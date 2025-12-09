const { BaseFunction, CallType } = require('../../core/function-base');
const { KeyValueCollection } = require('../../model/key-value-collection');
const helpers = require('../helpers');
const { requireString } = helpers;

class KvcMemberFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = '.';
    this.callType = CallType.Infix;
    this.precidence = 200;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    const error = helpers.expectParamCount(this.symbol, parameters, this.maxParameters);
    if (error) {
      return error;
    }

    const target = parameters.getParameter(provider, 0);
    const keyResult = requireString(this.symbol, parameters.getParameter(provider, 1), 'Member key');
    if (!keyResult.ok) {
      return keyResult.error;
    }

    if (helpers.typeOf(target) === helpers.FSDataType.Null) {
      return helpers.makeError(helpers.FsError.ERROR_TYPE_MISMATCH, `${this.symbol} function: Can't get member from null`);
    }

    const typedTarget = helpers.assertTyped(target);
    if (helpers.typeOf(typedTarget) !== helpers.FSDataType.KeyValueCollection) {
      return helpers.makeError(
        helpers.FsError.ERROR_TYPE_MISMATCH,
        `${this.symbol} function: Can't get member ${keyResult.value} from ${helpers.typeOf(typedTarget)}`
      );
    }

    const collection = helpers.valueOf(typedTarget);
    const keyLower = keyResult.value.toLowerCase();
    if (!collection.isDefined(keyLower, false)) {
      return helpers.typedNull();
    }
    const entry = collection.get(keyLower);
    if (entry === null || entry === undefined) {
      return helpers.typedNull();
    }
    return helpers.assertTyped(entry);
  }

  parName(index) {
    return index === 0 ? 'Key-value collection' : index === 1 ? 'Member key' : '';
  }
}

module.exports = {
  KvcMemberFunction
};
