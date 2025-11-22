const { ExpressionBlock } = require('./expression-block');
const { ArrayFsList } = require('../model/fs-list');
const { ensureTyped, makeValue } = require('../core/value');
const { FSDataType } = require('../core/fstypes');

class ListExpression extends ExpressionBlock {
  constructor() {
    super();
    this.ValueExpressions = [];
  }

  evaluateInternal(provider) {
    const values = this.ValueExpressions.map((expr) => ensureTyped(expr.evaluate(provider)));
    const list = new ArrayFsList(values);
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
