const { ExpressionBlock } = require('./expression-block');

class ReferenceBlock extends ExpressionBlock {
  constructor(name, position = 0, length = 0, fromParent = false) {
    super(position, length);
    this.name = name;
    this.key = name ? name.toLowerCase() : null;
    this.fromParent = fromParent;
  }

  evaluateInternal(provider) {
    if (!provider) {
      return null;
    }
    if (this.fromParent && provider.parent) {
      return provider.parent.get(this.key);
    }
    return provider.get(this.key);
  }

  asExpressionString() {
    return this.name;
  }
}

module.exports = {
  ReferenceBlock
};
