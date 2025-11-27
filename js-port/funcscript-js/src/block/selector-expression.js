const { ExpressionBlock } = require('./expression-block');
const { FsDataProvider } = require('../core/data-provider');
const { assertTyped, typeOf, valueOf, makeValue, typedNull } = require('../core/value');
const { FSDataType } = require('../core/fstypes');
const { ArrayFsList } = require('../model/fs-list');

class SelectorProvider extends FsDataProvider {
  constructor(parent) {
    super(parent);
    this.sourceValue = typedNull();
    this.sourceCollection = null;
    this.__fsSelectorProvider = true;
  }

  setSource(value) {
    const typed = assertTyped(value);
    this.sourceValue = typed;
    if (typeOf(typed) === FSDataType.KeyValueCollection) {
      this.sourceCollection = valueOf(typed);
    } else {
      this.sourceCollection = null;
    }
  }

  get(name) {
    const lower = name.toLowerCase();
    if (this.sourceCollection && this.sourceCollection.isDefined(lower)) {
      return this.sourceCollection.get(lower);
    }
    return super.get(name);
  }

  isDefined(name) {
    const lower = name.toLowerCase();
    if (this.sourceCollection && this.sourceCollection.isDefined(lower)) {
      return true;
    }
    return super.isDefined(name);
  }
}

class SelectorExpression extends ExpressionBlock {
  constructor() {
    super();
    this.Source = null;
    this.Selector = null;
  }

  evaluateInternal(provider) {
    const sourceTyped = assertTyped(this.Source.evaluate(provider));
    const sourceType = typeOf(sourceTyped);
    const selectorProvider = new SelectorProvider(provider);

    if (sourceType === FSDataType.List) {
      const list = valueOf(sourceTyped);
      const results = [];
      for (let i = 0; i < list.length; i += 1) {
        const item = list.get(i) ?? typedNull();
        selectorProvider.setSource(item);
        const result = assertTyped(this.Selector.evaluate(selectorProvider));
        results.push(result);
      }
      return makeValue(FSDataType.List, new ArrayFsList(results));
    }

    selectorProvider.setSource(sourceTyped);
    return assertTyped(this.Selector.evaluate(selectorProvider));
  }

  getChilds() {
    return [this.Source, this.Selector];
  }

  asExpressionString(provider) {
    return `${this.Source.asExpressionString(provider)} ${this.Selector.asExpressionString(provider)}`;
  }
}

module.exports = {
  SelectorExpression
};
