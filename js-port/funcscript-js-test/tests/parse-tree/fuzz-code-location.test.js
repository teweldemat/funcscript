const { expect } = require('chai');
const { valueOf } = require('@tewelde/funcscript');
const {
  parseExpression,
  DefaultFsDataProvider
} = require('../helpers/parser');
const { FunctionCallExpression } = require('../../../funcscript-js/src/block/function-call-expression');
const { LiteralBlock } = require('../../../funcscript-js/src/block/literal-block');
const { ReferenceBlock } = require('../../../funcscript-js/src/block/reference-block');
const { SelectorExpression } = require('../../../funcscript-js/src/block/selector-expression');
const { KvcMemberFunction } = require('../../../funcscript-js/src/funcs/keyvalue/kvc-member-function');

function parseAndEnsure(expression) {
  const provider = new DefaultFsDataProvider();
  const result = parseExpression(expression, provider);
  expect(result.errors, 'parsing should not produce errors').to.be.empty;
  expect(result.block, 'parser should produce an expression block').to.exist;
  return result;
}

function collectBlocks(root, predicate) {
  const found = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    if (predicate(current)) {
      found.push(current);
    }
    if (typeof current.getChilds === 'function') {
      const children = current.getChilds();
      if (Array.isArray(children) && children.length > 0) {
        for (let i = children.length - 1; i >= 0; i -= 1) {
          stack.push(children[i]);
        }
      }
    }
  }
  return found;
}

function matchesLiteral(block, expectedValue) {
  if (!(block instanceof LiteralBlock)) {
    return false;
  }
  const typed = block.value;
  if (!Array.isArray(typed)) {
    return false;
  }
  const raw = valueOf(typed);
  if (typeof raw === 'bigint') {
    return raw === BigInt(expectedValue);
  }
  return raw === expectedValue;
}

function assertLiteralLocation(expression, literalText, expectedValue) {
  const { block } = parseAndEnsure(expression);
  const matches = collectBlocks(block, (candidate) => matchesLiteral(candidate, expectedValue));
  expect(matches, 'should find exactly one matching literal block').to.have.lengthOf(1);
  const found = matches[0];
  const expectedPos = expression.indexOf(literalText);
  expect(expectedPos, 'literal text should exist in the expression').to.be.at.least(0);
  expect(found.Pos, 'literal position mismatch').to.equal(expectedPos);
  expect(found.Length, 'literal length mismatch').to.equal(literalText.length);
}

describe('FuzzCodeLocation', () => {
  it('FuzzCodeLocationTest1', () => {
    const left = '{\n    prop1:123;\n    prop2:';
    const target = '456';
    const right = ';\n}';
    const expression = `${left}${target}${right}`;
    const { block } = parseAndEnsure(expression);
    const matches = collectBlocks(
      block,
      (candidate) => candidate instanceof LiteralBlock && matchesLiteral(candidate, 456)
    );
    expect(matches).to.have.lengthOf(1);
    const found = matches[0];
    expect(found.Pos).to.equal(left.length);
    expect(found.Length).to.equal(target.length);
  });

  it('FuzzCodeLocationTest2', () => {
    const target = '[5,6].l';
    const left = '10+';
    const expression = `${left}${target}`;
    const { block } = parseAndEnsure(expression);
    const matches = collectBlocks(
      block,
      (candidate) =>
        candidate instanceof FunctionCallExpression &&
        candidate.Function instanceof LiteralBlock &&
        valueOf(candidate.Function.value) instanceof KvcMemberFunction
    );
    expect(matches).to.have.lengthOf(1);
    const found = matches[0];
    expect(found.Pos).to.equal(left.length);
    expect(found.Length).to.equal(target.length);
  });

  it('FunctionCallWithNestedStructuresMaintainsSpan', () => {
    const expression = 'process({ input: [1, 2, 3]; }, 99)';
    const { block } = parseAndEnsure(expression);
    const matches = collectBlocks(
      block,
      (candidate) =>
        candidate instanceof FunctionCallExpression &&
        candidate.Function instanceof ReferenceBlock &&
        candidate.Function.name === 'process'
    );
    expect(matches).to.have.lengthOf(1);
    const found = matches[0];
    expect(found.Pos).to.equal(0);
    expect(found.Length).to.equal(expression.length);
  });

  it('SelectorExpressionMaintainsSourceSpan', () => {
    const expression = 'items{ select: value; }';
    const { block } = parseAndEnsure(expression);
    const matches = collectBlocks(block, (candidate) => candidate instanceof SelectorExpression);
    expect(matches).to.have.lengthOf(1);
    const found = matches[0];
    expect(found.Pos).to.equal(0);
    expect(found.Length).to.equal(expression.length);
  });

  it('StringLiteralWithEscapesHasCorrectLocation', () => {
    const expression = 'prefix + "line\\nvalue"';
    const { block } = parseAndEnsure(expression);
    const matches = collectBlocks(
      block,
      (candidate) =>
        candidate instanceof LiteralBlock &&
        valueOf(candidate.value) === 'line\nvalue'
    );
    expect(matches).to.have.lengthOf(1);
    const found = matches[0];
    const target = '"line\\nvalue"';
    const expectedStart = expression.indexOf(target);
    expect(found.Pos).to.equal(expectedStart);
    expect(found.Length).to.equal(target.length);
  });

  it('MemberAccessAfterFunctionCallPreservesSpan', () => {
    const expression = 'dataset.load().summary';
    const { block } = parseAndEnsure(expression);
    const matches = collectBlocks(
      block,
      (candidate) =>
        candidate instanceof FunctionCallExpression &&
        candidate.Function instanceof LiteralBlock &&
        valueOf(candidate.Function.value) instanceof KvcMemberFunction &&
        candidate.Length === expression.length
    );
    expect(matches).to.have.lengthOf(1);
    const found = matches[0];
    expect(found.Pos).to.equal(0);
    expect(found.Length).to.equal(expression.length);
  });

  it('ReferenceBlockTrimsLeadingWhitespace', () => {
    const expression = '   SomeIdentifier';
    const { block } = parseAndEnsure(expression);
    const matches = collectBlocks(
      block,
      (candidate) => candidate instanceof ReferenceBlock && candidate.name === 'SomeIdentifier'
    );
    expect(matches).to.have.lengthOf(1);
    const found = matches[0];
    const expectedStart = expression.indexOf('SomeIdentifier');
    expect(found.Pos).to.equal(expectedStart);
    expect(found.Length).to.equal('SomeIdentifier'.length);
  });

  it('ListLiteralMaintainsMiddleValueLocation', () => {
    const expression = '[10, 456, 20]';
    assertLiteralLocation(expression, '456', 456);
  });

  it('NestedCollectionsPreserveLiteralLocation', () => {
    const expression = '{\n  parent: {\n    child: 456;\n  };\n}';
    assertLiteralLocation(expression, '456', 456);
  });

  it('WindowsLineEndingsWithIndentation', () => {
    const expression = '   {\r\n    value: 456;\r\n}';
    assertLiteralLocation(expression, '456', 456);
  });
});
