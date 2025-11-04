const { expect } = require('chai');
const {
  evaluate,
  colorParseTree,
  valueOf,
  typeOf,
  FSDataType
} = require('@tewelde/funcscript');
const { ParseNodeType } = require('@tewelde/funcscript/parser');
const { FunctionCallExpression } = require('../../../funcscript-js/src/block/function-call-expression');
const { LiteralBlock } = require('../../../funcscript-js/src/block/literal-block');
const { ReferenceBlock } = require('../../../funcscript-js/src/block/reference-block');
const {
  assertRootNode,
  assertTreeSpanConsistency,
  assertNodeSequence
} = require('../helpers/parse-tree-assertions');
const { parseExpression, DefaultFsDataProvider } = require('../helpers/parser');

// Mirrors FuncScript.Test/ParseTreeTests.cs.
describe('ParseTreeTests', () => {
  it('health check test', () => {
    const expression = '1+2';
    const provider = new DefaultFsDataProvider();
    const { block, parseNode, errors, nextIndex } = parseExpression(expression, provider);

    expect(errors, 'parsing should not produce errors').to.be.empty;
    expect(block, 'parser should produce an expression block').to.exist;
    expect(parseNode, 'parser should produce a parse node').to.exist;
    expect(nextIndex).to.equal(expression.length);

    assertRootNode(parseNode, expression);
    assertTreeSpanConsistency(parseNode);
    assertNodeSequence(parseNode.Childs, 0, [ParseNodeType.InfixExpression, expression.length]);

    const result = evaluate(expression, provider);
    expect(typeOf(result)).to.equal(FSDataType.Integer);
    expect(valueOf(result)).to.equal(3);
  });

  it('IntegerParseTest', () => {
    const provider = new DefaultFsDataProvider();
    const expression = '23';
    const { block, parseNode, errors, nextIndex } = parseExpression(expression, provider);

    expect(errors, 'Parsing an integer literal should not report errors').to.be.empty;
    expect(block, 'Parser should produce an expression block for literals').to.exist;
    expect(parseNode, 'Parser should produce a parse node for literals').to.exist;

    assertRootNode(parseNode, expression);
    assertTreeSpanConsistency(parseNode);
    expect(nextIndex).to.equal(expression.length);

    assertNodeSequence(parseNode.Childs, 0, [ParseNodeType.LiteralInteger, expression.length]);
  });

  it('InfixParseTest', () => {
    const provider = new DefaultFsDataProvider();
    const expression = '2+3';
    const { block, parseNode, errors, nextIndex } = parseExpression(expression, provider);

    expect(errors, 'Parsing a simple infix expression should not report errors').to.be.empty;
    expect(block, 'Parser should produce an expression block for infix expressions').to.exist;
    expect(parseNode, 'Parser should produce a parse node for infix expressions').to.exist;

    assertRootNode(parseNode, expression);
    assertTreeSpanConsistency(parseNode);
    expect(nextIndex).to.equal(expression.length);

    assertNodeSequence(parseNode.Childs, 0, [ParseNodeType.InfixExpression, expression.length]);

    const infix = parseNode.Childs[0];
    assertNodeSequence(
      infix.Childs,
      0,
      [ParseNodeType.LiteralInteger, 1],
      [ParseNodeType.Operator, 1],
      [ParseNodeType.LiteralInteger, 1]
    );
  });

  it('PasreKvcTest', () => {
    const provider = new DefaultFsDataProvider();
    const expression = '{a,b,c}';
    const { block, parseNode, errors, nextIndex } = parseExpression(expression, provider);

    expect(errors, 'Parsing a key-value collection should not report errors').to.be.empty;
    expect(block, 'Parser should produce an expression block for key-value collections').to.exist;
    expect(parseNode, 'Parser should produce a parse node for key-value collections').to.exist;

    assertRootNode(parseNode, expression);
    assertTreeSpanConsistency(parseNode);
    expect(nextIndex).to.equal(expression.length);

    assertNodeSequence(parseNode.Childs, 0, [ParseNodeType.KeyValueCollection, expression.length]);
  });

  it('ParseSimpleInfixExpressionPositions', () => {
    const provider = new DefaultFsDataProvider();
    const expression = '1+2';
    const { block, parseNode, errors, nextIndex } = parseExpression(expression, provider);

    expect(errors, 'Parsing a simple infix expression should not report errors').to.be.empty;
    expect(block, 'Parser should produce an expression block for infix expressions').to.exist;
    expect(parseNode, 'Parser should produce a parse node for infix expressions').to.exist;

    assertRootNode(parseNode, expression);
    assertTreeSpanConsistency(parseNode);
    expect(nextIndex).to.equal(expression.length);

    assertNodeSequence(parseNode.Childs, 0, [ParseNodeType.InfixExpression, expression.length]);

    const infix = parseNode.Childs[0];
    assertNodeSequence(
      infix.Childs,
      0,
      [ParseNodeType.LiteralInteger, 1],
      [ParseNodeType.Operator, 1],
      [ParseNodeType.LiteralInteger, 1]
    );

    expect(block).to.be.instanceOf(FunctionCallExpression);
    expect(block.Pos).to.equal(0);
    expect(block.Length).to.equal(3);

    expect(block.Function.Pos).to.equal(1);
    expect(block.Function.Length).to.equal(1);

    const leftExp = block.Parameters[0];
    expect(leftExp.Pos).to.equal(0);
    expect(leftExp.Length).to.equal(1);

    const rightExp = block.Parameters[1];
    expect(rightExp.Pos).to.equal(2);
    expect(rightExp.Length).to.equal(1);
  });

  it('InfixWithSpace', () => {
    const provider = new DefaultFsDataProvider();
    const expression = ' 1+2';
    const { block, parseNode, errors, nextIndex } = parseExpression(expression, provider);

    expect(errors, 'Parsing a simple infix expression should not report errors').to.be.empty;
    expect(block, 'Parser should produce an expression block for infix expressions').to.exist;
    expect(parseNode, 'Parser should produce a parse node for infix expressions').to.exist;

    assertRootNode(parseNode, expression);
    assertTreeSpanConsistency(parseNode);
    expect(nextIndex).to.equal(expression.length);

    assertNodeSequence(parseNode.Childs, 0, [ParseNodeType.InfixExpression, expression.length]);

    const infix = parseNode.Childs[0];
    assertNodeSequence(
      infix.Childs,
      0,
      [ParseNodeType.WhiteSpace, 1],
      [ParseNodeType.LiteralInteger, 1],
      [ParseNodeType.Operator, 1],
      [ParseNodeType.LiteralInteger, 1]
    );
  });

  it('IfThenElseParseTreeIncludesKeywords', () => {
    const provider = new DefaultFsDataProvider();
    const expression = 'if true then 3 else 4';
    const { block, parseNode, errors, nextIndex } = parseExpression(expression, provider);

    expect(errors, 'Parsing an if-then-else expression should not report errors').to.be.empty;
    expect(block, 'Parser should produce an expression block for if-then-else').to.exist;
    expect(parseNode, 'Parser should produce a parse node for if-then-else').to.exist;

    assertRootNode(parseNode, expression);
    assertTreeSpanConsistency(parseNode);
    expect(nextIndex).to.equal(expression.length);

    assertNodeSequence(parseNode.Childs, 0, [ParseNodeType.IfExpression, expression.length]);

    const ifNode = parseNode.Childs[0];
    assertNodeSequence(
      ifNode.Childs,
      0,
      [ParseNodeType.KeyWord, 2],
      [ParseNodeType.WhiteSpace, 1],
      [ParseNodeType.KeyWord, 4],
      [ParseNodeType.WhiteSpace, 1],
      [ParseNodeType.KeyWord, 4],
      [ParseNodeType.WhiteSpace, 1],
      [ParseNodeType.LiteralInteger, 1],
      [ParseNodeType.WhiteSpace, 1],
      [ParseNodeType.KeyWord, 4],
      [ParseNodeType.WhiteSpace, 1],
      [ParseNodeType.LiteralInteger, 1]
    );
  });

  it('TestColoring', () => {
    const provider = new DefaultFsDataProvider();
    const expression = '1+sin(45)';
    const { block, parseNode, errors, nextIndex } = parseExpression(expression, provider);

    expect(block, 'Parser should produce an expression block for coloring').to.exist;
    expect(parseNode, 'Parser should produce a parse node for coloring').to.exist;
    expect(errors, 'Coloring sample should parse without errors').to.be.empty;

    assertRootNode(parseNode, expression);
    assertTreeSpanConsistency(parseNode);
    expect(nextIndex).to.equal(expression.length);

    const color = colorParseTree(parseNode);
    expect(color).to.have.lengthOf(6);
    assertNodeSequence(
      color,
      0,
      [ParseNodeType.LiteralInteger, 1],
      [ParseNodeType.Operator, 1],
      [ParseNodeType.Identifier, 3],
      [ParseNodeType.OpenBrace, 1],
      [ParseNodeType.LiteralInteger, 2],
      [ParseNodeType.CloseBrance, 1]
    );
  });

  it('TestColoring2', () => {
    const provider = new DefaultFsDataProvider();
    const expression = '(x)=>45';
    const { block, parseNode, errors, nextIndex } = parseExpression(expression, provider);

    expect(block, 'Parser should produce an expression block for lambda coloring').to.exist;
    expect(parseNode, 'Parser should produce a parse node for lambda coloring').to.exist;
    expect(errors, 'Lambda coloring sample should parse without errors').to.be.empty;

    assertRootNode(parseNode, expression);
    assertTreeSpanConsistency(parseNode);
    expect(nextIndex).to.equal(expression.length);

    const color = colorParseTree(parseNode);
    expect(color).to.have.lengthOf(5);
    assertNodeSequence(
      color,
      0,
      [ParseNodeType.OpenBrace, 1],
      [ParseNodeType.Identifier, 1],
      [ParseNodeType.CloseBrance, 1],
      [ParseNodeType.LambdaArrow, 2],
      [ParseNodeType.LiteralInteger, 2]
    );
  });

  it('TestColoring3', () => {
    const provider = new DefaultFsDataProvider();
    const expression = '1 //123\n+3';
    const { block, parseNode, errors, nextIndex } = parseExpression(expression, provider);

    expect(block, 'Parser should produce an expression block for comment coloring').to.exist;
    expect(parseNode, 'Parser should produce a parse node for comment coloring').to.exist;
    expect(errors, 'Comment coloring sample should parse without errors').to.be.empty;

    assertRootNode(parseNode, expression);
    assertTreeSpanConsistency(parseNode);
    expect(nextIndex).to.equal(expression.length);

    const color = colorParseTree(parseNode);
    expect(color).to.have.lengthOf(5);
    assertNodeSequence(
      color,
      0,
      [ParseNodeType.LiteralInteger, 1],
      [ParseNodeType.WhiteSpace, 1],
      [ParseNodeType.Comment, 6],
      [ParseNodeType.Operator, 1],
      [ParseNodeType.LiteralInteger, 1]
    );
  });

  it('TestColoringLambdaWithComment', () => {
    const provider = new DefaultFsDataProvider();
    const expression = '(a)=>a //xyz';
    const { block, parseNode, errors, nextIndex } = parseExpression(expression, provider);

    expect(block, 'Parser should produce an expression block for lambda comment coloring').to.exist;
    expect(parseNode, 'Parser should produce a parse node for lambda comment coloring').to.exist;
    expect(errors, 'Lambda comment coloring sample should parse without errors').to.be.empty;

    assertRootNode(parseNode, expression);
    assertTreeSpanConsistency(parseNode);
    expect(nextIndex).to.equal(expression.length);

    const color = colorParseTree(parseNode);
    expect(color).to.have.lengthOf(7);
    assertNodeSequence(
      color,
      0,
      [ParseNodeType.OpenBrace, 1],
      [ParseNodeType.Identifier, 1],
      [ParseNodeType.CloseBrance, 1],
      [ParseNodeType.LambdaArrow, 2],
      [ParseNodeType.Identifier, 1],
      [ParseNodeType.WhiteSpace, 1],
      [ParseNodeType.Comment, 5]
    );
  });

  it('CaseParseNodeLengthMatchesExpressionSpan', () => {
    const provider = new DefaultFsDataProvider();
    const expression = 'case true: 1';
    const { parseNode, errors, nextIndex } = parseExpression(expression, provider);

    expect(errors, 'Parsing a simple case expression should not report errors').to.be.empty;
    expect(parseNode, 'Parser should produce a parse node for a valid case expression').to.exist;

    assertRootNode(parseNode, expression);
    assertTreeSpanConsistency(parseNode);
    expect(nextIndex).to.equal(expression.length);

    assertNodeSequence(parseNode.Childs, 0, [ParseNodeType.Case, expression.length]);
  });

  it('SwitchParseNodeLengthMatchesExpressionSpan', () => {
    const provider = new DefaultFsDataProvider();
    const expression = 'switch 1, 1: "one"';
    const { parseNode, errors, nextIndex } = parseExpression(expression, provider);

    expect(errors, 'Parsing a switch expression should not report errors').to.be.empty;
    expect(parseNode, 'Parser should produce a parse node for a valid switch expression').to.exist;

    assertRootNode(parseNode, expression);
    assertTreeSpanConsistency(parseNode);
    expect(nextIndex).to.equal(expression.length);

    assertNodeSequence(parseNode.Childs, 0, [ParseNodeType.Case, expression.length]);
  });

  it('GeneralInfixParseNodeUsesChildSpan', () => {
    const provider = new DefaultFsDataProvider();
    const expression = ' ["a","b"] join ","';
    const { parseNode, errors, nextIndex } = parseExpression(expression, provider);

    expect(errors, 'General infix parsing should succeed').to.be.empty;
    expect(parseNode, 'Parser should produce a parse node for general infix expressions').to.exist;

    assertRootNode(parseNode, expression);
    assertTreeSpanConsistency(parseNode);
    expect(nextIndex).to.equal(expression.length);

    assertNodeSequence(parseNode.Childs, 0, [ParseNodeType.GeneralInfixExpression, expression.length]);

    const infix = parseNode.Childs[0];
    const listSegmentLength = ' ["a","b"]'.length;
    assertNodeSequence(
      infix.Childs,
      0,
      [ParseNodeType.List, listSegmentLength],
      [ParseNodeType.WhiteSpace, 1],
      [ParseNodeType.Identifier, 4],
      [ParseNodeType.WhiteSpace, 1],
      [ParseNodeType.LiteralString, 3]
    );
  });

  it('GeneralInfixExpressionBlockLengthMatchesParseSpan', () => {
    const provider = new DefaultFsDataProvider();
    const part1 = "['a','b']";
    const part2 = 'join';
    const part3 = "','";
    const expression = ` ${part1} ${part2} ${part3}`;
    const { block, parseNode, errors, nextIndex } = parseExpression(expression, provider);

    expect(errors, 'General infix parsing should succeed').to.be.empty;
    expect(parseNode, 'Parser should produce a parse node for general infix expressions').to.exist;
    expect(block, 'General infix parsing should produce a function call expression').to.be.instanceOf(FunctionCallExpression);

    assertRootNode(parseNode, expression);
    assertTreeSpanConsistency(parseNode);
    expect(nextIndex).to.equal(expression.length);

    assertNodeSequence(parseNode.Childs, 0, [ParseNodeType.GeneralInfixExpression, expression.length]);

    const infix = parseNode.Childs[0];
    const listSegment = ` ${part1}`;
    assertNodeSequence(
      infix.Childs,
      0,
      [ParseNodeType.List, listSegment.length],
      [ParseNodeType.WhiteSpace, 1],
      [ParseNodeType.Identifier, part2.length],
      [ParseNodeType.WhiteSpace, 1],
      [ParseNodeType.LiteralString, part3.length]
    );

    const listNode = infix.Childs[0];
    assertNodeSequence(
      listNode.Childs,
      0,
      [ParseNodeType.WhiteSpace, 1],
      [ParseNodeType.OpenBrace, 1],
      [ParseNodeType.LiteralString, 3],
      [ParseNodeType.ListSeparator, 1],
      [ParseNodeType.LiteralString, 3],
      [ParseNodeType.CloseBrance, 1]
    );

    expect(block.Pos).to.equal(0);
    expect(block.Length).to.equal(expression.length);
    expect(block.Parameters).to.have.lengthOf(2);

    expect(block.Function.Pos).to.equal(1 + part1.length + 1);
    expect(block.Function.Length).to.equal(part2.length);

    expect(block.Parameters[0].Pos).to.equal(0);
    expect(block.Parameters[0].Length).to.equal(1 + part1.length);
    expect(block.Parameters[1].Pos).to.equal(1 + part1.length + 1 + part2.length + 1);
    expect(block.Parameters[1].Length).to.equal(part3.length);
  });

  it('GeneralInfixFunctionLiteralCapturesIdentifierSpan', () => {
    const provider = new DefaultFsDataProvider();
    const expression = ' ["a","b"] join ","';
    const { block, parseNode, errors, nextIndex } = parseExpression(expression, provider);

    expect(errors, 'General infix parsing should succeed').to.be.empty;
    expect(parseNode, 'Parser should produce a parse node for general infix expressions').to.exist;
    expect(block, 'General infix parsing should produce a function call expression').to.be.instanceOf(FunctionCallExpression);

    assertRootNode(parseNode, expression);
    assertTreeSpanConsistency(parseNode);
    expect(nextIndex).to.equal(expression.length);

    assertNodeSequence(parseNode.Childs, 0, [ParseNodeType.GeneralInfixExpression, expression.length]);

    const infix = parseNode.Childs[0];
    assertNodeSequence(
      infix.Childs,
      0,
      [ParseNodeType.List, ' ["a","b"]'.length],
      [ParseNodeType.WhiteSpace, 1],
      [ParseNodeType.Identifier, 4],
      [ParseNodeType.WhiteSpace, 1],
      [ParseNodeType.LiteralString, 3]
    );

    const call = block;
    expect(call.Parameters).to.have.lengthOf(2);
  });

  it('WhiteSpace1', () => {
    const provider = new DefaultFsDataProvider();
    const expression = '  x';
    const { block, parseNode, errors, nextIndex } = parseExpression(expression, provider);

    expect(errors, 'Parsing an identifier with leading whitespace should not report errors').to.be.empty;
    expect(block, 'Parser should produce an expression block').to.exist;
    expect(block).to.be.instanceOf(ReferenceBlock);
    expect(parseNode, 'Parser should produce a parse node for whitespace scenarios').to.exist;

    assertRootNode(parseNode, expression);
    assertTreeSpanConsistency(parseNode);
    expect(nextIndex).to.equal(expression.length);

    assertNodeSequence(
      parseNode.Childs,
      0,
      [ParseNodeType.WhiteSpace, 2],
      [ParseNodeType.Identifier, 1]
    );
  });

  it('ParseCommentTest1', () => {
    const provider = new DefaultFsDataProvider();
    const expression = '23//test';
    const { block, parseNode, errors, nextIndex } = parseExpression(expression, provider);

    expect(errors).to.be.empty;
    expect(parseNode).to.exist;

    assertRootNode(parseNode, expression);
    assertTreeSpanConsistency(parseNode);
    expect(nextIndex).to.equal(expression.length);

    assertNodeSequence(
      parseNode.Childs,
      0,
      [ParseNodeType.LiteralInteger, 2],
      [ParseNodeType.Comment, '//test'.length]
    );

    expect(block).to.be.instanceOf(LiteralBlock);
  });
});
