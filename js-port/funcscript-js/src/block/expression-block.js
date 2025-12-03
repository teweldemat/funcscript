const { makeValue, assertTyped, valueOf } = require('../core/value');
const { FSDataType } = require('../core/fstypes');
const { FsError } = require('../model/fs-error');

const DEFAULT_CODE_LOCATION = Object.freeze({ Position: 0, Length: 0 });
const MAX_EVALUATION_DEPTH = 256;
let currentEvaluationDepth = 0;
const MAX_SNIPPET_LENGTH = 200;

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

function getTraceState(provider) {
  let current = provider;
  while (current) {
    if (current.__fsTrace) {
      return current.__fsTrace;
    }
    current = current.parent || current.ParentProvider || null;
  }
  return null;
}

function buildLineStarts(expression) {
  if (typeof expression !== 'string') {
    return [0];
  }
  const starts = [0];
  for (let i = 0; i < expression.length; i += 1) {
    if (expression[i] === '\n') {
      starts.push(i + 1);
    }
  }
  return starts;
}

function getLineAndColumn(lineStarts, position) {
  const starts = Array.isArray(lineStarts) && lineStarts.length > 0 ? lineStarts : [0];
  const safePos = Math.max(0, Math.min(typeof position === 'number' ? position : 0, Number.MAX_SAFE_INTEGER));
  let lineIndex = 0;
  for (let i = 0; i < starts.length; i += 1) {
    if (starts[i] > safePos) {
      break;
    }
    lineIndex = i;
  }
  const lineStart = starts[lineIndex] || 0;
  return {
    line: lineIndex + 1,
    column: safePos - lineStart + 1
  };
}

function extractSnippet(expression, block, location) {
  const expSource = typeof expression === 'string' ? expression : '';
  const start = Math.max(0, Math.min(location?.Position ?? 0, expSource.length));
  const hasLength = typeof location?.Length === 'number' && location.Length > 0;
  const length = hasLength ? Math.min(location.Length, expSource.length - start) : Math.min(MAX_SNIPPET_LENGTH, expSource.length - start);
  let snippet = length > 0 ? expSource.slice(start, start + length) : expSource;
  if (!snippet && block && typeof block.asExpressionString === 'function') {
    snippet = block.asExpressionString();
  }
  if (snippet && snippet.length > MAX_SNIPPET_LENGTH) {
    return `${snippet.slice(0, MAX_SNIPPET_LENGTH)}…`;
  }
  return snippet || null;
}

function buildTraceInfo(traceState, block, typedResult) {
  if (!traceState) {
    return null;
  }

  if (!traceState.lineStarts) {
    traceState.lineStarts = buildLineStarts(traceState.expression);
  }

  const location = block?.CodeLocation ?? DEFAULT_CODE_LOCATION;
  const startIndex = location?.Position ?? 0;
  const length = location?.Length ?? 0;
  const endIndex = length > 0 ? startIndex + length - 1 : startIndex;
  const start = getLineAndColumn(traceState.lineStarts, startIndex);
  const end = getLineAndColumn(traceState.lineStarts, endIndex);

  return {
    startIndex,
    startLine: start.line,
    startColumn: start.column,
    endIndex: length,
    endLine: end.line,
    endColumn: end.column,
    snippet: extractSnippet(traceState.expression, block, location),
    result: valueOf(typedResult)
  };
}

function logTraceInfo(traceState, info) {
  if (!traceState?.logToConsole || !info) {
    return;
  }
  const logger = traceState.logger || console.log;
  logger(`Evaluating ${info.startLine}:${info.startColumn}-${info.endLine}:${info.endColumn}`);
  if (info.snippet) {
    logger(` ${info.snippet}`);
  }
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
    const traceState = getTraceState(provider);
    currentEvaluationDepth += 1;
    try {
      if (currentEvaluationDepth > MAX_EVALUATION_DEPTH) {
        return createDepthOverflowValue();
      }
      const result = this.evaluateInternal(provider);
      const typedResult = assertTyped(result, 'Expression blocks must return typed values');

      if (traceState) {
        const info = buildTraceInfo(traceState, this, typedResult);
        logTraceInfo(traceState, info);
        if (typeof traceState.hook === 'function') {
          traceState.hook(info.result, info);
        }
      }

      return typedResult;
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
