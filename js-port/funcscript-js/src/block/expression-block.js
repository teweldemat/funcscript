const { makeValue, assertTyped, valueOf } = require('../core/value');
const { FSDataType } = require('../core/fstypes');
const { FsError } = require('../model/fs-error');

const DEFAULT_CODE_LOCATION = Object.freeze({ Position: 0, Length: 0 });
const MAX_EVALUATION_DEPTH = 1024;
let currentEvaluationDepth = 0;
const MAX_SNIPPET_LENGTH = 200;
let cacheTokenCounter = 1;

function now() {
  if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function nextCacheToken() {
  cacheTokenCounter += 1;
  return cacheTokenCounter;
}

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

function ensureBlockProfile(traceState) {
  if (!traceState || !traceState.blockProfile) {
    return null;
  }
  const profile = traceState.blockProfile;
  if (!profile.byType || typeof profile.byType !== 'object') {
    profile.byType = {};
  }
  if (profile.byLocation && typeof profile.byLocation !== 'object') {
    profile.byLocation = {};
  }
  if (profile.byLocation && !Number.isFinite(profile.locationCount)) {
    profile.locationCount = 0;
  }
  if (!Number.isFinite(profile.totalMs)) {
    profile.totalMs = 0;
  }
  if (!Number.isFinite(profile.totalCount)) {
    profile.totalCount = 0;
  }
  return profile;
}

function recordBlockProfile(profile, block, elapsed) {
  if (!profile) {
    return;
  }
  const name = block && block.constructor && block.constructor.name ? block.constructor.name : 'ExpressionBlock';
  const entry = profile.byType[name] || { count: 0, ms: 0 };
  entry.count += 1;
  entry.ms += elapsed;
  profile.byType[name] = entry;
  profile.totalCount += 1;
  profile.totalMs += elapsed;
}

function recordLocationProfile(profile, traceState, block, elapsed) {
  if (!profile || !profile.byLocation) {
    return;
  }
  const path = traceState && traceState.path ? traceState.path : '';
  const location = block && block.CodeLocation ? block.CodeLocation : DEFAULT_CODE_LOCATION;
  const index = Number(location && location.Position !== undefined ? location.Position : block?.position ?? 0) || 0;
  const key = `${path}:${index}`;
  let entry = profile.byLocation[key];
  if (!entry) {
    entry = { count: 0, ms: 0, path, index };
    profile.byLocation[key] = entry;
    profile.locationCount += 1;
  }
  entry.count += 1;
  entry.ms += elapsed;
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
  const rawLength = location?.Length;
  const hasLength = typeof rawLength === 'number' && rawLength > 0;
  const isZeroLength = typeof rawLength === 'number' && rawLength === 0;
  const length = hasLength
    ? Math.min(rawLength, expSource.length - start)
    : isZeroLength
      ? 0
      : Math.min(MAX_SNIPPET_LENGTH, expSource.length - start);
  let snippet = length > 0 ? expSource.slice(start, start + length) : '';
  if (!snippet && block && typeof block.asExpressionString === 'function') {
    snippet = block.asExpressionString();
  }
  if (!snippet) {
    snippet = expSource;
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
    endIndex,
    endLine: end.line,
    endColumn: end.column,
    snippet: extractSnippet(traceState.expression, block, location),
    result: typedResult == null ? null : valueOf(typedResult)
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
    this.__fsCachedToken = null;
    this.__fsCachedValue = null;
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
      const cacheToken = provider && provider.__fsCacheToken != null ? provider.__fsCacheToken : null;
      if (cacheToken !== null && this.__fsCachedToken === cacheToken) {
        return this.__fsCachedValue;
      }
      const traceState = getTraceState(provider);
      const blockProfile = ensureBlockProfile(traceState);
      const evalStart = blockProfile ? now() : 0;
      const entryInfo =
        traceState && typeof traceState.entryHook === 'function'
          ? buildTraceInfo(traceState, this, null)
          : null;
      const entryState =
        traceState && typeof traceState.entryHook === 'function'
          ? traceState.entryHook(entryInfo)
          : null;

      const result = this.evaluateInternal(provider);
      const typedResult = assertTyped(result, 'Expression blocks must return typed values');

      if (cacheToken !== null) {
        this.__fsCachedValue = typedResult;
        this.__fsCachedToken = cacheToken;
      }
      if (blockProfile) {
        const elapsed = now() - evalStart;
        recordBlockProfile(blockProfile, this, elapsed);
        recordLocationProfile(blockProfile, traceState, this, elapsed);
      }

      if (traceState) {
        const info = buildTraceInfo(traceState, this, typedResult);
        logTraceInfo(traceState, info);
        if (typeof traceState.hook === 'function') {
          traceState.hook(info.result, info, entryState);
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

  resetCache(visited) {
    const seen = visited || new Set();
    if (seen.has(this)) {
      return;
    }
    seen.add(this);
    this.__fsCachedToken = null;
    this.__fsCachedValue = null;
    const children = this.getChilds();
    if (!Array.isArray(children)) {
      return;
    }
    for (const child of children) {
      if (child && typeof child.resetCache === 'function') {
        child.resetCache(seen);
      }
    }
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
  createDepthOverflowValue,
  nextCacheToken
};
