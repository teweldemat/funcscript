'use strict';

const { SyntaxErrorData, ParseNode } = require('./parse-node');

// Mirrors FuncScript/Parser/FuncScriptParser.Models.cs :: FuncScriptParser.ParseContext
class ParseContext {
  constructor(provider, expression, errorsList, options = null) {
    if (!expression && expression !== '') {
      throw new Error('expression is required');
    }
    if (!errorsList) {
      throw new Error('errorsList is required');
    }
    this.Provider = provider;
    this.Expression = expression;
    this.ErrorsList = errorsList;
    this.ReferenceFromParent = Boolean(options && options.referenceFromParent);
  }

  createChild(expression, errorsList, options = null) {
    const childErrors = errorsList || [];
    const referenceFromParent =
      options && Object.prototype.hasOwnProperty.call(options, 'referenceFromParent')
        ? Boolean(options.referenceFromParent)
        : this.ReferenceFromParent;
    return new ParseContext(this.Provider, expression, childErrors, { referenceFromParent });
  }
}

// Mirrors FuncScript/Parser/FuncScriptParser.Models.cs :: FuncScriptParser.ParseResult
class ParseResult {
  constructor(nextIndex) {
    this.NextIndex = nextIndex;
  }

  hasProgress(currentIndex) {
    return this.NextIndex > currentIndex;
  }

  static noAdvance(index) {
    return new ParseBlockResult(index, null);
  }
}

// Mirrors FuncScript/Parser/FuncScriptParser.Models.cs :: FuncScriptParser.ParseBlockResult
class ParseBlockResult extends ParseResult {
  constructor(nextIndex, expressionBlock) {
    super(nextIndex);
    this.ExpressionBlock = expressionBlock || null;
  }
}

// Mirrors FuncScript/Parser/FuncScriptParser.Models.cs :: FuncScriptParser.ParseBlockResultWithNode
class ParseBlockResultWithNode extends ParseBlockResult {
  constructor(nextIndex, expressionBlock, parseNode) {
    super(nextIndex, expressionBlock);
    this.ParseNode = parseNode || null;
  }
}

// Mirrors FuncScript/Parser/FuncScriptParser.Models.cs :: FuncScriptParser.ValueParseResult`1
class ValueParseResult extends ParseResult {
  constructor(nextIndex, value) {
    super(nextIndex);
    this.Value = value;
  }
}

// Mirrors FuncScript/Parser/Syntax/FuncScriptParser.GetIdentifier.cs :: FuncScriptParser.IdenResult
class IdenResult {
  constructor(nextIndex, iden, idenLower, startIndex, length) {
    this.NextIndex = nextIndex;
    this.Iden = iden;
    this.IdenLower = idenLower;
    this.StartIndex = startIndex;
    this.Length = length;
  }
}

module.exports = {
  ParseContext,
  ParseResult,
  ParseBlockResult,
  ParseBlockResultWithNode,
  ValueParseResult,
  IdenResult,
  SyntaxErrorData,
  ParseNode
};
