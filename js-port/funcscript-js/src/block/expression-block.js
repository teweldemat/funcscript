const { makeValue } = require('../core/value');
const { FSDataType } = require('../core/fstypes');
const { FsError } = require('../model/fs-error');

const DEFAULT_CODE_LOCATION = Object.freeze({ Position: 0, Length: 0 });
const MAX_EVALUATION_DEPTH = 256;
let currentEvaluationDepth = 0;

function createDepthOverflowValue() {
  const errorMessage = `Maximum evaluation depth of ${MAX_EVALUATION_DEPTH} exceeded.`;
  const error = new FsError(FsError.ERROR_EVALUATION_DEPTH_OVERFLOW, errorMessage);
  return makeValue(FSDataType.Error, error);
}

function normalizeNumber(value, fallback = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

function createCodeLocation(position, length) {
  const pos = normalizeNumber(position, 0);
  const len = Math.max(0, normalizeNumber(length, 0));
  if (pos === 0 && len === 0) {
    return DEFAULT_CODE_LOCATION;
  }
  return { Position: pos, Length: len };
}

function cloneCodeLocation(location) {
  if (!location || typeof location !== 'object') {
    return DEFAULT_CODE_LOCATION;
  }
  const pos = normalizeNumber(location.Position ?? location.position, 0);
  const len = Math.max(0, normalizeNumber(location.Length ?? location.length, 0));
  if (pos === 0 && len === 0) {
    return DEFAULT_CODE_LOCATION;
  }
  return { Position: pos, Length: len };
}

class ExpressionBlock {
  constructor(position = 0, length = 0) {
    this._codeLocation = createCodeLocation(position, length);
  }

  get CodeLocation() {
    return this._codeLocation;
  }

  set CodeLocation(value) {
    this._codeLocation = cloneCodeLocation(value);
  }

  get position() {
    return this._codeLocation.Position;
  }

  set position(value) {
    this._codeLocation = createCodeLocation(value, this._codeLocation.Length);
  }

  get length() {
    return this._codeLocation.Length;
  }

  set length(value) {
    this._codeLocation = createCodeLocation(this._codeLocation.Position, value);
  }

  evaluate(provider) {
    const previousDepth = currentEvaluationDepth;
    currentEvaluationDepth += 1;
    try {
      if (currentEvaluationDepth > MAX_EVALUATION_DEPTH) {
        return createDepthOverflowValue();
      }
      return this.evaluateInternal(provider);
    } finally {
      currentEvaluationDepth = previousDepth;
    }
  }

  // To be implemented by derived classes.
  evaluateInternal() {
    throw new Error('ExpressionBlock.evaluateInternal not implemented');
  }

  getChilds() {
    return [];
  }

  asExpressionString(provider) {
    return '';
  }
}

module.exports = {
  MAX_EVALUATION_DEPTH,
  ExpressionBlock,
  createDepthOverflowValue
};
