const {
  evaluate,
  MapDataProvider,
  DefaultFsDataProvider,
  typeOf,
  valueOf,
  FSDataType,
  normalize
} = require('@tewelde/funcscript');

function makeProvider(vars = {}) {
  const typedEntries = Object.entries(vars).map(([key, value]) => [key, normalize(value)]);
  const typedMap = Object.fromEntries(typedEntries);
  return new MapDataProvider(typedMap, new DefaultFsDataProvider());
}

function evaluateWithVars(expression, vars) {
  return evaluate(expression, makeProvider(vars));
}

function toPlain(typed) {
  const t = typeOf(typed);
  switch (t) {
    case FSDataType.Null:
      return null;
    case FSDataType.Boolean:
    case FSDataType.Integer:
    case FSDataType.Float:
    case FSDataType.String:
    case FSDataType.BigInteger:
      return valueOf(typed);
    case FSDataType.List: {
      const list = valueOf(typed);
      return list.toArray().map(toPlain);
    }
    case FSDataType.KeyValueCollection: {
      const collection = valueOf(typed);
      const entries = collection.getAll().map(([key, val]) => [key, toPlain(val)]);
      return Object.fromEntries(entries.map(([k, v]) => [k, v]));
    }
    case FSDataType.Error: {
      const err = valueOf(typed);
      return {
        errorType: err.errorType,
        errorMessage: err.errorMessage,
        errorData: err.errorData
      };
    }
    case FSDataType.Function:
      return '[Function]';
    case FSDataType.ByteArray:
      return valueOf(typed);
    default:
      return valueOf(typed);
  }
}

module.exports = {
  evaluateWithVars,
  makeProvider,
  toPlain,
  DefaultFsDataProvider,
  FSDataType,
  typeOf,
  valueOf
};
