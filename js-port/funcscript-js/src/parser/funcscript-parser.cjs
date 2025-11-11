'use strict';

const { ParseNodeType, ParseNode, SyntaxErrorData } = require('./parse-node');
const {
  ParseContext,
  ParseResult,
  ParseBlockResult,
  ParseBlockResultWithNode,
  ValueParseResult,
  IdenResult
} = require('./context');
const {
  createNodeBuffer,
  commitNodeBuffer,
  getLiteralMatch,
  getToken,
  getWhitespaceToken,
  skipSpace,
  getSimpleString,
  getSpaceLessString,
  getIdentifier,
  getKeyWord,
  getKeyWordLiteral,
  getNumber,
  getInt,
  getCommentBlock,
  isIdentifierOtherChar,
  isIdentifierFirstChar,
  identifierMetrics,
  literalMatchMetrics,
  resetIdentifierMetrics,
  resetLiteralMatchMetrics
} = require('./helpers/utils');
const { FunctionCallExpression } = require('../block/function-call-expression');
const { LiteralBlock } = require('../block/literal-block');
const { ListExpression } = require('../block/list-expression');
const { KvcExpression, KeyValueExpression } = require('../block/kvc-expression');
const { SelectorExpression } = require('../block/selector-expression');
const { ReferenceBlock } = require('../block/reference-block');
const { NullExpressionBlock } = require('../block/null-expression-block');
const { ExpressionFunction } = require('../core/expression-function');
const { CallType } = require('../core/function-base');

// Mirrors FuncScript/Parser/FuncScriptParser.Main.cs :: s_operatorSymols
const OPERATOR_SYMBOLS = [
  ['^'],
  ['*', 'div', '/', '%'],
  ['+', '-'],
  ['>=', '<=', '!=', '>', '<', 'in'],
  ['==', '=', '??', '?!', '?.'],
  ['or', 'and'],
  ['|'],
  ['>>']
];

// Mirrors FuncScript/Parser/FuncScriptParser.Main.cs :: s_prefixOp
const PREFIX_OPERATORS = [
  ['!', '!'],
  ['-', 'negate']
];

// Mirrors FuncScript/Parser/FuncScriptParser.Main.cs keyword initialization
const KEYWORDS = new Set(['return', 'eval', 'fault', 'case', 'switch', 'then', 'else']);
const KEY_NODE_CHILD_TYPES = new Set([
  ParseNodeType.Identifier,
  ParseNodeType.LiteralString,
  ParseNodeType.StringTemplate
]);

function unwrapRootNode(node) {
  if (!node) {
    return null;
  }
  if (node.NodeType === ParseNodeType.RootExpression && Array.isArray(node.Childs) && node.Childs.length === 1) {
    return node.Childs[0];
  }
  return node;
}

// ---------------------------------------------------------------------------
// Syntax helpers ported from FuncScript/Parser/Syntax/*.cs
// ---------------------------------------------------------------------------

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetExpression.cs :: GetExpression
function getExpression(context, siblings, index) {
  return getInfixExpression(context, siblings, index);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetInfixExpression.cs :: GetInfixExpression
function getInfixExpression(context, siblings, index) {
  const childNodes = [];
  const result = getInfixExpressionSingleLevel(
    context,
    childNodes,
    OPERATOR_SYMBOLS.length - 1,
    OPERATOR_SYMBOLS[OPERATOR_SYMBOLS.length - 1],
    index
  );

  if (result.hasProgress(index)) {
    const hasOperator = childNodes.some((n) => n.NodeType === ParseNodeType.Operator);
    if (!hasOperator) {
      for (const node of childNodes) {
        siblings.push(node);
      }
    } else {
      siblings.push(new ParseNode(ParseNodeType.InfixExpression, index, result.NextIndex - index, childNodes));
    }
    return result;
  }

  return ParseResult.noAdvance(index);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetInfixExpressionSingleLevel.cs :: GetInfixExpressionSingleLevel
function getInfixExpressionSingleLevel(context, siblings, level, candidates, index) {
  if (!context) {
    throw new Error('context is required');
  }
  if (!candidates) {
    throw new Error('candidates are required');
  }

  const errors = context.ErrorsList;
  const nodes = [];

  let operandResult;
  let currentIndex = index;
  if (level === 0) {
    operandResult = getInfixFunctionCall(context, nodes, currentIndex);
  } else {
    operandResult = getInfixExpressionSingleLevel(
      context,
      nodes,
      level - 1,
      OPERATOR_SYMBOLS[level - 1],
      currentIndex
    );
  }

  if (!operandResult.hasProgress(currentIndex) || !operandResult.ExpressionBlock) {
    return ParseResult.noAdvance(index);
  }

  let currentExpression = operandResult.ExpressionBlock;
  currentIndex = operandResult.NextIndex;

  while (true) {
    const operatorResult = getOperator(context, nodes, candidates, currentIndex);
    if (!operatorResult.hasProgress(currentIndex)) {
      break;
    }

    const symbol = operatorResult.Value.symbol;
    const operatorNode = nodes.length > 0 ? nodes[nodes.length - 1] : null;
    currentIndex = operatorResult.NextIndex;
    const indexBeforeOperator = currentIndex;

    const operands = [currentExpression];

    while (true) {
      let nextOperand;
      if (level === 0) {
        nextOperand = getInfixFunctionCall(context, nodes, currentIndex);
      } else {
        nextOperand = getInfixExpressionSingleLevel(
          context,
          nodes,
          level - 1,
          OPERATOR_SYMBOLS[level - 1],
          currentIndex
        );
      }

      if (!nextOperand.hasProgress(currentIndex) || !nextOperand.ExpressionBlock) {
        return ParseResult.noAdvance(indexBeforeOperator);
      }

      operands.push(nextOperand.ExpressionBlock);
      currentIndex = nextOperand.NextIndex;

      const repeated = getToken(context, currentIndex, nodes, ParseNodeType.Operator, symbol);
      if (repeated === currentIndex) {
        break;
      }
      currentIndex = repeated;
    }

    if (operands.length < 2) {
      return ParseResult.noAdvance(indexBeforeOperator);
    }

    const startPos = operands[0].Pos;
    const last = operands[operands.length - 1];
    const endPos = last.Pos + last.Length;

    let combined;
    if (symbol === '|') {
      if (operands.length > 2) {
        errors.push(new SyntaxErrorData(currentIndex, 0, 'Only two parameters expected for | '));
        return ParseResult.noAdvance(indexBeforeOperator);
      }
      const list = new ListExpression();
      list.ValueExpressions = operands.slice();
      list.Pos = startPos;
      list.Length = endPos - startPos;
      combined = list;
    } else {
      const fnValue = context.Provider.get(symbol);
      const fnLiteral = new LiteralBlock(fnValue);
      if (operatorNode) {
        fnLiteral.Pos = operatorNode.Pos;
        fnLiteral.Length = operatorNode.Length;
      }
      combined = new FunctionCallExpression(fnLiteral, operands.slice(), startPos, endPos - startPos);
    }

    currentExpression = combined;
  }

  for (const node of nodes) {
    siblings.push(node);
  }

  return new ParseBlockResult(currentIndex, currentExpression);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetInfixExpressionSingleOp.cs :: GetInfixExpressionSingleOp
function getInfixExpressionSingleOp(context, siblings, level, candidates, index) {
  if (!context) {
    throw new Error('context is required');
  }
  if (!candidates) {
    throw new Error('candidates are required');
  }

  const errors = context.ErrorsList;
  const buffer = createNodeBuffer(siblings);

  let operandResult;
  let currentIndex = index;
  if (level === 0) {
    operandResult = getCallAndMemberAccess(context, [], currentIndex);
  } else {
    operandResult = getInfixExpressionSingleOp(
      context,
      [],
      level - 1,
      OPERATOR_SYMBOLS[level - 1],
      currentIndex
    );
  }

  if (!operandResult.hasProgress(currentIndex) || !operandResult.ExpressionBlock) {
    return ParseResult.noAdvance(index);
  }

  let currentExpression = operandResult.ExpressionBlock;
  currentIndex = operandResult.NextIndex;

  while (true) {
    const operatorResult = getOperator(context, buffer, candidates, currentIndex);
    if (!operatorResult.hasProgress(currentIndex)) {
      break;
    }

    const symbol = operatorResult.Value.symbol;
    currentIndex = operatorResult.NextIndex;
    const indexBeforeOperator = currentIndex;

    const operands = [currentExpression];

    const operandNodes = [];
    while (true) {
      let nextOperand;
      if (level === 0) {
        nextOperand = getCallAndMemberAccess(context, operandNodes, currentIndex);
      } else {
        nextOperand = getInfixExpressionSingleOp(
          context,
          operandNodes,
          level - 1,
          OPERATOR_SYMBOLS[level - 1],
          currentIndex
        );
      }

      if (!nextOperand.hasProgress(currentIndex) || !nextOperand.ExpressionBlock) {
        return ParseResult.noAdvance(indexBeforeOperator);
      }

      operands.push(nextOperand.ExpressionBlock);
      currentIndex = nextOperand.NextIndex;

      const repeated = getToken(context, currentIndex, buffer, ParseNodeType.Operator, symbol);
      if (repeated === currentIndex) {
        break;
      }
      currentIndex = repeated;
    }

    if (operands.length < 2) {
      return ParseResult.noAdvance(indexBeforeOperator);
    }

    const startPos = operands[0].Pos;
    const last = operands[operands.length - 1];
    const endPos = last.Pos + last.Length;

    let combined;
    if (symbol === '|') {
      if (operands.length > 2) {
        errors.push(new SyntaxErrorData(currentIndex, 0, 'Only two parameters expected for | '));
        return ParseResult.noAdvance(indexBeforeOperator);
      }
      const list = new ListExpression();
      list.ValueExpressions = operands.slice();
      list.Pos = startPos;
      list.Length = endPos - startPos;
      combined = list;
    } else {
      const fnValue = context.Provider.get(symbol);
      const fnLiteral = new LiteralBlock(fnValue);
      combined = new FunctionCallExpression(fnLiteral, operands.slice(), startPos, endPos - startPos);
    }

    currentExpression = combined;
  }

  commitNodeBuffer(siblings, buffer);
  return new ParseBlockResult(currentIndex, currentExpression);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetOperator.cs :: GetOperator
function getOperator(context, siblings, candidates, index) {
  if (!context) {
    throw new Error('context is required');
  }
  if (!candidates) {
    throw new Error('candidates are required');
  }

  const buffer = createNodeBuffer(siblings);
  const currentIndex = skipSpace(context, buffer, index);
  for (const op of candidates) {
    const nextIndex = getLiteralMatch(context.Expression, currentIndex, op);
    if (nextIndex <= currentIndex) {
      continue;
    }
    const fnValue = context.Provider.get(op);
    buffer.push(new ParseNode(ParseNodeType.Operator, currentIndex, nextIndex - currentIndex));
    commitNodeBuffer(siblings, buffer);
    return new ValueParseResult(nextIndex, { symbol: op, fnValue });
  }
  return new ValueParseResult(index, null);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetInfixFunctionCall.cs :: GetInfixFunctionCall
function getInfixFunctionCall(context, siblings, index) {
  const buffer = createNodeBuffer(siblings);
  const operands = [];

  const firstOperandResult = getCallAndMemberAccess(context, buffer, index);
  if (!firstOperandResult.hasProgress(index) || !firstOperandResult.ExpressionBlock) {
    return ParseResult.noAdvance(index);
  }

  operands.push(firstOperandResult.ExpressionBlock);
  let currentIndex = firstOperandResult.NextIndex;

  const iden = getIdentifier(context, buffer, currentIndex, KEYWORDS);
  const afterIdentifier = iden.NextIndex;
  if (afterIdentifier === currentIndex) {
    commitNodeBuffer(siblings, buffer);
    return firstOperandResult;
  }

  const fnTyped = context.Provider && typeof context.Provider.get === 'function'
    ? context.Provider.get(iden.IdenLower)
    : null;
  const fnRaw = Array.isArray(fnTyped) ? fnTyped[1] : fnTyped;
  if (!fnRaw || typeof fnRaw.callType !== 'string') {
    context.ErrorsList.push(new SyntaxErrorData(currentIndex, afterIdentifier - currentIndex, 'A function expected'));
    return ParseResult.noAdvance(index);
  }

  if (fnRaw.callType !== CallType.Dual) {
    commitNodeBuffer(siblings, buffer);
    return firstOperandResult;
  }

  currentIndex = afterIdentifier;

  const secondOperandResult = getCallAndMemberAccess(context, buffer, currentIndex);
  if (!secondOperandResult.hasProgress(currentIndex) || !secondOperandResult.ExpressionBlock) {
    context.ErrorsList.push(new SyntaxErrorData(currentIndex, 0, `Right side operand expected for ${iden.Iden}`));
    return ParseResult.noAdvance(index);
  }

  operands.push(secondOperandResult.ExpressionBlock);
  currentIndex = secondOperandResult.NextIndex;

  while (true) {
    const afterChain = getToken(context, currentIndex, buffer, ParseNodeType.ThirdOperandDelimeter, '~');
    if (afterChain === currentIndex) {
      break;
    }
    currentIndex = afterChain;
    const nextOperand = getCallAndMemberAccess(context, buffer, currentIndex);
    if (!nextOperand.hasProgress(currentIndex) || !nextOperand.ExpressionBlock) {
      break;
    }
    operands.push(nextOperand.ExpressionBlock);
    currentIndex = nextOperand.NextIndex;
  }

  if (operands.length < 2) {
    return ParseResult.noAdvance(index);
  }

  const fnLiteral = new LiteralBlock(fnTyped);
  fnLiteral.Pos = iden.StartIndex;
  fnLiteral.Length = iden.Length;

  const firstNode = buffer.find((n) => n.NodeType !== ParseNodeType.WhiteSpace);
  const startPos = firstNode ? firstNode.Pos : (buffer.length > 0 ? buffer[0].Pos : index);
  const expressionLength = Math.max(0, currentIndex - startPos);
  const nodeChildren = buffer.filter((n) => n.Pos >= startPos);

  const call = new FunctionCallExpression(fnLiteral, operands.slice(), startPos, expressionLength);

  siblings.push(new ParseNode(ParseNodeType.GeneralInfixExpression, startPos, expressionLength, nodeChildren));

  return new ParseBlockResult(currentIndex, call);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetCallAndMemberAccess.cs :: GetCallAndMemberAccess
function getCallAndMemberAccess(context, siblings, index) {
  if (!context) {
    throw new Error('context is required');
  }

  let currentIndex = index;
  const unitNodes = [];
  const unitResult = getUnit(context, unitNodes, currentIndex);
  if (!unitResult.hasProgress(currentIndex) || !unitResult.ExpressionBlock) {
    return ParseResult.noAdvance(index);
  }

  let expression = unitResult.ExpressionBlock;
  currentIndex = unitResult.NextIndex;

  for (const node of unitNodes) {
    siblings.push(node);
  }

  while (true) {
    const callChildren = [];
    const callResult = getFunctionCallParametersList(context, callChildren, expression, currentIndex);
    if (callResult.hasProgress(currentIndex) && callResult.ExpressionBlock) {
      expression = callResult.ExpressionBlock;
      currentIndex = callResult.NextIndex;
      for (const node of callChildren) {
        siblings.push(node);
      }
      continue;
    }

    const memberChildren = [];
    const memberResult = getMemberAccess(context, memberChildren, expression, currentIndex);
    if (memberResult.hasProgress(currentIndex) && memberResult.ExpressionBlock) {
      expression = memberResult.ExpressionBlock;
      currentIndex = memberResult.NextIndex;
      for (const node of memberChildren) {
        siblings.push(node);
      }
      continue;
    }

    const selectorChildren = [];
    const selectorResult = getKvcExpression(context, selectorChildren, false, currentIndex);
    if (selectorResult.hasProgress(currentIndex) && selectorResult.ExpressionBlock) {
      const selector = new SelectorExpression();
      selector.Source = expression;
      selector.Selector = selectorResult.ExpressionBlock;
      const selectorStart = typeof expression.Pos === 'number' ? expression.Pos : currentIndex;
      selector.Pos = selectorStart;
      selector.Length = selectorResult.NextIndex - selectorStart;
      expression = selector;
      currentIndex = selectorResult.NextIndex;
      for (const node of selectorChildren) {
        siblings.push(node);
      }
      continue;
    }

    break;
  }

  return new ParseBlockResult(currentIndex, expression);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetFunctionCallParametersList.cs :: GetFunctionCallParametersList
function getFunctionCallParametersList(context, siblings, funcExpression, index) {
  if (!context) {
    throw new Error('context is required');
  }
  if (!funcExpression) {
    throw new Error('function expression is required');
  }

  const roundResult = parseParameters(context, siblings, funcExpression, index, '(', ')');
  if (roundResult.hasProgress(index)) {
    return roundResult;
  }

  const squareResult = parseParameters(context, siblings, funcExpression, index, '[', ']');
  if (squareResult.hasProgress(index)) {
    return squareResult;
  }

  return ParseResult.noAdvance(index);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetFunctionCallParametersList.cs :: ParseParameters
function parseParameters(context, siblings, funcExpression, index, openToken, closeToken) {
  const nodeItems = [];
  let currentIndex = getToken(context, index, nodeItems, ParseNodeType.OpenBrace, openToken);
  if (currentIndex === index) {
    return ParseResult.noAdvance(index);
  }

  const parameters = [];

  const firstResult = getExpression(context, nodeItems, currentIndex);
  if (firstResult.hasProgress(currentIndex) && firstResult.ExpressionBlock) {
    parameters.push(firstResult.ExpressionBlock);
    currentIndex = firstResult.NextIndex;

    while (true) {
      const afterComma = getToken(context, currentIndex, nodeItems, ParseNodeType.ListSeparator, ',');
      if (afterComma === currentIndex) {
        break;
      }

      const nextParameter = getExpression(context, nodeItems, afterComma);
      if (!nextParameter.hasProgress(afterComma) || !nextParameter.ExpressionBlock) {
        context.ErrorsList.push(new SyntaxErrorData(afterComma, 0, 'Parameter for call expected'));
        return ParseResult.noAdvance(index);
      }

      parameters.push(nextParameter.ExpressionBlock);
      currentIndex = nextParameter.NextIndex;
    }
  }

  const afterClose = getToken(context, currentIndex, nodeItems, ParseNodeType.CloseBrance, closeToken);
  if (afterClose === currentIndex) {
    context.ErrorsList.push(new SyntaxErrorData(currentIndex, 0, `'${closeToken}' expected`));
    return ParseResult.noAdvance(index);
  }

  currentIndex = afterClose;
  const startPos = nodeItems.length > 0 ? nodeItems[0].Pos : index;
  const node = new ParseNode(
    ParseNodeType.FunctionParameterList,
    startPos,
    currentIndex - startPos,
    nodeItems
  );
  siblings.push(node);

  const call = new FunctionCallExpression(
    funcExpression,
    parameters.slice(),
    funcExpression.Pos,
    currentIndex - funcExpression.Pos
  );

  return new ParseBlockResult(currentIndex, call);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetMemberAccess.cs :: GetMemberAccess (dispatcher)
function getMemberAccess(context, siblings, source, index) {
  if (!context) {
    throw new Error('context is required');
  }
  if (!source) {
    throw new Error('source is required');
  }

  const dotBuffer = createNodeBuffer(siblings);
  const dotResult = parseMemberAccessOperator(context, dotBuffer, '.', source, index);
  if (dotResult.hasProgress(index)) {
    commitNodeBuffer(siblings, dotBuffer);
    return dotResult;
  }

  const safeBuffer = createNodeBuffer(siblings);
  const safeResult = parseMemberAccessOperator(context, safeBuffer, '?.', source, index);
  if (safeResult.hasProgress(index)) {
    commitNodeBuffer(siblings, safeBuffer);
    return safeResult;
  }

  return ParseResult.noAdvance(index);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetMemberAccess.cs :: GetMemberAccess (implementation)
function parseMemberAccessOperator(context, siblings, oper, source, index) {
  if (!context) {
    throw new Error('context is required');
  }
  if (!oper) {
    throw new Error('operator token is required');
  }
  if (!source) {
    throw new Error('source is required');
  }

  const errors = context.ErrorsList;
  const afterOperator = getToken(context, index, siblings, ParseNodeType.Operator, oper);
  if (afterOperator === index) {
    return ParseResult.noAdvance(index);
  }

  const memberIndex = afterOperator;
  const iden = getIdentifier(context, siblings, memberIndex, KEYWORDS);
  const afterIdentifier = iden.NextIndex;
  if (afterIdentifier === memberIndex) {
    errors.push(new SyntaxErrorData(memberIndex, 0, 'member identifier expected'));
    return ParseResult.noAdvance(index);
  }

  let functionTyped = null;
  if (context.Provider && typeof context.Provider.get === 'function') {
    functionTyped = context.Provider.get(oper);
  }
  const fnLiteral = new LiteralBlock(functionTyped);
  const nameLiteral = new LiteralBlock(iden.Iden);
  const expression = new FunctionCallExpression(
    fnLiteral,
    [source, nameLiteral],
    source.Pos,
    afterIdentifier - source.Pos
  );

  const parseNode = new ParseNode(ParseNodeType.MemberAccess, index, afterIdentifier - index);
  siblings.push(parseNode);
  return new ParseBlockResult(afterIdentifier, expression);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetKvcExpression.cs :: GetKvcExpression
function getKvcExpression(context, siblings, nakedMode, index) {
  if (!context) {
    throw new Error('context is required');
  }

  const errors = context.ErrorsList;
  let currentIndex = index;
  const nodeItems = [];

  if (!nakedMode) {
    const afterOpen = getToken(context, currentIndex, nodeItems, ParseNodeType.OpenBrace, '{');
    if (afterOpen === currentIndex) {
      return ParseResult.noAdvance(index);
    }
    currentIndex = afterOpen;
  }

  const keyValues = [];
  let returnExpression = null;

  while (true) {
    const itemResult = getKvcItem(context, nodeItems, nakedMode, currentIndex);
    if (!itemResult.hasProgress(currentIndex)) {
      break;
    }

    if (!itemResult.Value) {
      break;
    }

    if (itemResult.Value.Key == null) {
      if (returnExpression) {
        errors.push(new SyntaxErrorData(currentIndex, nodeItems.length, 'Duplicate return statement'));
        return ParseResult.noAdvance(index);
      }
      returnExpression = itemResult.Value.ValueExpression;
    } else {
      keyValues.push(itemResult.Value);
    }

    currentIndex = itemResult.NextIndex;

    const afterSeparator = getToken(context, currentIndex, nodeItems, ParseNodeType.ListSeparator, ',', ';');
    if (afterSeparator > currentIndex) {
      currentIndex = afterSeparator;
    }
  }

  if (!nakedMode) {
    const afterClose = getToken(context, currentIndex, nodeItems, ParseNodeType.CloseBrance, '}');
    if (afterClose === currentIndex) {
      errors.push(new SyntaxErrorData(currentIndex, 0, "'}' expected"));
      return ParseResult.noAdvance(index);
    }
    currentIndex = afterClose;
  } else if (keyValues.length === 0 && !returnExpression) {
    return ParseResult.noAdvance(index);
  }

  const kvc = new KvcExpression();
  const validationError = kvc.SetKeyValues(keyValues, returnExpression);
  if (validationError) {
    errors.push(new SyntaxErrorData(index, currentIndex - index, validationError));
    return ParseResult.noAdvance(index);
  }

  if (typeof kvc === 'object') {
    kvc.Pos = index;
    kvc.Length = currentIndex - index;
  }

  const parseNode = new ParseNode(
    ParseNodeType.KeyValueCollection,
    index,
    currentIndex - index,
    nodeItems
  );
  siblings.push(parseNode);
  return new ParseBlockResult(currentIndex, kvc);
}

function markKeyNodes(childNodes, snapshotIndex, keyStart, keyLength) {
  if (!Array.isArray(childNodes) || keyLength <= 0) {
    return;
  }
  const keyEnd = keyStart + keyLength;
  for (let index = snapshotIndex; index < childNodes.length; index += 1) {
    const node = childNodes[index];
    if (
      node &&
      node.Pos >= keyStart &&
      node.Pos + node.Length <= keyEnd &&
      KEY_NODE_CHILD_TYPES.has(node.NodeType)
    ) {
      node.NodeType = ParseNodeType.Key;
    }
  }
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetKvcItem.cs :: GetKvcItem
function getKvcItem(context, siblings, nakedKvc, index) {
  if (!context) {
    throw new Error('context is required');
  }

  const keyValueBuffer = createNodeBuffer(siblings);
  const keyPair = getKeyValuePair(context, keyValueBuffer, index);
  if (keyPair.hasProgress(index)) {
    commitNodeBuffer(siblings, keyValueBuffer);
    return new ValueParseResult(keyPair.NextIndex, keyPair.Value);
  }

  const returnBuffer = createNodeBuffer(siblings);
  const returnResult = getReturnDefinition(context, returnBuffer, index);
  if (returnResult.hasProgress(index) && returnResult.ExpressionBlock) {
    commitNodeBuffer(siblings, returnBuffer);
    const item = new KeyValueExpression();
    item.Key = null;
    item.ValueExpression = returnResult.ExpressionBlock;
    return new ValueParseResult(returnResult.NextIndex, item);
  }

  if (!nakedKvc) {
    const identifierBuffer = createNodeBuffer(siblings);
    const iden = getIdentifier(context, identifierBuffer, index, KEYWORDS);
    const identifierIndex = iden.NextIndex;
    if (identifierIndex > index) {
      commitNodeBuffer(siblings, identifierBuffer);
      const reference = new ReferenceBlock(iden.Iden, iden.StartIndex, iden.Length);
      const item = new KeyValueExpression();
      item.Key = iden.Iden;
      item.KeyLower = iden.IdenLower;
      item.ValueExpression = reference;
      return new ValueParseResult(identifierIndex, item);
    }

    const stringErrors = [];
    const stringBuffer = createNodeBuffer(siblings);
    const stringResult = getSimpleString(context, stringBuffer, index, stringErrors);
    if (stringResult.NextIndex > index) {
      commitNodeBuffer(siblings, stringBuffer);
      const key = stringResult.Value;
      const reference = new ReferenceBlock(key, stringResult.StartIndex, stringResult.Length);
      const item = new KeyValueExpression();
      item.Key = key;
      item.KeyLower = key ? key.toLowerCase() : null;
      item.ValueExpression = reference;
      return new ValueParseResult(stringResult.NextIndex, item);
    }
  }

  return new ValueParseResult(index, null);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetKeyValuePair.cs :: GetKeyValuePair
function getKeyValuePair(context, siblings, index) {
  if (!context) {
    throw new Error('context is required');
  }

  const buffer = createNodeBuffer(siblings);
  const childNodes = [];

  const keyErrors = [];
  let currentIndex = index;
  let name = null;
  let keyStart = 0;
  let keyLength = 0;
  let keyCaptureIndex = childNodes.length;
  const nameResult = getSimpleString(context, childNodes, currentIndex, keyErrors);
  if (nameResult.NextIndex === currentIndex) {
    keyCaptureIndex = childNodes.length;
    const iden = getIdentifier(context, childNodes, currentIndex, KEYWORDS);
    currentIndex = iden.NextIndex;
    if (currentIndex === index) {
      return new ValueParseResult(index, null);
    }
    name = iden.Iden;
    keyStart = iden.StartIndex;
    keyLength = iden.Length;
  } else {
    currentIndex = nameResult.NextIndex;
    name = nameResult.Value;
    keyStart = nameResult.StartIndex;
    keyLength = nameResult.Length;
  }

  markKeyNodes(childNodes, keyCaptureIndex, keyStart, keyLength);

  const afterColon = getToken(context, currentIndex, childNodes, ParseNodeType.Colon, ':');
  if (afterColon === currentIndex) {
    return new ValueParseResult(index, null);
  }

  currentIndex = afterColon;
  const valueResult = getExpression(context, childNodes, currentIndex);
  if (!valueResult.hasProgress(currentIndex) || !valueResult.ExpressionBlock) {
    context.ErrorsList.push(new SyntaxErrorData(currentIndex, 0, 'value expression expected'));
    return new ValueParseResult(index, null);
  }

  currentIndex = valueResult.NextIndex;
  const item = new KeyValueExpression();
  item.Key = name;
  item.ValueExpression = valueResult.ExpressionBlock;

  const parseNode = new ParseNode(
    ParseNodeType.KeyValuePair,
    index,
    currentIndex - index,
    childNodes
  );
  buffer.push(...childNodes);
  buffer.push(parseNode);
  commitNodeBuffer(siblings, buffer);
  return new ValueParseResult(currentIndex, item);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetReturnDefinition.cs :: GetReturnDefinition
function getReturnDefinition(context, siblings, index) {
  if (!context) {
    throw new Error('context is required');
  }

  const childNodes = [];
  let keywordResult = getKeyWord(context, childNodes, index, 'return');
  if (keywordResult === index) {
    keywordResult = getKeyWord(context, childNodes, index, 'eval');
    if (keywordResult === index) {
      return ParseResult.noAdvance(index);
    }
  }

  let currentIndex = keywordResult;
  currentIndex = skipSpace(context, childNodes, currentIndex);
  const valueResult = getExpression(context, childNodes, currentIndex);
  if (!valueResult.hasProgress(currentIndex) || !valueResult.ExpressionBlock) {
    context.ErrorsList.push(new SyntaxErrorData(currentIndex, 0, 'return/eval expression expected'));
    return ParseResult.noAdvance(index);
  }

  currentIndex = valueResult.NextIndex;
  const expression = valueResult.ExpressionBlock;
  expression.Pos = index;
  expression.Length = currentIndex - index;

  const node = new ParseNode(
    ParseNodeType.ExpressionInBrace,
    index,
    currentIndex - index,
    childNodes
  );
  siblings.push(node);

  return new ParseBlockResult(currentIndex, expression);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetListExpression.cs :: GetListExpression
function getListExpression(context, siblings, index) {
  if (!context) {
    throw new Error('context is required');
  }

  const nodes = [];
  let currentIndex = index;
  const afterOpen = getToken(context, currentIndex, nodes, ParseNodeType.OpenBrace, '[');
  if (afterOpen === currentIndex) {
    return ParseResult.noAdvance(index);
  }

  const listStart = nodes.length > 0 ? nodes[0].Pos : currentIndex;
  currentIndex = afterOpen;
  const items = [];

  const firstResult = getExpression(context, nodes, currentIndex);
  if (firstResult.hasProgress(currentIndex)) {
    if (firstResult.ExpressionBlock) {
      items.push(firstResult.ExpressionBlock);
    }
    currentIndex = firstResult.NextIndex;

    while (true) {
      const afterComma = getToken(context, currentIndex, nodes, ParseNodeType.ListSeparator, ',');
      if (afterComma === currentIndex) {
        break;
      }
      currentIndex = afterComma;
      const nextResult = getExpression(context, nodes, currentIndex);
      if (!nextResult.hasProgress(currentIndex)) {
        break;
      }
      if (nextResult.ExpressionBlock) {
        items.push(nextResult.ExpressionBlock);
      }
      currentIndex = nextResult.NextIndex;
    }
  }

  const afterClose = getToken(context, currentIndex, nodes, ParseNodeType.CloseBrance, ']');
  if (afterClose === currentIndex) {
    context.ErrorsList.push(new SyntaxErrorData(currentIndex, 0, "']' expected"));
    return ParseResult.noAdvance(index);
  }

  currentIndex = afterClose;
  const list = new ListExpression();
  list.ValueExpressions = items;
  list.Pos = listStart;
  list.Length = currentIndex - listStart;
  const parseNode = new ParseNode(ParseNodeType.List, listStart, currentIndex - listStart, nodes);
  siblings.push(parseNode);
  return new ParseBlockResult(currentIndex, list);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetSpaceSeparatedListExpression.cs :: GetSpaceSeparatedListExpression
function getSpaceSeparatedListExpression(context, siblings, index) {
  if (!context) {
    throw new Error('context is required');
  }

  const items = [];
  const nodes = [];
  let currentIndex = index;

  const firstResult = getExpression(context, nodes, currentIndex);
  if (firstResult.hasProgress(currentIndex)) {
    if (firstResult.ExpressionBlock) {
      items.push(firstResult.ExpressionBlock);
    }
    currentIndex = firstResult.NextIndex;

    while (true) {
      const afterSeparator = getWhitespaceToken(context.Expression, siblings, currentIndex);
      if (afterSeparator === currentIndex) {
        break;
      }
      currentIndex = afterSeparator;

      const nextResult = getExpression(context, nodes, currentIndex);
      if (!nextResult.hasProgress(currentIndex)) {
        break;
      }
      if (nextResult.ExpressionBlock) {
        items.push(nextResult.ExpressionBlock);
      }
      currentIndex = nextResult.NextIndex;
    }
  }

  const list = new ListExpression();
  list.ValueExpressions = items;
  const parseNode = new ParseNode(ParseNodeType.List, index, currentIndex - index, nodes);
  siblings.push(parseNode);
  return new ValueParseResult(currentIndex, list);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetSpaceSeparatedStringListExpression.cs :: GetSpaceSeparatedStringListExpression
function getSpaceSeparatedStringListExpression(context, siblings, index) {
  const listItems = [];
  const nodeItems = [];
  let currentIndex = index;

  const first = getSimpleString(context, nodeItems, currentIndex, context.ErrorsList);
  if (first.NextIndex === currentIndex) {
    return new ValueParseResult(index, null);
  }

  listItems.push(first.Value);
  currentIndex = first.NextIndex;

  while (true) {
    const afterSpace = getWhitespaceToken(context.Expression, siblings, currentIndex);
    if (afterSpace === currentIndex) {
      break;
    }
    currentIndex = afterSpace;

    const next = getSimpleString(context, nodeItems, currentIndex, context.ErrorsList);
    if (next.NextIndex === currentIndex) {
      break;
    }
    listItems.push(next.Value);
    currentIndex = next.NextIndex;
  }

  const parseNode = new ParseNode(ParseNodeType.List, index, currentIndex - index, nodeItems);
  siblings.push(parseNode);
  return new ValueParseResult(currentIndex, listItems);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetExpInParenthesis.cs :: GetExpInParenthesis
function getExpInParenthesis(context, siblings, index) {
  if (!context) {
    throw new Error('context is required');
  }

  const nodes = [];
  const afterOpen = getToken(context, index, nodes, ParseNodeType.OpenBrace, '(');
  if (afterOpen === index) {
    return ParseResult.noAdvance(index);
  }

  let currentIndex = afterOpen;
  const expressionResult = getExpression(context, nodes, currentIndex);
  if (!expressionResult.hasProgress(currentIndex) || !expressionResult.ExpressionBlock) {
    context.ErrorsList.push(new SyntaxErrorData(currentIndex, 0, 'expression expected'));
    return ParseResult.noAdvance(index);
  }

  currentIndex = expressionResult.NextIndex;
  const afterClose = getToken(context, currentIndex, nodes, ParseNodeType.CloseBrance, ')');
  if (afterClose === currentIndex) {
    context.ErrorsList.push(new SyntaxErrorData(currentIndex, 0, "')' expected"));
    return ParseResult.noAdvance(index);
  }

  currentIndex = afterClose;
  const expression = expressionResult.ExpressionBlock;
  expression.Pos = index;
  expression.Length = currentIndex - index;

  const parseNode = new ParseNode(
    ParseNodeType.ExpressionInBrace,
    index,
    currentIndex - index,
    nodes
  );
  siblings.push(parseNode);
  return new ParseBlockResult(currentIndex, expression);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetIfThenElseExpression.cs :: GetIfThenElseExpression
function getIfThenElseExpression(context, siblings, index) {
  if (!context) {
    throw new Error('context is required');
  }

  const childNodes = [];
  const keywordIndex = getKeyWord(context, childNodes, index, 'if');
  if (keywordIndex === index) {
    return ParseResult.noAdvance(index);
  }

  const functionSegment = context.Expression.substring(index, keywordIndex);
  const functionName = functionSegment.trim();
  if (!functionName) {
    return ParseResult.noAdvance(index);
  }

  const functionStart = keywordIndex - functionName.length;
  const functionBlock = new ReferenceBlock(functionName);
  functionBlock.Pos = functionStart;
  functionBlock.Length = functionName.length;

  let currentIndex = keywordIndex;
  const condition = getExpression(context, childNodes, currentIndex);
  if (!condition.hasProgress(currentIndex)) {
    return ParseResult.noAdvance(index);
  }

  currentIndex = condition.NextIndex;
  const afterThen = getKeyWord(context, childNodes, currentIndex, 'then');
  if (afterThen === currentIndex) {
    return ParseResult.noAdvance(index);
  }
  currentIndex = afterThen;

  const trueValue = getExpression(context, childNodes, currentIndex);
  if (!trueValue.hasProgress(currentIndex)) {
    return ParseResult.noAdvance(index);
  }

  currentIndex = trueValue.NextIndex;
  const afterElse = getKeyWord(context, childNodes, currentIndex, 'else');
  if (afterElse === currentIndex) {
    return ParseResult.noAdvance(index);
  }
  currentIndex = afterElse;

  const elseValue = getExpression(context, childNodes, currentIndex);
  if (!elseValue.hasProgress(currentIndex)) {
    return ParseResult.noAdvance(index);
  }
  currentIndex = elseValue.NextIndex;

  const call = new FunctionCallExpression(
    functionBlock,
    [condition.ExpressionBlock, trueValue.ExpressionBlock, elseValue.ExpressionBlock],
    index,
    currentIndex - index
  );

  const parseNode = new ParseNode(ParseNodeType.IfExpression, index, currentIndex - index, childNodes);
  siblings.push(parseNode);

  return new ParseBlockResult(currentIndex, call);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetCaseExpression.cs :: GetCaseExpression
function getCaseExpression(context, siblings, index) {
  if (!context) {
    throw new Error('context is required');
  }

  const childNodes = [];
  const keywordIndex = getKeyWord(context, childNodes, index, 'case');
  if (keywordIndex === index) {
    return ParseResult.noAdvance(index);
  }

  let currentIndex = keywordIndex;
  const parameters = [];

  while (true) {
    if (parameters.length === 0) {
      const condition = getExpression(context, childNodes, currentIndex);
      if (!condition.hasProgress(currentIndex) || !condition.ExpressionBlock) {
        context.ErrorsList.push(new SyntaxErrorData(currentIndex, 1, 'Case condition expected'));
        return ParseResult.noAdvance(index);
      }
      parameters.push(condition.ExpressionBlock);
      currentIndex = condition.NextIndex;
    } else {
      const afterSeparator = getToken(context, currentIndex, childNodes, ParseNodeType.ListSeparator, ',', ';');
      if (afterSeparator === currentIndex) {
        break;
      }
      currentIndex = afterSeparator;

      const nextCondition = getExpression(context, childNodes, currentIndex);
      if (!nextCondition.hasProgress(currentIndex) || !nextCondition.ExpressionBlock) {
        break;
      }
      parameters.push(nextCondition.ExpressionBlock);
      currentIndex = nextCondition.NextIndex;
    }

    const afterColon = getToken(context, currentIndex, childNodes, ParseNodeType.Colon, ':');
    if (afterColon === currentIndex) {
      break;
    }
    currentIndex = afterColon;

    const valueResult = getExpression(context, childNodes, currentIndex);
    if (!valueResult.hasProgress(currentIndex) || !valueResult.ExpressionBlock) {
      context.ErrorsList.push(new SyntaxErrorData(currentIndex, 1, 'Case value expected'));
      return ParseResult.noAdvance(index);
    }
    parameters.push(valueResult.ExpressionBlock);
    currentIndex = valueResult.NextIndex;
  }

  const call = new FunctionCallExpression(
    new LiteralBlock(context.Provider.get('case')),
    parameters,
    index,
    currentIndex - index
  );

  const parseNode = new ParseNode(ParseNodeType.Case, index, currentIndex - index, childNodes);
  siblings.push(parseNode);
  return new ParseBlockResult(currentIndex, call);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetSwitchExpression.cs :: GetSwitchExpression
function getSwitchExpression(context, siblings, index) {
  if (!context) {
    throw new Error('context is required');
  }

  const childNodes = [];
  const keywordIndex = getKeyWord(context, childNodes, index, 'switch');
  if (keywordIndex === index) {
    return ParseResult.noAdvance(index);
  }

  let currentIndex = keywordIndex;
  const parameters = [];

  const selector = getExpression(context, childNodes, currentIndex);
  if (!selector.hasProgress(currentIndex) || !selector.ExpressionBlock) {
    context.ErrorsList.push(new SyntaxErrorData(currentIndex, 1, 'Switch selector expected'));
    return ParseResult.noAdvance(index);
  }
  parameters.push(selector.ExpressionBlock);
  currentIndex = selector.NextIndex;

  while (true) {
    const afterSeparator = getToken(context, currentIndex, childNodes, ParseNodeType.ListSeparator, ',', ';');
    if (afterSeparator === currentIndex) {
      break;
    }
    currentIndex = afterSeparator;

    const branchCondition = getExpression(context, childNodes, currentIndex);
    if (!branchCondition.hasProgress(currentIndex) || !branchCondition.ExpressionBlock) {
      break;
    }
    parameters.push(branchCondition.ExpressionBlock);
    currentIndex = branchCondition.NextIndex;

    const afterColon = getToken(context, currentIndex, childNodes, ParseNodeType.Colon, ':');
    if (afterColon === currentIndex) {
      break;
    }
    currentIndex = afterColon;

    const branchValue = getExpression(context, childNodes, currentIndex);
    if (!branchValue.hasProgress(currentIndex) || !branchValue.ExpressionBlock) {
      context.ErrorsList.push(new SyntaxErrorData(currentIndex, 1, 'Selector result expected'));
      return ParseResult.noAdvance(index);
    }
    parameters.push(branchValue.ExpressionBlock);
    currentIndex = branchValue.NextIndex;
  }

  const call = new FunctionCallExpression(
    new LiteralBlock(context.Provider.get('switch')),
    parameters,
    index,
    currentIndex - index
  );

  const parseNode = new ParseNode(ParseNodeType.Case, index, currentIndex - index, childNodes);
  siblings.push(parseNode);
  return new ParseBlockResult(currentIndex, call);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetLambdaExpression.cs :: GetLambdaExpression
function getLambdaExpression(context, siblings, index) {
  if (!context) {
    throw new Error('context is required');
  }

  const parameterNodes = [];
  let parametersNode = null;
  const identifierList = [];
  const afterParameters = getIdentifierList(context, index, parameterNodes, identifierList, (node) => {
    parametersNode = node;
  });

  if (afterParameters === index) {
    return new ValueParseResult(index, null);
  }

  let currentIndex = afterParameters;
  const childNodes = [];
  if (parametersNode) {
    childNodes.push(parametersNode);
  }

  const arrowNodes = [];
  const afterArrow = getToken(context, currentIndex, arrowNodes, ParseNodeType.LambdaArrow, '=>');
  if (afterArrow === currentIndex) {
    context.ErrorsList.push(new SyntaxErrorData(currentIndex, 0, "'=>' expected"));
    return new ValueParseResult(index, null);
  }
  currentIndex = afterArrow;
  childNodes.push(...arrowNodes);

  const bodyResult = getExpression(context, childNodes, currentIndex);
  if (!bodyResult.hasProgress(currentIndex) || !bodyResult.ExpressionBlock) {
    context.ErrorsList.push(new SyntaxErrorData(currentIndex, 0, 'defination of lambda expression expected'));
    return new ValueParseResult(index, null);
  }
  currentIndex = bodyResult.NextIndex;

  const functionValue = new ExpressionFunction(identifierList, bodyResult.ExpressionBlock);
  const parseNode = new ParseNode(ParseNodeType.LambdaExpression, index, currentIndex - index, childNodes);
  siblings.push(parseNode);
  return new ValueParseResult(currentIndex, functionValue);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetIdentifierList.cs :: GetIdentifierList
function getIdentifierList(context, index, siblings, listCollector, setNode) {
  const buffer = createNodeBuffer(siblings);
  const afterOpen = getToken(context, index, buffer, ParseNodeType.OpenBrace, '(');
  if (afterOpen === index) {
    return index;
  }

  let currentIndex = afterOpen;
  const identifiers = [];

  const firstIden = getIdentifier(context, buffer, currentIndex, KEYWORDS);
  let nextIndex = firstIden.NextIndex;
  if (nextIndex > currentIndex) {
    identifiers.push(firstIden.Iden);
    currentIndex = nextIndex;

    while (currentIndex < context.Expression.length) {
      const afterComma = getToken(context, currentIndex, buffer, ParseNodeType.ListSeparator, ',');
      if (afterComma === currentIndex) {
        break;
      }
      currentIndex = afterComma;
      const iden = getIdentifier(context, buffer, currentIndex, KEYWORDS);
      nextIndex = iden.NextIndex;
      if (nextIndex === currentIndex) {
        return index;
      }
      identifiers.push(iden.Iden);
      currentIndex = nextIndex;
    }
  }

  const afterClose = getToken(context, currentIndex, buffer, ParseNodeType.CloseBrance, ')');
  if (afterClose === currentIndex) {
    return index;
  }

  const parseChildren = buffer.slice().sort((a, b) => {
    if (a.Pos !== b.Pos) {
      return a.Pos - b.Pos;
    }
    return a.Length - b.Length;
  });

  const openNode = parseChildren.find((n) => n.NodeType === ParseNodeType.OpenBrace);
  const parseStart = openNode ? openNode.Pos : (parseChildren.length > 0 ? parseChildren[0].Pos : index);
  const parseLength = afterClose - parseStart;

  const parseNode = new ParseNode(
    ParseNodeType.IdentiferList,
    parseStart,
    parseLength,
    parseChildren
  );
  siblings.push(parseNode);
  if (Array.isArray(listCollector)) {
    listCollector.push(...identifiers);
  }
  if (typeof setNode === 'function') {
    setNode(parseNode);
  }

  return afterClose;
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetPrefixOperator.cs :: GetPrefixOperator
function getPrefixOperator(context, siblings, index) {
  if (!context) {
    throw new Error('context is required');
  }

  let matchedSymbol = null;
  let functionName = null;
  let currentIndex = index;
  const buffer = createNodeBuffer(siblings);
  for (const op of PREFIX_OPERATORS) {
    const nextIndex = getToken(context, index, buffer, ParseNodeType.Operator, op[0]);
    if (nextIndex > index) {
      matchedSymbol = op[0];
      functionName = op[1];
      currentIndex = nextIndex;
      break;
    }
  }

  if (!matchedSymbol) {
    return ParseResult.noAdvance(index);
  }

  const functionValue = context.Provider.get(functionName);
  if (!functionValue) {
    context.ErrorsList.push(
      new SyntaxErrorData(index, currentIndex - index, `Prefix operator ${functionName} not defined`)
    );
    return ParseResult.noAdvance(index);
  }

  const childNodes = [];
  const operandResult = getCallAndMemberAccess(context, childNodes, currentIndex);
  if (!operandResult.hasProgress(currentIndex) || !operandResult.ExpressionBlock) {
    context.ErrorsList.push(
      new SyntaxErrorData(currentIndex, 0, `Operant for ${functionName} expected`)
    );
    return ParseResult.noAdvance(index);
  }

  currentIndex = operandResult.NextIndex;
  const call = new FunctionCallExpression(
    new LiteralBlock(functionValue),
    [operandResult.ExpressionBlock],
    index,
    currentIndex - index
  );

  const parseNode = new ParseNode(ParseNodeType.PrefixOperatorExpression, index, currentIndex - index, childNodes);
  buffer.push(...childNodes);
  buffer.push(parseNode);
  commitNodeBuffer(siblings, buffer);
  return new ParseBlockResult(currentIndex, call);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetStringTemplate.cs :: GetStringTemplate (entry)
function getStringTemplate(context, siblings, index) {
  const tripleBuffer = createNodeBuffer(siblings);
  const tripleResult = getStringTemplateWithDelimiter(context, tripleBuffer, '"""', index);
  if (tripleResult.hasProgress(index)) {
    commitNodeBuffer(siblings, tripleBuffer);
    return tripleResult;
  }

  const doubleBuffer = createNodeBuffer(siblings);
  const doubleResult = getStringTemplateWithDelimiter(context, doubleBuffer, '"', index);
  if (doubleResult.hasProgress(index)) {
    commitNodeBuffer(siblings, doubleBuffer);
    return doubleResult;
  }

  const singleBuffer = createNodeBuffer(siblings);
  const singleResult = getStringTemplateWithDelimiter(context, singleBuffer, '\'', index);
  if (singleResult.hasProgress(index)) {
    commitNodeBuffer(siblings, singleBuffer);
    return singleResult;
  }

  return ParseResult.noAdvance(index);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetStringTemplate.cs :: GetStringTemplate (implementation)
function getStringTemplateWithDelimiter(context, siblings, delimiter, index) {
  if (!context) {
    throw new Error('context is required');
  }
  if (!delimiter) {
    throw new Error('delimiter is required');
  }

  const nodeParts = [];
  const templateStart = skipSpace(context, nodeParts, index);
  if (templateStart >= context.Expression.length) {
    return ParseResult.noAdvance(index);
  }

  let currentIndex = getLiteralMatch(context.Expression, templateStart, `f${delimiter}`);
  if (currentIndex === templateStart) {
    return ParseResult.noAdvance(index);
  }

  const parts = [];
  let literalStart = currentIndex;
  let buffer = '';

  while (true) {
    let afterEscape = getLiteralMatch(context.Expression, currentIndex, '\\{');
    if (afterEscape > currentIndex) {
      currentIndex = afterEscape;
      buffer += '{';
      continue;
    }

    afterEscape = getLiteralMatch(context.Expression, currentIndex, '\\}');
    if (afterEscape > currentIndex) {
      currentIndex = afterEscape;
      buffer += '}';
      continue;
    }

    afterEscape = getLiteralMatch(context.Expression, currentIndex, '\\n');
    if (afterEscape > currentIndex) {
      currentIndex = afterEscape;
      buffer += '\n';
      continue;
    }

    afterEscape = getLiteralMatch(context.Expression, currentIndex, '\\t');
    if (afterEscape > currentIndex) {
      currentIndex = afterEscape;
      buffer += '\t';
      continue;
    }

    afterEscape = getLiteralMatch(context.Expression, currentIndex, '\\\\');
    if (afterEscape > currentIndex) {
      currentIndex = afterEscape;
      buffer += '\\';
      continue;
    }

    afterEscape = getLiteralMatch(context.Expression, currentIndex, '\\u');
    if (afterEscape > currentIndex) {
      const unicodeStart = currentIndex + 2;
      const unicodeEnd = unicodeStart + 4;
      if (unicodeEnd <= context.Expression.length) {
        const unicodeStr = context.Expression.substring(unicodeStart, unicodeEnd);
        const code = parseInt(unicodeStr, 16);
        if (!Number.isNaN(code)) {
          buffer += String.fromCharCode(code);
          currentIndex = unicodeEnd;
          continue;
        }
      }
    }

    afterEscape = getLiteralMatch(context.Expression, currentIndex, `\\${delimiter}`);
    if (afterEscape > currentIndex) {
      currentIndex = afterEscape;
      buffer += delimiter;
      continue;
    }

    afterEscape = getLiteralMatch(context.Expression, currentIndex, '\\');
    if (afterEscape > currentIndex) {
      currentIndex = afterEscape;
      buffer += '\\';
      continue;
    }

    const afterExpressionStart = getLiteralMatch(context.Expression, currentIndex, '{');
    if (afterExpressionStart > currentIndex) {
      if (buffer.length > 0) {
        const literal = new LiteralBlock(buffer);
        parts.push(literal);
        nodeParts.push(new ParseNode(ParseNodeType.LiteralString, literalStart, currentIndex - literalStart));
        buffer = '';
      }

      nodeParts.push(new ParseNode(ParseNodeType.OpenBrace, currentIndex, afterExpressionStart - currentIndex));

      const expressionIndex = afterExpressionStart;
      const expressionResult = getExpression(context, nodeParts, expressionIndex);
      if (!expressionResult.hasProgress(expressionIndex) || !expressionResult.ExpressionBlock) {
        context.ErrorsList.push(new SyntaxErrorData(expressionIndex, 0, 'expression expected'));
        return ParseResult.noAdvance(index);
      }

      currentIndex = expressionResult.NextIndex;
      parts.push(expressionResult.ExpressionBlock);

      const afterExpressionEnd = getToken(context, currentIndex, nodeParts, ParseNodeType.CloseBrance, '}');
      if (afterExpressionEnd === currentIndex) {
        context.ErrorsList.push(new SyntaxErrorData(currentIndex, 0, "'}' expected"));
        return ParseResult.noAdvance(index);
      }

      currentIndex = afterExpressionEnd;
      literalStart = currentIndex;
      continue;
    }

    if (currentIndex >= context.Expression.length || getLiteralMatch(context.Expression, currentIndex, delimiter) > currentIndex) {
      break;
    }

    buffer += context.Expression[currentIndex];
    currentIndex += 1;
  }

  if (currentIndex > literalStart) {
    if (buffer.length > 0) {
      const literal = new LiteralBlock(buffer);
      parts.push(literal);
      nodeParts.push(new ParseNode(ParseNodeType.LiteralString, literalStart, currentIndex - literalStart));
      buffer = '';
    }
  }

  const afterClose = getLiteralMatch(context.Expression, currentIndex, delimiter);
  if (afterClose === currentIndex) {
    context.ErrorsList.push(new SyntaxErrorData(currentIndex, 0, `'${delimiter}' expected`));
    return ParseResult.noAdvance(index);
  }

  currentIndex = afterClose;

  let expression;
  let parseNode;
  if (parts.length === 0) {
    expression = new LiteralBlock('');
    parseNode = new ParseNode(ParseNodeType.LiteralString, templateStart, currentIndex - templateStart);
  } else if (parts.length === 1) {
    expression = parts[0];
    parseNode = nodeParts.length > 0 ? nodeParts[0] : null;
  } else {
    expression = new FunctionCallExpression(
      new LiteralBlock(context.Provider.get('+')),
      parts,
      templateStart,
      currentIndex - templateStart
    );
    parseNode = new ParseNode(
      ParseNodeType.StringTemplate,
      templateStart,
      currentIndex - templateStart,
      nodeParts
    );
  }

  if (parseNode) {
    siblings.push(parseNode);
  }

  return new ParseBlockResult(currentIndex, expression);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetFSTemplate.cs :: GetFSTemplate
function getFSTemplate(context, siblings, index) {
  if (!context) {
    throw new Error('context is required');
  }

  const parts = [];
  const nodeParts = [];
  let currentIndex = index;
  let buffer = '';
  let literalStart = currentIndex;

  while (currentIndex < context.Expression.length) {
    const escapedInterpolation = getLiteralMatch(context.Expression, currentIndex, '$${');
    if (escapedInterpolation > currentIndex) {
      buffer += '${';
      currentIndex = escapedInterpolation;
      continue;
    }

    const interpolationStart = getLiteralMatch(context.Expression, currentIndex, '${');
    if (interpolationStart > currentIndex) {
      if (buffer.length > 0) {
        const literal = new LiteralBlock(buffer);
        parts.push(literal);
        nodeParts.push(new ParseNode(ParseNodeType.LiteralString, literalStart, currentIndex - literalStart));
        buffer = '';
      }

      const expressionIndex = interpolationStart;
      const expressionResult = getExpression(context, nodeParts, expressionIndex);
      if (!expressionResult.hasProgress(expressionIndex) || !expressionResult.ExpressionBlock) {
        context.ErrorsList.push(new SyntaxErrorData(expressionIndex, 0, 'expression expected'));
        return ParseResult.noAdvance(index);
      }

      currentIndex = expressionResult.NextIndex;
      parts.push(expressionResult.ExpressionBlock);

      const interpolationEnd = getToken(context, currentIndex, nodeParts, ParseNodeType.CloseBrance, '}');
      if (interpolationEnd === currentIndex) {
        context.ErrorsList.push(new SyntaxErrorData(currentIndex, 0, "'}' expected"));
        return ParseResult.noAdvance(index);
      }

      currentIndex = interpolationEnd;
      literalStart = currentIndex;
      continue;
    }

    buffer += context.Expression[currentIndex];
    currentIndex += 1;
  }

  if (buffer.length > 0) {
    const literal = new LiteralBlock(buffer);
    parts.push(literal);
    nodeParts.push(new ParseNode(ParseNodeType.LiteralString, literalStart, currentIndex - literalStart));
  }

  let expression;
  let parseNode;
  if (parts.length === 0) {
    expression = new LiteralBlock('');
    parseNode = new ParseNode(ParseNodeType.LiteralString, index, currentIndex - index);
  } else if (parts.length === 1) {
    expression = parts[0];
    parseNode = nodeParts.length > 0 ? nodeParts[0] : null;
  } else {
    expression = new FunctionCallExpression(
      new LiteralBlock(context.Provider.get('_templatemerge')),
      parts,
      index,
      currentIndex - index
    );
    parseNode = new ParseNode(ParseNodeType.StringTemplate, index, currentIndex - index, nodeParts);
  }

  if (parseNode) {
    siblings.push(parseNode);
  }

  return new ParseBlockResult(currentIndex, expression);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetUnit.cs :: GetUnit
function getUnit(context, siblings, index) {
  if (!context) {
    throw new Error('context is required');
  }

  const errors = context.ErrorsList;
  const tryParse = (fn) => {
    const errorCount = errors.length;
    const siblingCount = siblings.length;
    const result = fn();
    if (result && result.hasProgress && result.hasProgress(index) && result.ExpressionBlock) {
      return result;
    }
    errors.length = errorCount;
    siblings.length = siblingCount;
    return null;
  };

  let attempt;

  attempt = tryParse(() => getStringTemplate(context, siblings, index));
  if (attempt) {
    return attempt;
  }

  const stringResult = getSimpleString(context, siblings, index, errors);
  if (stringResult.NextIndex > index) {
    const block = new LiteralBlock(stringResult.Value, stringResult.StartIndex, stringResult.Length);
    return new ParseBlockResult(stringResult.NextIndex, block);
  }

  const numberResult = getNumber(context, siblings, index, errors);
  if (numberResult.NextIndex > index) {
    const block = new LiteralBlock(numberResult.Value, numberResult.StartIndex, numberResult.Length);
    return new ParseBlockResult(numberResult.NextIndex, block);
  }

  const listResult = getListExpression(context, siblings, index);
  if (listResult.hasProgress(index) && listResult.ExpressionBlock) {
    return listResult;
  }

  const kvcResult = getKvcExpression(context, siblings, false, index);
  if (kvcResult.hasProgress(index) && kvcResult.ExpressionBlock) {
    return kvcResult;
  }

  attempt = tryParse(() => getIfThenElseExpression(context, siblings, index));
  if (attempt) {
    return attempt;
  }

  attempt = tryParse(() => getCaseExpression(context, siblings, index));
  if (attempt) {
    return attempt;
  }

  attempt = tryParse(() => getSwitchExpression(context, siblings, index));
  if (attempt) {
    return attempt;
  }

  const lambdaResult = getLambdaExpression(context, siblings, index);
  if (lambdaResult.hasProgress && lambdaResult.hasProgress(index) && lambdaResult.Value) {
    const block = new LiteralBlock(lambdaResult.Value, index, lambdaResult.NextIndex - index);
    return new ParseBlockResult(lambdaResult.NextIndex, block);
  }

  const keywordLiteral = getKeyWordLiteral(context, siblings, index);
  if (keywordLiteral.nextIndex > index) {
    const literalPos = keywordLiteral.parseNode ? keywordLiteral.parseNode.Pos : index;
    const literalLength = keywordLiteral.parseNode ? keywordLiteral.parseNode.Length : keywordLiteral.nextIndex - literalPos;
    const block = new LiteralBlock(keywordLiteral.literal, literalPos, literalLength);
    return new ParseBlockResult(keywordLiteral.nextIndex, block);
  }

  const iden = getIdentifier(context, siblings, index, KEYWORDS);
  if (iden.NextIndex > index) {
    const reference = new ReferenceBlock(iden.Iden, iden.StartIndex, iden.Length);
    return new ParseBlockResult(iden.NextIndex, reference);
  }

  attempt = tryParse(() => getExpInParenthesis(context, siblings, index));
  if (attempt) {
    return attempt;
  }

  attempt = tryParse(() => getPrefixOperator(context, siblings, index));
  if (attempt) {
    return attempt;
  }

  return ParseResult.noAdvance(index);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetRootExpression.cs :: GetRootExpression
function getRootExpression(context, index) {
  const nodes = [];
  const kvcErrors = [];
  const kvcContext = context.createChild(context.Expression, kvcErrors);
  const kvcResult = getKvcExpression(kvcContext, nodes, true, index);
  if (kvcResult.hasProgress(index) && kvcResult.ExpressionBlock) {
    context.ErrorsList.push(...kvcErrors);
    const kvcExpression = kvcResult.ExpressionBlock;
    if (!kvcExpression.Length) {
      kvcExpression.Pos = index;
      kvcExpression.Length = kvcResult.NextIndex - index;
    }
    const last = skipSpace(context, nodes, kvcResult.NextIndex);
    const rootNode = new ParseNode(
      ParseNodeType.RootExpression,
      index,
      last - index,
      nodes
    );
    return new ParseBlockResultWithNode(last, kvcExpression, rootNode);
  }

  const expressionResult = getExpression(context, nodes, index);
  if (expressionResult.hasProgress(index) && expressionResult.ExpressionBlock) {
    const expression = expressionResult.ExpressionBlock;
    if (!expression.Length) {
      expression.Pos = index;
      expression.Length = expressionResult.NextIndex - index;
    }
    const last = skipSpace(context, nodes, expressionResult.NextIndex);
    const rootNode = new ParseNode(
      ParseNodeType.RootExpression,
      index,
      last - index,
      nodes
    );
    return new ParseBlockResultWithNode(last, expressionResult.ExpressionBlock, rootNode);
  }

  return new ParseBlockResultWithNode(index, null, null);
}

class FuncScriptParser {
  // Mirrors FuncScript/Parser/Syntax/FuncScriptParser.Parse.cs :: FuncScriptParser.Parse(ParseContext)
  static parseContext(context) {
    if (!(context instanceof ParseContext)) {
      throw new Error('parseContext expects a ParseContext instance');
    }
    const result = getRootExpression(context, 0);
    const parseNode = unwrapRootNode(result.ParseNode);
    return {
      block: result.ExpressionBlock,
      parseNode,
      errors: context.ErrorsList,
      nextIndex: result.NextIndex
    };
  }

  // Mirrors FuncScript/Parser/Syntax/FuncScriptParser.Parse.cs :: FuncScriptParser.Parse
  static parse(provider, expression, errorsList) {
    if (expression === null || expression === undefined) {
      throw new Error('expression is required');
    }
    const exprText = String(expression);
    const errors = Array.isArray(errorsList) ? errorsList : [];
    const context = new ParseContext(provider, exprText, errors);
    return FuncScriptParser.parseContext(context);
  }

  // Mirrors FuncScript/Parser/Syntax/FuncScriptParser.ParseFsTemplate.cs :: ParseFsTemplate
  static parseFsTemplate(provider, expression, errorsList) {
    if (!provider) {
      throw new Error('provider is required');
    }
    if (expression === null || expression === undefined) {
      throw new Error('expression is required');
    }
    const errors = Array.isArray(errorsList) ? errorsList : [];
    const context = new ParseContext(provider, String(expression), errors);
    const result = getFSTemplate(context, [], 0);
    return result.ExpressionBlock;
  }

  // Mirrors FuncScript/Parser/Syntax/FuncScriptParser.ParseSpaceSeparatedList.cs :: ParseSpaceSeparatedList
  static parseSpaceSeparatedList(provider, expression, errorsList) {
    if (!provider) {
      throw new Error('provider is required');
    }
    if (expression === null || expression === undefined) {
      throw new Error('expression is required');
    }
    const errors = Array.isArray(errorsList) ? errorsList : [];
    const context = new ParseContext(provider, String(expression), errors);
    const result = getSpaceSeparatedStringListExpression(context, [], 0);
    return result.Value;
  }
}

module.exports = {
  FuncScriptParser,
  ParseNodeType,
  SyntaxErrorData,
  ParseNode,
  ParseContext,
  ParseResult,
  ParseBlockResult,
  ParseBlockResultWithNode,
  ValueParseResult,
  IdenResult,
  getExpression,
  getInfixExpression,
  getInfixExpressionSingleLevel,
  getInfixExpressionSingleOp,
  getInfixFunctionCall,
  getOperator,
  getCallAndMemberAccess,
  getFunctionCallParametersList,
  getKvcExpression,
  getKvcItem,
  getKeyValuePair,
  getReturnDefinition,
  getListExpression,
  getSpaceSeparatedListExpression,
  getSpaceSeparatedStringListExpression,
  getFSTemplate,
  getStringTemplate,
  getUnit,
  getIfThenElseExpression,
  getCaseExpression,
  getSwitchExpression,
  getLambdaExpression,
  getIdentifierList,
  getPrefixOperator,
  getRootExpression,
  createNodeBuffer,
  commitNodeBuffer,
  getLiteralMatch,
  getToken,
  getWhitespaceToken,
  skipSpace,
  getSimpleString,
  getSpaceLessString,
  getIdentifier,
  getKeyWord,
  getKeyWordLiteral,
  getNumber,
  getInt,
  identifierMetrics,
  literalMatchMetrics,
  resetIdentifierMetrics,
  resetLiteralMatchMetrics
};

module.exports.__esModule = true;
module.exports.default = module.exports;
