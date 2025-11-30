const { BaseFunction, CallType } = require('../../core/function-base');
const helpers = require('../helpers');

class EqualsFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = '=';
    this.callType = CallType.Infix;
  }

  get maxParameters() {
    return 2;
  }

  evaluate(provider, parameters) {
    const error = helpers.expectParamCount(this.symbol, parameters, this.maxParameters);
    if (error) {
      return error;
    }

    const left = helpers.assertTyped(parameters.getParameter(provider, 0));
    const right = helpers.assertTyped(parameters.getParameter(provider, 1));

    return helpers.makeValue(helpers.FSDataType.Boolean, valuesAreEqual(left, right));
  }
}

function valuesAreEqual(left, right) {
  let evaluatedLeft = left;
  let evaluatedRight = right;

  const leftType = helpers.typeOf(evaluatedLeft);
  const rightType = helpers.typeOf(evaluatedRight);

  if (leftType === helpers.FSDataType.Null && rightType === helpers.FSDataType.Null) {
    return true;
  }
  if (leftType === helpers.FSDataType.Null || rightType === helpers.FSDataType.Null) {
    return false;
  }

  if (helpers.isNumeric(evaluatedLeft) && helpers.isNumeric(evaluatedRight)) {
    [evaluatedLeft, evaluatedRight] = helpers.convertToCommonNumericType(evaluatedLeft, evaluatedRight);
  }

  if (helpers.typeOf(evaluatedLeft) !== helpers.typeOf(evaluatedRight)) {
    return false;
  }

  switch (helpers.typeOf(evaluatedLeft)) {
    case helpers.FSDataType.KeyValueCollection:
      return keyValueCollectionsEqual(evaluatedLeft, evaluatedRight);
    case helpers.FSDataType.List:
      return listsEqual(evaluatedLeft, evaluatedRight);
    default:
      return helpers.valueOf(evaluatedLeft) === helpers.valueOf(evaluatedRight);
  }
}

function listsEqual(left, right) {
  const leftList = helpers.valueOf(left);
  const rightList = helpers.valueOf(right);

  if (!leftList || !rightList || leftList.length !== rightList.length) {
    return false;
  }

  for (let i = 0; i < leftList.length; i += 1) {
    if (!valuesAreEqual(leftList.get(i), rightList.get(i))) {
      return false;
    }
  }

  return true;
}

function keyValueCollectionsEqual(left, right) {
  const leftProvider = helpers.valueOf(left);
  const rightProvider = helpers.valueOf(right);

  const leftEntries = leftProvider.getAll();
  const rightEntries = rightProvider.getAll();

  if (leftEntries.length !== rightEntries.length) {
    return false;
  }

  const rightMap = new Map();
  for (const [key, value] of rightEntries) {
    rightMap.set(key.toLowerCase(), value);
  }

  for (const [key, leftValue] of leftEntries) {
    const lower = key.toLowerCase();
    if (!rightMap.has(lower)) {
      return false;
    }
    if (!valuesAreEqual(leftValue, rightMap.get(lower))) {
      return false;
    }
  }

  return true;
}

module.exports = {
  EqualsFunction
};
