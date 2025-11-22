const { expect } = require('chai');
const { FuncScriptParser, DefaultFsDataProvider } = require('@tewelde/funcscript');

function parseExpression(expression) {
  const provider = new DefaultFsDataProvider();
  const errors = [];
  const result = FuncScriptParser.parse(provider, expression, errors);
  return { ...result, errors };
}

describe('SyntaxErrorReportingPass1', () => {
  it('EmptyExpressionProducesNoSyntaxErrorData', () => {
    const { block, errors } = parseExpression('');
    expect(block).to.equal(null);
    expect(errors).to.not.be.empty;
  });

  it('MissingPropertySeparatorIsNoLongerAnError', () => {
    const { block, errors } = parseExpression('{a:1 b:2}');
    expect(block).to.not.equal(null);
    expect(errors).to.be.empty;
  });

  it('LambdaMissingBodyReportsTypoAndZeroLengthLocation', () => {
    const expression = '(x)=>';
    const { block, errors } = parseExpression(expression);
    expect(block).to.equal(null);
    expect(errors).to.have.lengthOf(1);
    const [error] = errors;
    expect(error.Message.toLowerCase()).to.include('body');
    expect(error.Loc).to.be.lessThan(expression.length);
    expect(error.Length).to.be.greaterThan(0);
  });
});

describe('SyntaxErrorReportingPass2', () => {
  it('NestedPropertyMissingValueShouldHighlightInnerKey', () => {
    const expression = '{outer:{inner:{leaf:}}}';
    const { errors } = parseExpression(expression);
    expect(errors).to.not.be.empty;
    const first = errors[0];
    expect(first.Message.toLowerCase()).to.include('leaf');
    expect(first.Loc).to.equal(expression.indexOf('leaf'));
  });

  it('LambdaBodyMissingValueShouldPointInsideLambda', () => {
    const expression = '{outer:{inner:(x)=>{node:{leaf:}}}}';
    const { errors } = parseExpression(expression);
    expect(errors).to.not.be.empty;
    const first = errors[0];
    expect(first.Message).to.equal("'}' expected");
  });

  it('ListItemMissingSeparatorShouldIdentifyListBoundary', () => {
    const { block, errors } = parseExpression('{outer:{inner:[1 2]}}');
    expect(block).to.not.equal(null);
    expect(errors).to.be.empty;
  });
});
