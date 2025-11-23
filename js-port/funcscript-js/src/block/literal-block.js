const { ExpressionBlock } = require('./expression-block');
const { ensureTyped } = require('../core/value');
const { ExpressionFunction } = require('../core/expression-function');

class LiteralBlock extends ExpressionBlock {
  constructor(value, position = 0, length = 0) {
    super(position, length);
    this.value = ensureTyped(value);
  }

  evaluateInternal(provider) {
    const raw = this.value[1];
    if (raw instanceof ExpressionFunction) {
      const instance = raw.clone();
      instance.setContext(provider);
      return ensureTyped(instance);
    }
    return this.value;
  }

  asExpressionString() {
    const val = this.value[1];
    if (val === null) {
      return 'null';
    }
    return String(val);
  }
}

module.exports = {
  LiteralBlock
};
