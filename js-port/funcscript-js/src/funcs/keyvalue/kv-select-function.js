const { BaseFunction, CallType } = require('../../core/function-base');
const { SimpleKeyValueCollection } = require('../../model/key-value-collection');
const helpers = require('../helpers');

class KvSelectFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'Select';
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

    const sourceTyped = helpers.assertTyped(parameters.getParameter(provider, 0));
    if (helpers.typeOf(sourceTyped) !== helpers.FSDataType.KeyValueCollection) {
      return helpers.makeError(
        helpers.FsError.ERROR_TYPE_MISMATCH,
        `${this.symbol} function: The first parameter should be ${this.parName(0)}`
      );
    }

    const selectionTyped = helpers.assertTyped(parameters.getParameter(provider, 1));
    if (helpers.typeOf(selectionTyped) !== helpers.FSDataType.KeyValueCollection) {
      return helpers.makeError(
        helpers.FsError.ERROR_TYPE_MISMATCH,
        `${this.symbol} function: The second parameter should be ${this.parName(1)}`
      );
    }

    const source = helpers.valueOf(sourceTyped);
    const selection = helpers.valueOf(selectionTyped);
    const projectedEntries = [];

    for (const [key, value] of selection.getAll()) {
      let resolved = value;
      if (!resolved || helpers.typeOf(resolved) === helpers.FSDataType.Null) {
        resolved = source.get(key);
      }
      projectedEntries.push([key, resolved]);
    }

    return helpers.makeValue(
      helpers.FSDataType.KeyValueCollection,
      new SimpleKeyValueCollection(provider, projectedEntries)
    );
  }

  parName(index) {
    return index === 0 ? 'Source KVC' : index === 1 ? 'Target KVC' : '';
  }
}

module.exports = {
  KvSelectFunction
};
