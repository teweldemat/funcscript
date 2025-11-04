export const ParseNodeType: {
  readonly RootExpression: 'RootExpression';
  readonly NoneExecutable: 'NoneExecutable';
  readonly Comment: 'Comment';
  readonly WhiteSpace: 'WhiteSpace';
  readonly ListSeparator: 'ListSeparator';
  readonly OpenBrace: 'OpenBrace';
  readonly CloseBrance: 'CloseBrance';
  readonly StringDelimeter: 'StringDelimeter';
  readonly LambdaArrow: 'LambdaArrow';
  readonly Colon: 'Colon';
  readonly FunctionParameterList: 'FunctionParameterList';
  readonly FunctionCall: 'FunctionCall';
  readonly MemberAccess: 'MemberAccess';
  readonly Selection: 'Selection';
  readonly InfixExpression: 'InfixExpression';
  readonly LiteralInteger: 'LiteralInteger';
  readonly KeyWord: 'KeyWord';
  readonly LiteralDouble: 'LiteralDouble';
  readonly LiteralLong: 'LiteralLong';
  readonly Identifier: 'Identifier';
  readonly IdentiferList: 'IdentiferList';
  readonly Operator: 'Operator';
  readonly ThirdOperandDelimeter: 'ThirdOperandDelimeter';
  readonly LambdaExpression: 'LambdaExpression';
  readonly ExpressionInBrace: 'ExpressionInBrace';
  readonly LiteralString: 'LiteralString';
  readonly StringTemplate: 'StringTemplate';
  readonly KeyValuePair: 'KeyValuePair';
  readonly KeyValueCollection: 'KeyValueCollection';
  readonly List: 'List';
  readonly Key: 'Key';
  readonly Case: 'Case';
  readonly IfExpression: 'IfExpression';
  readonly GeneralInfixExpression: 'GeneralInfixExpression';
  readonly PrefixOperatorExpression: 'PrefixOperatorExpression';
};
export type ParseNodeTypeKey = keyof typeof ParseNodeType;
export type ParseNodeTypeValue = typeof ParseNodeType[ParseNodeTypeKey];

export class SyntaxErrorData {
  constructor(loc: number, length: number, message: string);
  Loc: number;
  Length: number;
  Message: string;
}

export class ParseNode {
  constructor(nodeType: ParseNodeTypeValue, pos?: number, length?: number, childs?: readonly ParseNode[]);
  NodeType: ParseNodeTypeValue;
  Pos: number;
  Length: number;
  Childs: ParseNode[];
}

export class ParseContext {
  constructor(provider: unknown, expression: string, errors: SyntaxErrorData[]);
  readonly Provider: unknown;
  readonly Expression: string;
  readonly ErrorsList: SyntaxErrorData[];
  createChild(expression: string, errorsList?: SyntaxErrorData[]): ParseContext;
}

export class ParseResult {
  constructor(nextIndex: number);
  readonly NextIndex: number;
  hasProgress(currentIndex: number): boolean;
  static noAdvance(index: number): ParseBlockResult;
}

export class ParseBlockResult extends ParseResult {
  constructor(nextIndex: number, expressionBlock: unknown);
  readonly ExpressionBlock: unknown;
}

export class ParseBlockResultWithNode extends ParseBlockResult {
  constructor(nextIndex: number, expressionBlock: unknown, parseNode: ParseNode | null);
  readonly ParseNode: ParseNode | null;
}

export class ValueParseResult<T = unknown> extends ParseResult {
  constructor(nextIndex: number, value: T);
  readonly Value: T;
}

export class IdenResult {
  constructor(
    nextIndex: number,
    identifier: string | null,
    identifierLower: string | null,
    startIndex: number,
    length: number
  );
  readonly NextIndex: number;
  readonly Iden: string | null;
  readonly IdenLower: string | null;
  readonly StartIndex: number;
  readonly Length: number;
}

export interface ParseOutcome {
  block: unknown;
  parseNode: ParseNode | null;
  errors: SyntaxErrorData[];
  nextIndex: number;
}

export class FuncScriptParser {
  static parseContext(context: ParseContext): ParseOutcome;
  static parse(provider: unknown, expression: string, errorsList?: SyntaxErrorData[]): ParseOutcome;
  static parseFsTemplate(provider: unknown, expression: string, errorsList?: SyntaxErrorData[]): unknown;
  static parseSpaceSeparatedList(
    provider: unknown,
    expression: string,
    errorsList?: SyntaxErrorData[]
  ): readonly string[] | null;
}

export const identifierMetrics: {
  calls: number;
  totalTimeNs: bigint;
  maxTimeNs: bigint;
};

export const literalMatchMetrics: {
  calls: number;
  attemptsByKey: Map<string, number>;
};

export function resetIdentifierMetrics(): void;
export function resetLiteralMatchMetrics(): void;

export const getExpression: (...args: any[]) => ParseBlockResult;
export const getInfixExpression: (...args: any[]) => ParseBlockResult;
export const getInfixExpressionSingleLevel: (...args: any[]) => ParseBlockResult;
export const getInfixExpressionSingleOp: (...args: any[]) => ParseBlockResult;
export const getInfixFunctionCall: (...args: any[]) => ParseBlockResult;
export const getOperator: (...args: any[]) => ValueParseResult<any>;
export const getCallAndMemberAccess: (...args: any[]) => ParseBlockResult;
export const getFunctionCallParametersList: (...args: any[]) => ParseBlockResult;
export const getKvcExpression: (...args: any[]) => ParseBlockResult;
export const getKvcItem: (...args: any[]) => ValueParseResult<any>;
export const getKeyValuePair: (...args: any[]) => ValueParseResult<any>;
export const getReturnDefinition: (...args: any[]) => ParseBlockResult;
export const getListExpression: (...args: any[]) => ParseBlockResult;
export const getSpaceSeparatedListExpression: (...args: any[]) => ValueParseResult<any>;
export const getSpaceSeparatedStringListExpression: (...args: any[]) => ValueParseResult<readonly string[]>;
export const getFSTemplate: (...args: any[]) => ParseBlockResult;
export const getStringTemplate: (...args: any[]) => ParseBlockResult;
export const getUnit: (...args: any[]) => ParseBlockResult;
export const getIfThenElseExpression: (...args: any[]) => ParseBlockResult;
export const getCaseExpression: (...args: any[]) => ParseBlockResult;
export const getSwitchExpression: (...args: any[]) => ParseBlockResult;
export const getLambdaExpression: (...args: any[]) => ValueParseResult<any>;
export const getIdentifierList: (...args: any[]) => number;
export const getPrefixOperator: (...args: any[]) => ParseBlockResult;
export const getRootExpression: (context: ParseContext, index: number) => ParseBlockResultWithNode;
