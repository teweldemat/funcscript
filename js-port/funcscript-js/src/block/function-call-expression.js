const { ExpressionBlock } = require('./expression-block');
const { ParameterList } = require('../core/function-base');
const { typeOf, valueOf, ensureTyped, typedNull } = require('../core/value');
const { FSDataType } = require('../core/fstypes');

function resolveExpressionSource(provider) {
  let current = provider;
  while (current) {
    if (current.__fsExpression) {
      return current.__fsExpression;
    }
    current = current.parent || current.ParentProvider || null;
  }
  return null;
}

function getExpressionLocation(block) {
  if (!block || typeof block !== 'object') {
    return { position: 0, length: 0 };
  }
  const location = block.CodeLocation;
  if (!location || typeof location !== 'object') {
    return { position: 0, length: 0 };
  }
  const position = typeof location.Position === 'number' ? location.Position : 0;
  const length = typeof location.Length === 'number' ? location.Length : 0;
  return { position, length };
}

function sliceExpression(expressionSource, expressionBlock) {
  if (!expressionSource || !expressionBlock) {
    return null;
  }
  const { position, length } = getExpressionLocation(expressionBlock);
  if (length <= 0) {
    return null;
  }
  return expressionSource.slice(position, position + length);
}

function normalizeSnippet(snippet) {
  if (!snippet) {
    return null;
  }
  const trimmed = snippet.trim();
  const evalMatch = trimmed.match(/^eval\s*\((.*)\)\s*;?$/i);
  if (evalMatch && evalMatch[1]) {
    return evalMatch[1].trim();
  }
  return trimmed;
}

function annotateFsError(fsError, expressionSource, expressionBlock) {
  if (!fsError || !expressionSource || !expressionBlock) {
    return;
  }
  const snippet = sliceExpression(expressionSource, expressionBlock);
  if (!snippet) {
    return;
  }
  const cleaned = normalizeSnippet(snippet);
  const data = fsError.errorData && typeof fsError.errorData === 'object' ? fsError.errorData : {};
  fsError.errorData = {
    ...data,
    expression: cleaned || snippet
  };
}

function formatEvaluationMessage(message, expressionSource, expressionBlock) {
  const snippet = expressionSource ? sliceExpression(expressionSource, expressionBlock) : null;
  const cleaned = snippet ? normalizeSnippet(snippet) : null;
  if (!cleaned && !snippet) {
    return message;
  }
  return `${message} (Evaluation error at '${cleaned || snippet}')`;
}

class FuncParameterList extends ParameterList {
  constructor(parentExpression, provider) {
    super();
    this.parentExpression = parentExpression;
    this.provider = provider;
    this.expressionSource = resolveExpressionSource(provider);
  }

  get count() {
    return this.parentExpression.Parameters.length;
  }

  getParameter(provider, index) {
    const exp = this.parentExpression.Parameters[index];
    if (!exp) {
      return typedNull();
    }
    const result = exp.evaluate(this.provider);
    const typed = ensureTyped(result);
    if (typeOf(typed) === FSDataType.Error) {
      const fsError = valueOf(typed);
      annotateFsError(fsError, this.expressionSource, exp);
    }
    return typed;
  }
}

class FunctionCallExpression extends ExpressionBlock {
  constructor(fnExpression, parameterExpressions, position = 0, length = 0) {
    super(position, length);
    this.functionExpression = fnExpression;
    this.parameters = parameterExpressions || [];
    this.Function = this.functionExpression;
    this.Parameters = this.parameters;
  }

  evaluate(provider) {
    const expressionSource = resolveExpressionSource(provider);
    const fnValue = ensureTyped(this.functionExpression.evaluate(provider));
    const fnType = typeOf(fnValue);

    if (fnType === FSDataType.Function) {
      const fn = valueOf(fnValue);
      const paramList = new FuncParameterList(this, provider);
      const result = fn.evaluate(provider, paramList);
      return ensureTyped(result);
    }

    if (fnType === FSDataType.List) {
      const list = valueOf(fnValue);
      if (this.parameters.length === 0) {
        return typedNull();
      }
      const index = this.parameters[0].evaluate(provider);
      const typedIndex = ensureTyped(index);
      if (typeOf(typedIndex) !== FSDataType.Integer) {
        return typedNull();
      }
      const raw = list.get(valueOf(typedIndex));
      return ensureTyped(raw);
    }

    if (fnType === FSDataType.KeyValueCollection) {
      const collection = valueOf(fnValue);
      if (this.parameters.length === 0) {
        return typedNull();
      }
      const keyVal = ensureTyped(this.parameters[0].evaluate(provider));
      if (typeOf(keyVal) !== FSDataType.String) {
        return typedNull();
      }
      const result = collection.get(valueOf(keyVal));
      return ensureTyped(result);
    }

    throw new Error(
      formatEvaluationMessage(
        'Function call target is not a function, list, or key-value collection',
        expressionSource,
        this
      )
    );
  }

  getChilds() {
    return [this.functionExpression, ...this.parameters];
  }

  asExpressionString(provider) {
    const fnStr = this.functionExpression.asExpressionString(provider);
    const paramStr = this.parameters.map((p) => p.asExpressionString(provider)).join(',');
    return `${fnStr}(${paramStr})`;
  }
}

module.exports = {
  FunctionCallExpression
};
