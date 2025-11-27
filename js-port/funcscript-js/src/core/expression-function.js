const { BaseFunction, CallType } = require('./function-base');
const { KvcProvider, FsDataProvider } = require('./data-provider');
const { assertTyped } = require('./value');

class ParameterProvider extends FsDataProvider {
  constructor(expressionFunction, parentProvider, parameterList) {
    super(parentProvider);
    this.expressionFunction = expressionFunction;
    this.parameterList = parameterList;
  }

  get(name) {
    const lower = name.toLowerCase();
    const index = this.expressionFunction.parameterIndex.get(lower);
    if (index !== undefined) {
      return assertTyped(this.parameterList.getParameter(this.parent, index));
    }
    return super.get(name);
  }

  isDefined(name) {
    const lower = name.toLowerCase();
    if (this.expressionFunction.parameterIndex.has(lower)) {
      return true;
    }
    return super.isDefined(name);
  }
}

class ExpressionFunction extends BaseFunction {
  constructor(parameters, expressionBlock) {
    super();
    this.parameters = parameters || [];
    this.expression = expressionBlock;
    this.parameterIndex = new Map();
    this.context = null;

    this.parameters.forEach((name, idx) => {
      this.parameterIndex.set(name.toLowerCase(), idx);
    });
  }

  setContext(context) {
    this.context = context;
  }

  get maxParameters() {
    return this.parameters.length;
  }

  get callType() {
    return CallType.Infix;
  }

  evaluate(provider, parameterList) {
    if (!this.context) {
      throw new Error('Context not set on expression function');
    }
    const parentChain = new KvcProvider(this.context, provider);
    const parameterProvider = new ParameterProvider(this, parentChain, parameterList);
    const result = this.expression.evaluate(parameterProvider);
    return assertTyped(result);
  }

  clone() {
    return new ExpressionFunction(this.parameters.slice(), this.expression);
  }

  parName(index) {
    return this.parameters[index];
  }

  toString() {
    const parameterList = this.parameters.join(',');
    const provider = this.context ?? new FsDataProvider();
    const body = this.expression && typeof this.expression.asExpressionString === 'function'
      ? this.expression.asExpressionString(provider)
      : '';
    return `(${parameterList})=>${body}`;
  }
}

module.exports = {
  ExpressionFunction
};
