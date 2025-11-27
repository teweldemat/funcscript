const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');
const { FSDataType } = require('../../core/fstypes');

function appendValue(parts, value) {
  if (value == null) {
    return;
  }
  const typed = helpers.assertTyped(value);
  if (helpers.typeOf(typed) === FSDataType.List) {
    const list = helpers.valueOf(typed);
    for (const item of list) {
      appendValue(parts, item);
    }
  } else {
    const val = helpers.valueOf(typed);
    parts.push(val == null ? '' : String(val));
  }
}

class TemplateMergeFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = '_templatemerge';
    this.callType = CallType.Infix;
  }

  get maxParameters() {
    return -1;
  }

  evaluate(provider, parameters) {
    const parts = [];
    for (let i = 0; i < parameters.count; i += 1) {
      appendValue(parts, parameters.getParameter(provider, i));
    }
    return helpers.makeValue(FSDataType.String, parts.join(''));
  }
}

module.exports = {
  TemplateMergeFunction
};
