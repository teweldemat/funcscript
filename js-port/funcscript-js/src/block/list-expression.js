const { ExpressionBlock } = require('./expression-block');
const { ArrayFsList } = require('../model/fs-list');
const { assertTyped, makeValue } = require('../core/value');
const { FSDataType } = require('../core/fstypes');

class ListExpression extends ExpressionBlock {
  constructor(valueExpressions = [], position = 0, length = 0) {
    super(position, length);
    this.ValueExpressions = valueExpressions || [];
  }

  evaluateInternal(provider) {
    const values = this.ValueExpressions.map((expr) => assertTyped(expr.evaluate(provider)));
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
