const { ExpressionBlock } = require('./expression-block');
const { FsList } = require('../model/fs-list');
const { assertTyped, makeValue } = require('../core/value');
const { FSDataType } = require('../core/fstypes');

class ExpressionFsList extends FsList {
  constructor(provider, expressions) {
    super();
    this.__fsKind = 'FsList';
    this.provider = provider;
    this.expressions = Array.isArray(expressions) ? expressions : [];
  }

  get length() {
    return this.expressions.length;
  }

  get(index) {
    if (index < 0 || index >= this.expressions.length) {
      return null;
    }
    const expr = this.expressions[index];
    if (!expr) {
      return null;
    }
    return assertTyped(expr.evaluate(this.provider));
  }
}

class ListExpression extends ExpressionBlock {
  constructor(valueExpressions = [], position = 0, length = 0) {
    super(position, length);
    this.ValueExpressions = valueExpressions || [];
  }

  evaluateInternal(provider) {
    const list = new ExpressionFsList(provider, this.ValueExpressions);
    return makeValue(FSDataType.List, list);
  }

  getChilds() {
    return this.ValueExpressions.slice();
  }

  asExpressionString(provider) {
    const parts = this.ValueExpressions.map((expr) => expr.asExpressionString(provider));
    return `[${parts.join(', ')}]`;
  }
}

module.exports = {
  ListExpression
};
