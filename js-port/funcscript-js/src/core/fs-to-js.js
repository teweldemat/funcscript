const { assertTyped, typeOf, valueOf, normalize, typedNull } = require('./value');
const { FSDataType } = require('./fstypes');
const { ArrayParameterList } = require('../funcs/helpers');
const { ArrayFsList } = require('../model/fs-list');
const { SimpleKeyValueCollection } = require('../model/key-value-collection');

function convertJsValueToFuncScript(value) {
  if (value === null || value === undefined) {
    return typedNull();
  }
  if (Array.isArray(value)) {
    const convertedItems = value.map((item) => convertJsValueToFuncScript(item));
    return normalize(new ArrayFsList(convertedItems));
  }
  if (typeof value === 'function') {
    const wrapped = (...args) => {
      const result = value(...args);
      return convertJsValueToFuncScript(result);
    };
    return normalize(wrapped);
  }
  if (value && typeof value === 'object' && !Array.isArray(value) && !value.__fsKind) {
    const entries = Object.entries(value).map(([key, val]) => [key, convertJsValueToFuncScript(val)]);
    return normalize(new SimpleKeyValueCollection(null, entries));
  }
  try {
    return normalize(value);
  } catch (error) {
    if (value && typeof value === 'object') {
      const entries = Object.entries(value).map(([key, val]) => [key, convertJsValueToFuncScript(val)]);
      return normalize(new SimpleKeyValueCollection(null, entries));
    }
    throw error;
  }
}

function convertFsListToArray(list, provider) {
  if (!list || typeof list[Symbol.iterator] !== 'function') {
    return [];
  }
  const result = [];
  for (const item of list) {
    result.push(convertTypedValueToJs(item, provider));
  }
  return result;
}

function createKvcObject(collection, provider) {
  if (!collection || typeof collection.getAll !== 'function') {
    return {};
  }
  const entries = collection.getAll();
  const valueMap = new Map();
  const keySet = new Set();
  for (const [key, value] of entries) {
    const normalizedKey = typeof key === 'string' ? key : String(key);
    const lowerKey = normalizedKey.toLowerCase();
    const converted = convertTypedValueToJs(value, collection);
    keySet.add(normalizedKey);
    if (!valueMap.has(lowerKey)) {
      valueMap.set(lowerKey, converted);
    }
  }
  return new Proxy(
    {},
    {
      has(target, prop) {
        if (typeof prop === 'string' && valueMap.has(prop.toLowerCase())) {
          return true;
        }
        return Reflect.has(target, prop);
      },
      ownKeys(target) {
        const keys = new Set(Reflect.ownKeys(target));
        keySet.forEach((key) => keys.add(key));
        return Array.from(keys);
      },
      getOwnPropertyDescriptor(target, prop) {
        if (typeof prop === 'string') {
          const lower = prop.toLowerCase();
          if (valueMap.has(lower)) {
            return {
              enumerable: true,
              configurable: true,
              value: valueMap.get(lower)
            };
          }
        }
        return Object.getOwnPropertyDescriptor(target, prop);
      },
      get(target, prop) {
        if (typeof prop === 'string') {
          const lower = prop.toLowerCase();
          if (valueMap.has(lower)) {
            return valueMap.get(lower);
          }
        }
        return Reflect.get(target, prop);
      }
    }
  );
}

function convertTypedValueToJs(value, provider) {
  if (value === null || value === undefined) {
    return null;
  }
  const typed = assertTyped(value, 'JavaScript binding requires typed values');
  const dataType = typeOf(typed);
  const raw = valueOf(typed);

  switch (dataType) {
    case FSDataType.Null:
      return null;
    case FSDataType.Boolean:
    case FSDataType.Integer:
    case FSDataType.Float:
    case FSDataType.String:
    case FSDataType.BigInteger:
    case FSDataType.DateTime:
    case FSDataType.Guid:
    case FSDataType.ByteArray:
      return raw;
    case FSDataType.List:
      return convertFsListToArray(raw, provider);
    case FSDataType.KeyValueCollection:
      return createKvcObject(raw, provider);
    case FSDataType.Function:
      return (...args) => {
        const typedArgs = args.map((arg) => convertJsValueToFuncScript(arg));
        const params = new ArrayParameterList(typedArgs);
        const result = raw.evaluate(provider, params);
        return convertTypedValueToJs(result, provider);
      };
    case FSDataType.Error:
      return raw;
    default:
      return raw;
  }
}

module.exports = {
  convertTypedValueToJs,
  convertFsListToArray,
  createKvcObject,
  convertJsValueToFuncScript
};
