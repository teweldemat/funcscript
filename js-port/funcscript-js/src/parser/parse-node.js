'use strict';

// Mirrors FuncScript/Parser/FuncScriptParser.Main.cs :: FuncScriptParser.ParseNodeType
const ParseNodeType = Object.freeze({
  RootExpression: 'RootExpression',
  NoneExecutable: 'NoneExecutable',
  Comment: 'Comment',
  WhiteSpace: 'WhiteSpace',
  ListSeparator: 'ListSeparator',
  OpenBrace: 'OpenBrace',
  CloseBrance: 'CloseBrance',
  StringDelimeter: 'StringDelimeter',
  LambdaArrow: 'LambdaArrow',
  Colon: 'Colon',
  FunctionParameterList: 'FunctionParameterList',
  FunctionCall: 'FunctionCall',
  MemberAccess: 'MemberAccess',
  Selection: 'Selection',
  InfixExpression: 'InfixExpression',
  LiteralInteger: 'LiteralInteger',
  KeyWord: 'KeyWord',
  LiteralDouble: 'LiteralDouble',
  LiteralLong: 'LiteralLong',
  Identifier: 'Identifier',
  IdentiferList: 'IdentiferList',
  Operator: 'Operator',
  ThirdOperandDelimeter: 'ThirdOperandDelimeter',
  LambdaExpression: 'LambdaExpression',
  ExpressionInBrace: 'ExpressionInBrace',
  LiteralString: 'LiteralString',
  StringTemplate: 'StringTemplate',
  KeyValuePair: 'KeyValuePair',
  KeyValueCollection: 'KeyValueCollection',
  List: 'List',
  Key: 'Key',
  Case: 'Case',
  IfExpression: 'IfExpression',
  GeneralInfixExpression: 'GeneralInfixExpression',
  PrefixOperatorExpression: 'PrefixOperatorExpression',
  LanguageBinding: 'LanguageBinding'
});

// Mirrors FuncScript/Parser/FuncScriptParser.Main.cs :: FuncScriptParser.SyntaxErrorData
class SyntaxErrorData {
  constructor(loc, length, message) {
    this.Loc = loc;
    this.Length = length;
    this.Message = message;
  }
}

// Mirrors FuncScript/Parser/FuncScriptParser.Main.cs :: FuncScriptParser.ParseNode
class ParseNode {
  constructor(nodeType, pos = 0, length = 0, childs = []) {
    this.NodeType = nodeType;
    this.Pos = pos;
    this.Length = length;
    this.Childs = Array.isArray(childs) ? childs : [];
  }
}

module.exports = {
  ParseNodeType,
  SyntaxErrorData,
  ParseNode
};
