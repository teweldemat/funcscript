const { ExpressionBlock } = require('./expression-block');
const { ParameterList } = require('../core/function-base');
const { typeOf, valueOf, typedNull, assertTyped, normalize } = require('../core/value');
const { FSDataType } = require('../core/fstypes');
const { FsError } = require('../model/fs-error');
const { ArrayParameterList } = require('../funcs/helpers');

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
  const data = fsError.errorData && typeof fsError.errorData === 'object' ? fsError.errorData : {};
  if (data.expression) {
    return;
  }
  const snippet = sliceExpression(expressionSource, expressionBlock);
  if (!snippet) {
    return;
  }
  const cleaned = normalizeSnippet(snippet);
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
    const valueExpressions = this.parentExpression.Parameters?.ValueExpressions;
    return Array.isArray(valueExpressions) ? valueExpressions.length : 0;
  }

  getParameter(provider, index) {
    const expressions = this.parentExpression.Parameters?.ValueExpressions;
    const exp = Array.isArray(expressions) ? expressions[index] : null;
    if (!exp) {
      return typedNull();
    }
    const result = exp.evaluate(this.provider);
    const typed = assertTyped(result, 'Function parameter must be typed');
    if (typeOf(typed) === FSDataType.Error) {
      const fsError = valueOf(typed);
      annotateFsError(fsError, this.expressionSource, exp);
    }
    return typed;
  }
}

class LazyParameterList extends ParameterList {
  constructor(expressions, provider, expressionSource) {
    super();
    this.expressions = Array.isArray(expressions) ? expressions : [];
    this.provider = provider;
    this.expressionSource = expressionSource;
  }

  get count() {
    return this.expressions.length;
  }

  getParameter(provider, index) {
    const expr = this.expressions[index];
    if (!expr) {
      return typedNull();
    }
    const result = expr.evaluate(this.provider);
    const typed = assertTyped(result, 'Function parameter must be typed');
    if (typeOf(typed) === FSDataType.Error) {
      const fsError = valueOf(typed);
      annotateFsError(fsError, this.expressionSource, expr);
    }
    return typed;
  }
}

class FunctionCallExpression extends ExpressionBlock {
  constructor(fnExpression, parameterExpression, position = 0, length = 0) {
    super(position, length);
    this.functionExpression = fnExpression;
    this.parameterExpression = parameterExpression;
    this.Function = this.functionExpression;
    this.Parameters = this.parameterExpression;
  }

  evaluateInternal(provider) {
    const expressionSource = resolveExpressionSource(provider);
    const fnValue = assertTyped(this.functionExpression.evaluate(provider), 'Function value must be typed');
    const fnType = typeOf(fnValue);

    if (fnType === FSDataType.Error) {
      const fsError = valueOf(fnValue);
      annotateFsError(fsError, expressionSource, this.functionExpression);
      return fnValue;
    }

    const parameterExpressions = this.parameterExpression?.ValueExpressions ?? [];

    if (fnType === FSDataType.Function) {
      const fn = valueOf(fnValue);
      const paramList = new LazyParameterList(parameterExpressions, provider, expressionSource);
      try {
        const result = fn.evaluate(provider, paramList);
        const typedResult = assertTyped(result, 'Functions must return typed values');
        if (typeOf(typedResult) === FSDataType.Error) {
          annotateFsError(valueOf(typedResult), expressionSource, this);
        }
        return typedResult;
      } catch (error) {
        const message = formatEvaluationMessage(
          error?.message || 'Runtime error',
          expressionSource,
          this
        );
        return normalize(new FsError(FsError.ERROR_DEFAULT, message));
      }
    }

    if (fnType === FSDataType.List) {
      const list = valueOf(fnValue);
      const firstParam = parameterExpressions[0];
      if (!firstParam) {
        return typedNull();
      }
      const typedIndex = assertTyped(firstParam.evaluate(provider), 'List index must be typed');
      if (typeOf(typedIndex) !== FSDataType.Integer) {
        return typedNull();
      }
      const raw = list.get(valueOf(typedIndex));
      if (raw === null || raw === undefined) {
        return typedNull();
      }
      return assertTyped(raw, 'List items must be typed');
    }

    if (fnType === FSDataType.KeyValueCollection) {
      const collection = valueOf(fnValue);
      const firstParam = parameterExpressions[0];
      if (!firstParam) {
        return typedNull();
      }
      const keyVal = assertTyped(firstParam.evaluate(provider), 'Key reference must be typed');
      if (typeOf(keyVal) !== FSDataType.String) {
        return typedNull();
      }
      const result = collection.get(valueOf(keyVal));
      if (result === null || result === undefined) {
        return typedNull();
      }
      return assertTyped(result, 'Key-value entries must be typed');
    }

    const message = formatEvaluationMessage(
      'Function call target is not a function, list, or key-value collection',
      expressionSource,
      this
    );
    return normalize(new FsError(FsError.ERROR_DEFAULT, message));
  }

  getChilds() {
    return [this.functionExpression, this.parameterExpression].filter(Boolean);
  }

  asExpressionString(provider) {
    const fnStr = this.functionExpression.asExpressionString(provider);
    if (this.parameterExpression && Array.isArray(this.parameterExpression.ValueExpressions)) {
      const paramStr = this.parameterExpression.ValueExpressions.map((p) =>
        p.asExpressionString(provider)
      ).join(',');
      return `${fnStr}(${paramStr})`;
    }
    return `${fnStr}()`;
  }
}

module.exports = {
  FunctionCallExpression
};
