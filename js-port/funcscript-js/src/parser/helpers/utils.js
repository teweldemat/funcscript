'use strict';

const { ParseNodeType, ParseNode, SyntaxErrorData } = require('../parse-node');
const { IdenResult } = require('../context');
const { makeValue } = require('../../core/value');
const { FSDataType } = require('../../core/fstypes');

const identifierMetrics = {
  calls: 0,
  totalTimeNs: 0n,
  maxTimeNs: 0n
};

const literalMatchMetrics = {
  calls: 0,
  attemptsByKey: new Map()
};

function resetIdentifierMetrics() {
  identifierMetrics.calls = 0;
  identifierMetrics.totalTimeNs = 0n;
  identifierMetrics.maxTimeNs = 0n;
}

function resetLiteralMatchMetrics() {
  literalMatchMetrics.calls = 0;
  literalMatchMetrics.attemptsByKey.clear();
}

function nowNs() {
  if (typeof process !== 'undefined' && process.hrtime && typeof process.hrtime.bigint === 'function') {
    return process.hrtime.bigint();
  }
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return BigInt(Math.floor(performance.now() * 1e6));
  }
  return BigInt(Date.now()) * 1000000n;
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.NodeBuffer.cs :: CreateNodeBuffer
function createNodeBuffer(siblings) {
  if (!Array.isArray(siblings)) {
    throw new Error('siblings must be an array');
  }
  return [];
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.NodeBuffer.cs :: CommitNodeBuffer
function commitNodeBuffer(siblings, buffer) {
  if (!Array.isArray(siblings)) {
    throw new Error('siblings must be an array');
  }
  if (!buffer || buffer.length === 0) {
    return;
  }
  for (const node of buffer) {
    siblings.push(node);
  }
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.isCharWhiteSpace.cs :: isCharWhiteSpace
function isCharWhiteSpace(ch) {
  if (ch == null) {
    return false;
  }
  return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n' || ch === '\f';
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetLiteralMatch.cs :: GetLiteralMatch
function getLiteralMatch(expression, index, ...keywords) {
  if (typeof expression !== 'string') {
    throw new Error('expression must be a string');
  }
  literalMatchMetrics.calls += 1;
  if (keywords && keywords.length > 0) {
    const key = `${index}|${keywords.join('|')}`;
    const count = literalMatchMetrics.attemptsByKey.get(key) || 0;
    literalMatchMetrics.attemptsByKey.set(key, count + 1);
  }
  for (const keyword of keywords) {
    if (keyword == null) {
      continue;
    }
    const candidate = String(keyword);
    const length = candidate.length;
    if (index + length > expression.length) {
      continue;
    }
    let match = true;
    for (let i = 0; i < length; i += 1) {
      if (expression[index + i].toLowerCase() !== candidate[i].toLowerCase()) {
        match = false;
        break;
      }
    }
    if (match) {
      return index + length;
    }
  }
  return index;
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetCommentBlock.cs :: GetCommentBlock
function getCommentBlock(context, siblings, index) {
  const expression = context.Expression;
  const afterLineMarker = getLiteralMatch(expression, index, '//');
  if (afterLineMarker > index) {
    let lineEnd = expression.indexOf('\n', afterLineMarker);
    if (lineEnd === -1) {
      lineEnd = expression.length;
    } else {
      lineEnd += 1;
    }
    siblings.push(new ParseNode(ParseNodeType.Comment, index, lineEnd - index));
    return lineEnd;
  }

  const afterBlockMarker = getLiteralMatch(expression, index, '/*');
  if (afterBlockMarker > index) {
    let blockEnd = expression.indexOf('*/', afterBlockMarker);
    if (blockEnd === -1) {
      blockEnd = expression.length;
    } else {
      blockEnd += 2;
    }
    siblings.push(new ParseNode(ParseNodeType.Comment, index, blockEnd - index));
    return blockEnd;
  }

  return index;
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.SkipSpace.cs :: SkipSpace
function skipSpace(context, siblings, index) {
  const expression = context.Expression;
  let i = index;
  while (true) {
    const whitespaceStart = i;
    while (i < expression.length && isCharWhiteSpace(expression[i])) {
      i += 1;
    }

    if (i > whitespaceStart) {
      const length = i - whitespaceStart;
      let addWhitespace = true;
      for (let s = siblings.length - 1; s >= 0; s -= 1) {
        const existing = siblings[s];
        if (!existing || existing.NodeType !== ParseNodeType.WhiteSpace) {
          continue;
        }
        if (existing.Pos === whitespaceStart && existing.Length === length) {
          addWhitespace = false;
        }
        if (existing.Pos <= whitespaceStart) {
          break;
        }
      }
      if (addWhitespace) {
        siblings.push(new ParseNode(ParseNodeType.WhiteSpace, whitespaceStart, length));
      }
    }

    const afterComment = getCommentBlock(context, siblings, i);
    if (afterComment > i) {
      i = afterComment;
      continue;
    }

    break;
  }
  return i;
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetLiteralMatch.cs :: GetToken
function getToken(context, index, siblings, nodeType, ...tokens) {
  const node = new ParseNode(nodeType);
  if (!tokens || tokens.length === 0) {
    throw new Error('tokens are required');
  }
  const searchIndex = skipSpace(context, siblings, index);
  const nextIndex = getLiteralMatch(context.Expression, searchIndex, ...tokens);
  if (nextIndex === searchIndex) {
    return index;
  }
  node.Pos = searchIndex;
  node.Length = nextIndex - searchIndex;
  siblings.push(node);
  return nextIndex;
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetLiteralMatch.cs :: GetWhitespaceToken
function getWhitespaceToken(expression, siblings, index) {
  let nextIndex = index;
  while (nextIndex < expression.length && isCharWhiteSpace(expression[nextIndex])) {
    nextIndex += 1;
  }
  if (nextIndex > index) {
    siblings.push(new ParseNode(ParseNodeType.WhiteSpace, index, nextIndex - index));
  }
  return nextIndex;
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetSimpleString.cs :: GetSimpleString (internal)
function getSimpleStringWithDelimiter(context, siblings, delimiter, index, errors) {
  const expression = context.Expression;
  let i = getLiteralMatch(expression, index, delimiter);
  if (i === index) {
    return { NextIndex: index, Value: null, StartIndex: index, Length: 0, ParseNode: null };
  }

  if (delimiter === '"""' && i < expression.length) {
    if (expression[i] === '\r') {
      if (i + 1 < expression.length && expression[i + 1] === '\n') {
        i += 2;
      } else {
        i += 1;
      }
    } else if (expression[i] === '\n') {
      i += 1;
    }
  }

  let text = '';
  const getCloseIndex = (startIndex) => {
    if (delimiter !== '"""') {
      return getLiteralMatch(expression, startIndex, delimiter);
    }
    let newlineIndex = getLiteralMatch(expression, startIndex, '\r');
    newlineIndex = getLiteralMatch(expression, newlineIndex, '\n');
    const afterDelimiter = getLiteralMatch(expression, newlineIndex, delimiter);
    if (afterDelimiter > newlineIndex) {
      return afterDelimiter;
    }
    return getLiteralMatch(expression, startIndex, delimiter);
  };

  let closeIndex = -1;
  while (true) {
    if (i >= expression.length) {
      closeIndex = i;
      break;
    }

    let next = getLiteralMatch(expression, i, '\\n');
    if (next > i) {
      text += '\n';
      i = next;
      continue;
    }

    next = getLiteralMatch(expression, i, '\\t');
    if (next > i) {
      text += '\t';
      i = next;
      continue;
    }

    next = getLiteralMatch(expression, i, '\\\\');
    if (next > i) {
      text += '\\';
      i = next;
      continue;
    }

    next = getLiteralMatch(expression, i, '\\u');
    if (next > i) {
      const unicodeStart = i + 2;
      const unicodeEnd = unicodeStart + 4;
      if (unicodeEnd <= expression.length) {
        const unicodeStr = expression.substring(unicodeStart, unicodeEnd);
        const code = parseInt(unicodeStr, 16);
        if (!Number.isNaN(code)) {
          text += String.fromCharCode(code);
          i = unicodeEnd;
          continue;
        }
      }
    }

    next = getLiteralMatch(expression, i, `\\${delimiter}`);
    if (next > i) {
      text += delimiter;
      i = next;
      continue;
    }

    const maybeClose = getCloseIndex(i);
    if (maybeClose > i) {
      closeIndex = maybeClose;
      break;
    }

    text += expression[i];
    i += 1;
  }

  if (closeIndex <= i) {
    errors.push(new SyntaxErrorData(i, 0, `'${delimiter}' expected`));
    return { NextIndex: index, Value: null, StartIndex: index, Length: 0, ParseNode: null };
  }

  i = closeIndex;
  const parseNode = new ParseNode(ParseNodeType.LiteralString, index, i - index);
  siblings.push(parseNode);
  return {
    NextIndex: i,
    Value: text,
    StartIndex: parseNode.Pos,
    Length: parseNode.Length,
    ParseNode: parseNode
  };
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetSimpleString.cs :: GetSimpleString
function getSimpleString(context, siblings, index, errors) {
  if (index >= context.Expression.length) {
    return { NextIndex: index, Value: null, StartIndex: index, Length: 0, ParseNode: null };
  }

  const buffer = createNodeBuffer(siblings);
  const currentIndex = skipSpace(context, buffer, index);
  if (currentIndex >= context.Expression.length) {
    return { NextIndex: index, Value: null, StartIndex: index, Length: 0, ParseNode: null };
  }

  let result = getSimpleStringWithDelimiter(context, buffer, '"""', currentIndex, errors);
  if (result.NextIndex === currentIndex) {
    result = getSimpleStringWithDelimiter(context, buffer, '"', currentIndex, errors);
  }
  if (result.NextIndex === currentIndex) {
    result = getSimpleStringWithDelimiter(context, buffer, '\'', currentIndex, errors);
  }

  if (result.NextIndex === currentIndex) {
    return { NextIndex: index, Value: null, StartIndex: index, Length: 0, ParseNode: null };
  }

  commitNodeBuffer(siblings, buffer);
  return result;
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetSpaceLessString.cs :: GetSpaceLessString
function getSpaceLessString(context, siblings, index) {
  const expression = context.Expression;
  if (index >= expression.length) {
    return { nextIndex: index, text: null };
  }
  let i = index;
  if (isCharWhiteSpace(expression[i])) {
    return { nextIndex: index, text: null };
  }
  i += 1;
  while (i < expression.length && !isCharWhiteSpace(expression[i])) {
    i += 1;
  }

  const text = expression.substring(index, i);
  siblings.push(new ParseNode(ParseNodeType.Identifier, index, i - index));
  return { nextIndex: i, text };
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.IsIdentfierFirstChar.cs :: IsIdentfierFirstChar
function isIdentifierFirstChar(ch) {
  if (ch == null) {
    return false;
  }
  return /[A-Za-z_]/.test(ch);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.IsIdentfierOtherChar.cs :: IsIdentfierOtherChar
function isIdentifierOtherChar(ch) {
  if (ch == null) {
    return false;
  }
  return /[A-Za-z0-9_]/.test(ch);
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetIdentifier.cs :: GetIdentifier
function getIdentifier(context, siblings, index, keywords) {
  const start = nowNs();
  const finish = (result) => {
    const duration = nowNs() - start;
    identifierMetrics.calls += 1;
    identifierMetrics.totalTimeNs += duration;
    if (duration > identifierMetrics.maxTimeNs) {
      identifierMetrics.maxTimeNs = duration;
    }
    return result;
  };

  if (index >= context.Expression.length) {
    return finish(new IdenResult(index, null, null, index, 0));
  }

  const buffer = createNodeBuffer(siblings);
  const currentIndex = skipSpace(context, buffer, index);
  if (currentIndex >= context.Expression.length) {
    return finish(new IdenResult(index, null, null, index, 0));
  }

  if (!isIdentifierFirstChar(context.Expression[currentIndex])) {
    return finish(new IdenResult(index, null, null, index, 0));
  }

  let i = currentIndex + 1;
  while (i < context.Expression.length && isIdentifierOtherChar(context.Expression[i])) {
    i += 1;
  }

  const iden = context.Expression.substring(currentIndex, i);
  const idenLower = iden.toLowerCase();
  if (keywords && keywords.has(idenLower)) {
    return finish(new IdenResult(index, null, null, index, 0));
  }

  buffer.push(new ParseNode(ParseNodeType.Identifier, currentIndex, i - currentIndex));
  commitNodeBuffer(siblings, buffer);
  return finish(new IdenResult(i, iden, idenLower, currentIndex, i - currentIndex));
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetKeyWord.cs :: GetKeyWord
function getKeyWord(context, siblings, index, keyword) {
  if (!keyword) {
    throw new Error('keyword is required');
  }
  const buffer = createNodeBuffer(siblings);
  const nextIndex = getToken(context, index, buffer, ParseNodeType.KeyWord, keyword);
  if (nextIndex === index) {
    return index;
  }
  if (nextIndex < context.Expression.length && isIdentifierOtherChar(context.Expression[nextIndex])) {
    return index;
  }
  commitNodeBuffer(siblings, buffer);
  return nextIndex;
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetKeyWordLiteral.cs :: GetKeyWordLiteral
function getKeyWordLiteral(context, siblings, index) {
  if (index >= context.Expression.length) {
    return { nextIndex: index, literal: null, parseNode: null };
  }
  const buffer = createNodeBuffer(siblings);
  const currentIndex = skipSpace(context, buffer, index);
  if (currentIndex >= context.Expression.length) {
    return { nextIndex: index, literal: null, parseNode: null };
  }

  const expression = context.Expression;
  let literal = null;
  let i = getLiteralMatch(expression, currentIndex, 'null');
  if (i > currentIndex) {
    if (i < expression.length && isIdentifierOtherChar(expression[i])) {
      return { nextIndex: index, literal: null, parseNode: null };
    }
    literal = null;
  } else {
    i = getLiteralMatch(expression, currentIndex, 'true');
    if (i > currentIndex) {
      if (i < expression.length && isIdentifierOtherChar(expression[i])) {
        return { nextIndex: index, literal: null, parseNode: null };
      }
      literal = true;
    } else {
      i = getLiteralMatch(expression, currentIndex, 'false');
      if (i > currentIndex) {
        if (i < expression.length && isIdentifierOtherChar(expression[i])) {
          return { nextIndex: index, literal: null, parseNode: null };
        }
        literal = false;
      } else {
        return { nextIndex: index, literal: null, parseNode: null };
      }
    }
  }

  const parseNode = new ParseNode(ParseNodeType.KeyWord, currentIndex, i - currentIndex);
  buffer.push(parseNode);
  commitNodeBuffer(siblings, buffer);
  return { nextIndex: i, literal, parseNode };
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetInt.cs :: GetInt
function getInt(context, allowNegative, index) {
  let i = index;
  if (allowNegative) {
    const withMinus = getLiteralMatch(context.Expression, i, '-');
    if (withMinus > i) {
      i = withMinus;
    }
  }
  let i2 = i;
  while (i2 < context.Expression.length && /[0-9]/.test(context.Expression[i2])) {
    i2 += 1;
  }
  if (i === i2) {
    return { nextIndex: index, digits: null };
  }
  const digits = context.Expression.substring(index, i2);
  return { nextIndex: i2, digits };
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetNumber.cs :: GetNumber
function getNumber(context, siblings, index, errors) {
  if (index >= context.Expression.length) {
    return { NextIndex: index, Value: null, StartIndex: index, Length: 0, ParseNode: null };
  }

  const buffer = createNodeBuffer(siblings);
  const nodes = buffer;
  const currentIndex = skipSpace(context, nodes, index);
  if (currentIndex >= context.Expression.length) {
    return { NextIndex: index, Value: null, StartIndex: index, Length: 0, ParseNode: null };
  }

  const intPart = getInt(context, true, currentIndex);
  if (intPart.nextIndex === currentIndex || !intPart.digits) {
    return { NextIndex: index, Value: null, StartIndex: index, Length: 0, ParseNode: null };
  }

  let i = intPart.nextIndex;
  let intDigits = intPart.digits;
  let hasDecimal = false;
  let hasExp = false;
  let hasLong = false;

  let next = getLiteralMatch(context.Expression, i, '.');
  if (next > i) {
    hasDecimal = true;
    i = next;
  }
  if (hasDecimal) {
    const decimalPart = getInt(context, false, i);
    i = decimalPart.nextIndex;
  }

  next = getLiteralMatch(context.Expression, i, 'E');
  if (next > i) {
    hasExp = true;
    i = next;
  }

  let expDigits = null;
  if (hasExp) {
    const exponentPart = getInt(context, true, i);
    expDigits = exponentPart.digits;
    i = exponentPart.nextIndex;
  }

  if (!hasDecimal) {
    const longSuffix = getLiteralMatch(context.Expression, i, 'l');
    if (longSuffix > i) {
      hasLong = true;
      i = longSuffix;
    }
  }

  if (hasDecimal) {
    const text = context.Expression.substring(currentIndex, i);
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) {
      errors.push(new SyntaxErrorData(currentIndex, i - currentIndex, `${text} couldn't be parsed as floating point`));
      return { NextIndex: index, Value: null, StartIndex: index, Length: 0, ParseNode: null };
    }
    const parseNode = new ParseNode(ParseNodeType.LiteralDouble, currentIndex, i - currentIndex);
    nodes.push(parseNode);
    commitNodeBuffer(siblings, buffer);
    return {
      NextIndex: i,
      Value: makeValue(FSDataType.Float, parsed),
      StartIndex: parseNode.Pos,
      Length: parseNode.Length,
      ParseNode: parseNode
    };
  }

  if (hasExp) {
    const exponentValue = parseInt(expDigits || '', 10);
    if (!Number.isInteger(exponentValue) || exponentValue < 0) {
      errors.push(new SyntaxErrorData(currentIndex, expDigits ? expDigits.length : 0, `Invalid exponentional ${expDigits}`));
      return { NextIndex: index, Value: null, StartIndex: index, Length: 0, ParseNode: null };
    }

    const maxLongDigits = '9223372036854775807';
    if (maxLongDigits.length + 1 < intDigits.length + exponentValue) {
      errors.push(new SyntaxErrorData(currentIndex, expDigits ? expDigits.length : 0, `Exponential ${expDigits} is out of range`));
      return { NextIndex: index, Value: null, StartIndex: index, Length: 0, ParseNode: null };
    }

    intDigits = intDigits + '0'.repeat(exponentValue);
  }

  let bigValue;
  try {
    bigValue = BigInt(intDigits);
  } catch (err) {
    if (hasLong) {
      errors.push(new SyntaxErrorData(currentIndex, intDigits.length, `${intDigits} couldn't be parsed to 64bit integer`));
    }
    return { NextIndex: index, Value: null, StartIndex: index, Length: 0, ParseNode: null };
  }

  const MAX_INT = 2147483647n;
  const MIN_INT = -2147483648n;
  const MAX_LONG = 9223372036854775807n;
  const MIN_LONG = -9223372036854775808n;
  const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

  let nodeType;
  let value;
  let typedValue = null;
  if (hasLong) {
    if (bigValue > MAX_LONG || bigValue < MIN_LONG) {
      errors.push(new SyntaxErrorData(currentIndex, intDigits.length, `${intDigits} couldn't be parsed to 64bit integer`));
      return { NextIndex: index, Value: null, StartIndex: index, Length: 0, ParseNode: null };
    }
    value = bigValue;
    nodeType = ParseNodeType.LiteralLong;
    typedValue = makeValue(FSDataType.BigInteger, value);
  } else if (bigValue <= MAX_INT && bigValue >= MIN_INT && bigValue <= MAX_SAFE && bigValue >= -MAX_SAFE) {
    value = Number(bigValue);
    nodeType = ParseNodeType.LiteralInteger;
    typedValue = makeValue(FSDataType.Integer, value);
  } else if (bigValue <= MAX_LONG && bigValue >= MIN_LONG) {
    value = bigValue;
    nodeType = ParseNodeType.LiteralLong;
    typedValue = makeValue(FSDataType.BigInteger, value);
  } else {
    return { NextIndex: index, Value: null, StartIndex: index, Length: 0, ParseNode: null };
  }

  const parseNode = new ParseNode(nodeType, currentIndex, i - currentIndex);
  nodes.push(parseNode);
  commitNodeBuffer(siblings, buffer);
  return {
    NextIndex: i,
    Value: typedValue,
    StartIndex: parseNode.Pos,
    Length: parseNode.Length,
    ParseNode: parseNode
  };
}

module.exports = {
  createNodeBuffer,
  commitNodeBuffer,
  isCharWhiteSpace,
  getLiteralMatch,
  getToken,
  getWhitespaceToken,
  skipSpace,
  getCommentBlock,
  getSimpleString,
  getSpaceLessString,
  isIdentifierFirstChar,
  isIdentifierOtherChar,
  getIdentifier,
  getKeyWord,
  getKeyWordLiteral,
  getInt,
  getNumber,
  identifierMetrics,
  literalMatchMetrics,
  resetIdentifierMetrics,
  resetLiteralMatchMetrics
};
