const { ExpressionBlock } = require('./expression-block');
const { typedNull } = require('../core/value');

class ReferenceBlock extends ExpressionBlock {
  constructor(name, position = 0, length = 0, fromParent = false) {
    super(position, length);
    this.name = name;
    this.key = name ? name.toLowerCase() : null;
    this.fromParent = fromParent;
  }

  evaluateInternal(provider) {
    if (!provider) {
      return typedNull();
    }
    const source = this.fromParent && provider.parent ? provider.parent : provider;
    const value = source && typeof source.get === 'function' ? source.get(this.key) : null;
    if (value === null || value === undefined) {
      return typedNull();
    }
    return value;
  }

  asExpressionString() {
    return this.name;
  }
}

module.exports = {
  ReferenceBlock
};
