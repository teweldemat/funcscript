const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');
const { FSDataType } = require('../../core/fstypes');

function ensureTyped(value) {
  return helpers.ensureTyped(value);
}

function formatValue(typed) {
  const type = helpers.typeOf(typed);
  const value = helpers.valueOf(typed);
  switch (type) {
    case FSDataType.Null:
      return 'null';
    case FSDataType.Boolean:
      return value ? 'true' : 'false';
    case FSDataType.Integer:
    case FSDataType.Float:
      return String(value);
    case FSDataType.BigInteger:
      return value.toString();
    case FSDataType.String:
      return JSON.stringify(value);
    case FSDataType.Error: {
      const err = value || {};
      return `${err.errorType || 'Error'}: ${err.errorMessage || ''}`;
    }
    case FSDataType.List:
      return '[list]';
    case FSDataType.KeyValueCollection:
      return '[object]';
    default:
      return String(value);
  }
}

function makeAssertionError(symbol, message) {
  return helpers.makeError('assert', `${symbol}: ${message}`);
}

function expectBoolean(symbol, typed) {
  const type = helpers.typeOf(typed);
  if (type !== FSDataType.Boolean) {
    return { ok: false, error: makeAssertionError(symbol, 'boolean expected') };
  }
  return { ok: true, value: helpers.valueOf(typed) === true };
}

function toNumber(symbol, value, label) {
  const typed = ensureTyped(value);
  const type = helpers.typeOf(typed);
  const raw = helpers.valueOf(typed);
  switch (type) {
    case FSDataType.Integer:
    case FSDataType.Float:
      return { ok: true, value: Number(raw) };
    case FSDataType.BigInteger:
      return { ok: true, value: Number(raw) };
    default:
      return { ok: false, error: makeAssertionError(symbol, `${label} must be numeric`) };
  }
}

function compareValues(left, right, symbol) {
  const comparison = helpers.compare(left, right, symbol);
  if (typeof comparison === 'number') {
    return { ok: true, value: comparison };
  }
  if (Array.isArray(comparison) && helpers.typeOf(comparison) === FSDataType.Error) {
    return { ok: false, error: comparison };
  }
  return { ok: false, error: makeAssertionError(symbol, 'Unable to compare values') };
}

function ensureErrorValue(symbol, typedValue) {
  if (helpers.typeOf(typedValue) !== FSDataType.Error) {
    return null;
  }
  return helpers.valueOf(typedValue) || {};
}

class AssertEqualFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'assert.equal';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    if (parameters.count !== 2) {
      return makeAssertionError(this.symbol, 'Expected two parameters');
    }
    const left = ensureTyped(parameters.getParameter(provider, 0));
    const right = ensureTyped(parameters.getParameter(provider, 1));
    const result = compareValues(left, right, this.symbol);
    if (!result.ok) {
      return result.error;
    }
    if (result.value === 0) {
      return helpers.makeValue(FSDataType.Boolean, true);
    }
    return makeAssertionError(this.symbol, `${formatValue(left)} != ${formatValue(right)}`);
  }

  parName(index) {
    return index === 0 ? 'left' : 'right';
  }
}

class AssertNotEqualFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'assert.notEqual';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    if (parameters.count !== 2) {
      return makeAssertionError(this.symbol, 'Expected two parameters');
    }
    const left = ensureTyped(parameters.getParameter(provider, 0));
    const right = ensureTyped(parameters.getParameter(provider, 1));
    const result = compareValues(left, right, this.symbol);
    if (!result.ok) {
      return result.error;
    }
    if (result.value !== 0) {
      return helpers.makeValue(FSDataType.Boolean, true);
    }
    return makeAssertionError(this.symbol, `${formatValue(left)} == ${formatValue(right)}`);
  }

  parName(index) {
    return index === 0 ? 'left' : 'right';
  }
}

class AssertGreaterFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'assert.greater';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    if (parameters.count !== 2) {
      return makeAssertionError(this.symbol, 'Expected two parameters');
    }
    const left = ensureTyped(parameters.getParameter(provider, 0));
    const right = ensureTyped(parameters.getParameter(provider, 1));
    const result = compareValues(left, right, this.symbol);
    if (!result.ok) {
      return result.error;
    }
    if (result.value > 0) {
      return helpers.makeValue(FSDataType.Boolean, true);
    }
    return makeAssertionError(this.symbol, `Expected ${formatValue(left)} > ${formatValue(right)}`);
  }

  parName(index) {
    return index === 0 ? 'left' : 'right';
  }
}

class AssertLessFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'assert.less';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    if (parameters.count !== 2) {
      return makeAssertionError(this.symbol, 'Expected two parameters');
    }
    const left = ensureTyped(parameters.getParameter(provider, 0));
    const right = ensureTyped(parameters.getParameter(provider, 1));
    const result = compareValues(left, right, this.symbol);
    if (!result.ok) {
      return result.error;
    }
    if (result.value < 0) {
      return helpers.makeValue(FSDataType.Boolean, true);
    }
    return makeAssertionError(this.symbol, `Expected ${formatValue(left)} < ${formatValue(right)}`);
  }

  parName(index) {
    return index === 0 ? 'left' : 'right';
  }
}

class AssertTrueFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'assert.true';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const error = helpers.expectParamCount(this.symbol, parameters, 1);
    if (error) {
      return error;
    }

    const typed = ensureTyped(parameters.getParameter(provider, 0));
    const boolResult = expectBoolean(this.symbol, typed);
    if (!boolResult.ok) {
      return boolResult.error;
    }
    if (boolResult.value) {
      return helpers.makeValue(FSDataType.Boolean, true);
    }
    return makeAssertionError(this.symbol, `Expected true but received ${formatValue(typed)}`);
  }
}

class AssertFalseFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'assert.false';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const error = helpers.expectParamCount(this.symbol, parameters, 1);
    if (error) {
      return error;
    }

    const typed = ensureTyped(parameters.getParameter(provider, 0));
    const boolResult = expectBoolean(this.symbol, typed);
    if (!boolResult.ok) {
      return boolResult.error;
    }
    if (!boolResult.value) {
      return helpers.makeValue(FSDataType.Boolean, true);
    }
    return makeAssertionError(this.symbol, `Expected false but received ${formatValue(typed)}`);
  }
}

class AssertApproxFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'assert.approx';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 3;
  }

  evaluate(provider, parameters) {
    if (parameters.count !== 3) {
      return makeAssertionError(this.symbol, 'Expected three parameters');
    }
    const left = ensureTyped(parameters.getParameter(provider, 0));
    const right = ensureTyped(parameters.getParameter(provider, 1));
    const epsilonTyped = ensureTyped(parameters.getParameter(provider, 2));

    const leftNumber = toNumber(this.symbol, left, 'left');
    if (!leftNumber.ok) {
      return leftNumber.error;
    }
    const rightNumber = toNumber(this.symbol, right, 'right');
    if (!rightNumber.ok) {
      return rightNumber.error;
    }
    const epsilonNumber = toNumber(this.symbol, epsilonTyped, 'epsilon');
    if (!epsilonNumber.ok) {
      return epsilonNumber.error;
    }

    const distance = Math.abs(leftNumber.value - rightNumber.value);
    const limit = Math.abs(epsilonNumber.value);
    if (distance <= limit) {
      return helpers.makeValue(FSDataType.Boolean, true);
    }
    return makeAssertionError(
      this.symbol,
      `|${leftNumber.value} - ${rightNumber.value}| = ${distance} > ${limit}`
    );
  }
}

class AssertNoErrorFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'assert.noerror';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const error = helpers.expectParamCount(this.symbol, parameters, 1);
    if (error) {
      return error;
    }
    const typed = ensureTyped(parameters.getParameter(provider, 0));
    if (helpers.typeOf(typed) !== FSDataType.Error) {
      return helpers.makeValue(FSDataType.Boolean, true);
    }
    const err = helpers.valueOf(typed) || {};
    return makeAssertionError(
      this.symbol,
      `Expected non-error result but received ${err.errorType || 'Error'}: ${err.errorMessage || ''}`
    );
  }
}

class AssertIsErrorFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'assert.iserror';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const error = helpers.expectParamCount(this.symbol, parameters, 1);
    if (error) {
      return error;
    }
    const typed = ensureTyped(parameters.getParameter(provider, 0));
    if (helpers.typeOf(typed) === FSDataType.Error) {
      return helpers.makeValue(FSDataType.Boolean, true);
    }
    return makeAssertionError(this.symbol, 'Expected an error result but value was not an error.');
  }
}

class AssertIsErrorTypeFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'assert.iserrortype';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    if (parameters.count !== 2) {
      return makeAssertionError(this.symbol, 'Expected value and type name');
    }
    const errorValue = ensureTyped(parameters.getParameter(provider, 0));
    const typeValue = helpers.requireString(this.symbol, parameters.getParameter(provider, 1), 'type');
    if (!typeValue.ok) {
      return typeValue.error;
    }

    const err = ensureErrorValue(this.symbol, errorValue);
    if (!err) {
      return makeAssertionError(this.symbol, 'Value is not an error result.');
    }
    const expected = typeValue.value.toLowerCase();
    const actual = (err.errorType || '').toLowerCase();
    if (actual === expected) {
      return helpers.makeValue(FSDataType.Boolean, true);
    }
    return makeAssertionError(
      this.symbol,
      `Expected error type ${expected || '(blank)'} but received ${actual || '(blank)'}`
    );
  }
}

class AssertHasErrorMessageFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'assert.hasErrorMessage';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    if (parameters.count !== 2) {
      return makeAssertionError(this.symbol, 'Expected value and message');
    }
    const errorValue = ensureTyped(parameters.getParameter(provider, 0));
    const messageValue = helpers.requireString(this.symbol, parameters.getParameter(provider, 1), 'message');
    if (!messageValue.ok) {
      return messageValue.error;
    }

    const err = ensureErrorValue(this.symbol, errorValue);
    if (!err) {
      return makeAssertionError(this.symbol, 'Value is not an error result.');
    }

    const expected = messageValue.value;
    const actual = err.errorMessage || '';
    const result = expected ? actual.includes(expected) : actual.length === 0;
    if (result) {
      return helpers.makeValue(FSDataType.Boolean, true);
    }
    return makeAssertionError(
      this.symbol,
      `Expected error message containing ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}`
    );
  }
}

class AssertIsNullFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'assert.isnull';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const error = helpers.expectParamCount(this.symbol, parameters, 1);
    if (error) {
      return error;
    }
    const typed = ensureTyped(parameters.getParameter(provider, 0));
    if (helpers.typeOf(typed) === FSDataType.Null) {
      return helpers.makeValue(FSDataType.Boolean, true);
    }
    return makeAssertionError(this.symbol, `Expected null but received ${formatValue(typed)}`);
  }
}

class AssertIsNotNullFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = 'assert.isnotnull';
    this.callType = CallType.Prefix;
  }

  get maxParameters() {
    return 1;
  }

  evaluate(provider, parameters) {
    const error = helpers.expectParamCount(this.symbol, parameters, 1);
    if (error) {
      return error;
    }
    const typed = ensureTyped(parameters.getParameter(provider, 0));
    if (helpers.typeOf(typed) !== FSDataType.Null) {
      return helpers.makeValue(FSDataType.Boolean, true);
    }
    return makeAssertionError(this.symbol, 'Expected non-null value but received null.');
  }
}

module.exports = {
  AssertEqualFunction,
  AssertNotEqualFunction,
  AssertGreaterFunction,
  AssertLessFunction,
  AssertTrueFunction,
  AssertFalseFunction,
  AssertApproxFunction,
  AssertNoErrorFunction,
  AssertIsErrorFunction,
  AssertIsErrorTypeFunction,
  AssertHasErrorMessageFunction,
  AssertIsNullFunction,
  AssertIsNotNullFunction
};
