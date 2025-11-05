const { BaseFunction, CallType } = require('../../core/function-base');
const { ensureTyped, typeOf, valueOf, makeValue, convertToCommonNumericType } = require('../../core/value');
const { FSDataType } = require('../../core/fstypes');
const { FsList, ArrayFsList } = require('../../model/fs-list');
const { KeyValueCollection } = require('../../model/key-value-collection');

function isNumericType(t) {
  return t === FSDataType.Integer || t === FSDataType.Float || t === FSDataType.BigInteger;
}

class SumFsList extends FsList {
  constructor(lists) {
    super();
    this._lists = lists;
    this._length = lists.reduce((total, list) => total + (list ? list.length : 0), 0);
  }

  get length() {
    return this._length;
  }

  get(index) {
    if (index < 0) {
      return null;
    }
    let remaining = index;
    for (const list of this._lists) {
      if (!list) {
        continue;
      }
      const len = list.length;
      if (remaining < len) {
        return list.get(remaining);
      }
      remaining -= len;
    }
    return null;
  }
}

function asList(typedValue) {
  const valueType = typeOf(typedValue);
  if (valueType === FSDataType.List) {
    return valueOf(typedValue);
  }
  return new ArrayFsList([typedValue]);
}

class AddFunction extends BaseFunction {
  constructor() {
    super();
    this.symbol = '+';
    this.callType = CallType.Infix;
  }

  evaluate(provider, parameters) {
    let resultType = null;
    let resultValue = null;
    let listParts = null;

    for (let i = 0; i < parameters.count; i += 1) {
      const typed = ensureTyped(parameters.getParameter(provider, i));
      const currentType = typeOf(typed);
      const currentValue = valueOf(typed);

      if (currentType === FSDataType.Null) {
        continue;
      }

      if (resultType === null || resultType === FSDataType.Null) {
        if (currentType === FSDataType.List) {
          listParts = [currentValue];
          resultType = FSDataType.List;
          resultValue = new SumFsList(listParts.slice());
        } else {
          resultType = currentType;
          resultValue = currentValue;
        }
        continue;
      }

      if (resultType === FSDataType.KeyValueCollection || currentType === FSDataType.KeyValueCollection) {
        if (resultType !== FSDataType.KeyValueCollection || currentType !== FSDataType.KeyValueCollection) {
          throw new Error('Unsupported operand types for +');
        }
        resultValue = KeyValueCollection.merge(resultValue, currentValue);
        resultType = FSDataType.KeyValueCollection;
        continue;
      }

      if (resultType === FSDataType.List || currentType === FSDataType.List) {
        if (!listParts) {
          listParts = [];
          listParts.push(asList(makeValue(resultType, resultValue)));
        }
        if (currentType === FSDataType.List) {
          listParts.push(currentValue);
        } else {
          listParts.push(asList(typed));
        }
        resultType = FSDataType.List;
        resultValue = new SumFsList(listParts.slice());
        continue;
      }

      if (currentType === FSDataType.String || resultType === FSDataType.String) {
        resultValue = String(resultValue) + String(currentValue);
        resultType = FSDataType.String;
        continue;
      }

      if (isNumericType(resultType) && isNumericType(currentType)) {
        let left = makeValue(resultType, resultValue);
        let right = makeValue(currentType, currentValue);
        [left, right] = convertToCommonNumericType(left, right);
        resultType = typeOf(left);
        if (resultType === FSDataType.BigInteger) {
          resultValue = valueOf(left) + valueOf(right);
        } else {
          resultValue = valueOf(left) + valueOf(right);
          if (resultType === FSDataType.Integer && !Number.isInteger(resultValue)) {
            resultType = FSDataType.Float;
          }
        }
        continue;
      }

      throw new Error('Unsupported operand types for +');
    }

    if (resultType === FSDataType.List && listParts) {
      return makeValue(FSDataType.List, new SumFsList(listParts.slice()));
    }

    return makeValue(resultType ?? FSDataType.Null, resultValue);
  }
}

module.exports = {
  AddFunction
};
