export enum FSDataType {
  Null = 0,
  Boolean = 1,
  Integer = 2,
  BigInteger = 3,
  DateTime = 4,
  Guid = 5,
  Float = 6,
  String = 7,
  ByteArray = 8,
  List = 9,
  KeyValueCollection = 10,
  Function = 11,
  ValRef = 12,
  ValSink = 13,
  SigSource = 14,
  SigSink = 15,
  Error = 16
}

export const CallType: {
  readonly Infix: 'infix';
  readonly Prefix: 'prefix';
  readonly Dual: 'dual';
};

export type CallTypeValue = typeof CallType[keyof typeof CallType];

export type TypedValue<T = unknown> = readonly [FSDataType, T];

export type FuncScriptInput =
  | TypedValue
  | null
  | undefined
  | boolean
  | number
  | bigint
  | string
  | Date
  | Uint8Array
  | FsList
  | KeyValueCollection
  | BaseFunction
  | FsError
  | ((...args: any[]) => unknown);

export declare class FsError {
  static readonly ERROR_DEFAULT: 'Default';
  static readonly ERROR_PARAMETER_COUNT_MISMATCH: 'TOO_FEW_PARAMETER';
  static readonly ERROR_TYPE_MISMATCH: 'TYPE_MISMATCH';
  static readonly ERROR_TYPE_INVALID_PARAMETER: 'TYPE_INVALID_PARAMETER';

  constructor(type?: string, message?: string, data?: unknown);

  errorType: string;
  errorMessage: string;
  errorData: unknown;

  toString(): string;
}

export declare class FsDataProvider {
  constructor(parent?: FsDataProvider | null);

  parent: FsDataProvider | null;

  get(name: string): TypedValue | null;
  isDefined(name: string): boolean;
}

export declare class MapDataProvider extends FsDataProvider {
  constructor(map?: Record<string, FuncScriptInput>, parent?: FsDataProvider | null);

  set(name: string, value: FuncScriptInput): void;
  get(name: string): TypedValue | null;
  isDefined(name: string): boolean;
}

export declare class KvcProvider extends FsDataProvider {
  constructor(collection: KeyValueCollection, parent?: FsDataProvider | null);

  get(name: string): TypedValue | null;
  isDefined(name: string): boolean;
}

export declare class DefaultFsDataProvider extends MapDataProvider {
  constructor(map?: Record<string, FuncScriptInput>, parent?: FsDataProvider | null);
}

export type PackageResolverChild = string | {
  name: string;
} | {
  Name: string;
};

export interface PackageExpressionDescriptor {
  expression: string;
  language?: string | null;
}

export interface PackageResolver {
  listChildren(path: readonly string[]): Iterable<PackageResolverChild> | PackageResolverChild[] | null | undefined;
  getExpression(path: readonly string[]): PackageExpressionDescriptor | string | null | undefined;
  import?(packageName: string): PackageResolver | null | undefined;
}

export interface LanguageBindingCompilationResult {
  compiled: unknown;
  error?: string | null;
}

export interface LanguageBinding {
  compile(code: string): LanguageBindingCompilationResult | unknown;
  evaluate(compiledCode: unknown, provider: FsDataProvider): FuncScriptInput;
}

export declare abstract class ParameterList {
  abstract get count(): number;
  abstract getParameter(provider: FsDataProvider, index: number): FuncScriptInput;
}

export declare class BaseFunction {
  symbol: string | null;
  precidence: number;

  constructor();

  get callType(): CallTypeValue;
  set callType(value: CallTypeValue);

  evaluate(provider: FsDataProvider, parameters: ParameterList): FuncScriptInput;
  parName(index: number): string;
  getCallInfo(): {
    callType: CallTypeValue;
    symbol: string | null;
    precidence: number;
    maxParameters: number;
  };
  get maxParameters(): number;
}

export declare class ExpressionFunction extends BaseFunction {
  readonly parameters: readonly string[];
  context: KeyValueCollection | null;

  constructor(parameters: readonly string[], expressionBlock: {
    evaluate(provider: FsDataProvider): FuncScriptInput;
  });

  setContext(context: KeyValueCollection): void;
  get maxParameters(): number;
  evaluate(provider: FsDataProvider, parameters: ParameterList): TypedValue;
  parName(index: number): string;
}

export declare class FsList implements Iterable<TypedValue> {
  readonly length: number;
  constructor();
  get(index: number): TypedValue | null;
  toArray(): TypedValue[];
  equals(other: unknown): boolean;
  [Symbol.iterator](): IterableIterator<TypedValue>;
}

export declare class ArrayFsList extends FsList {
  constructor(values: readonly FuncScriptInput[]);
}

export declare class KeyValueCollection extends FsDataProvider {
  constructor(parent?: FsDataProvider | null);

  get(key: string): TypedValue | null;
  isDefined(key: string): boolean;
  getAll(): Array<readonly [string, TypedValue]>;

  static merge(
    col1: KeyValueCollection | null,
    col2: KeyValueCollection | null
  ): KeyValueCollection | null;
}

export declare class SimpleKeyValueCollection extends KeyValueCollection {
  constructor(parent?: FsDataProvider | null);
  constructor(entries: Array<readonly [string, FuncScriptInput]>);
  constructor(parent: FsDataProvider | null, entries: Array<readonly [string, FuncScriptInput]>);
}

export interface TraceInfo {
  startIndex: number;
  startLine: number;
  startColumn: number;
  endIndex: number;
  endLine: number;
  endColumn: number;
  snippet: string | null;
  result: unknown;
}

export type TraceHook = (result: unknown, info: TraceInfo, entryState?: unknown) => void;
export type TraceEntryHook = (info: TraceInfo | null) => unknown;

export interface TestCaseResultError {
  type: 'evaluation' | 'assertion';
  message?: string;
  stack?: string;
  reason?: string;
  testIndex?: number;
  fsError?: {
    errorType: string;
    errorMessage: string;
    errorData: unknown;
  };
}

export interface TestCaseResult {
  index: number;
  input: unknown;
  expressionResult?: unknown;
  assertionResult?: unknown;
  passed: boolean;
  error?: TestCaseResultError;
}

export interface TestSuiteResultSummary {
  total: number;
  passed: number;
  failed: number;
}

export interface TestSuiteResult {
  id: string;
  name: string;
  summary: TestSuiteResultSummary;
  cases: TestCaseResult[];
}

export interface TestRunSummary {
  suites: number;
  cases: number;
  passed: number;
  failed: number;
}

export interface TestRunResult {
  suites: TestSuiteResult[];
  summary: TestRunSummary;
}

export interface PackageTestResultEntry {
  path: string;
  testPath: string;
  result: TestRunResult;
}

export interface PackageTestSummary {
  scripts: number;
  suites: number;
  cases: number;
  passed: number;
  failed: number;
}

export interface PackageTestRunResult {
  tests: PackageTestResultEntry[];
  summary: PackageTestSummary;
}

export declare function evaluate(
  expression: string,
  provider?: FsDataProvider
): TypedValue;

export declare function trace(
  expression: string,
  hook?: TraceHook,
  entryHook?: TraceEntryHook
): TypedValue;

export declare function trace(
  expression: string,
  provider: FsDataProvider,
  hook?: TraceHook,
  entryHook?: TraceEntryHook
): TypedValue;

export declare function evaluateTemplate(
  template: string,
  provider?: FsDataProvider
): string;

export declare function FormatToJson(value: FuncScriptInput): string;

export type PackageTraceHook = (path: string, info: TraceInfo, entryState?: unknown) => void;
export type PackageTraceEntryHook = (path: string, info: TraceInfo | null) => unknown;
export type PackageEvaluator = (
  provider?: FsDataProvider,
  traceHook?: PackageTraceHook,
  entryHook?: PackageTraceEntryHook
) => TypedValue;
export declare function loadPackage(
  resolver: PackageResolver,
  provider?: FsDataProvider,
  traceHook?: PackageTraceHook,
  entryHook?: PackageTraceEntryHook
): PackageEvaluator;

export interface ParsedResolver extends PackageResolver {
  EvalExpressionBlock(context: FsDataProvider, path: string[], traceState?: unknown): TypedValue | null;
  evalExpressionBlock(path: string[], context: FsDataProvider, traceState?: unknown): TypedValue | null;
  clearParsedCache(): void;
}

export declare function createParsedResolver(
  resolver: PackageResolver,
  parseProvider?: FsDataProvider
): ParsedResolver;

export declare function assertTyped(value: FuncScriptInput): TypedValue;
export declare function assertTyped(value: FuncScriptInput, message?: string): TypedValue;
export declare function normalize(value: FuncScriptInput): TypedValue;
export declare function makeValue(type: FSDataType, value: unknown): TypedValue;
export declare function typeOf(value: TypedValue): FSDataType;
export declare function valueOf<T>(value: TypedValue<T>): T;
export declare function typedNull(): TypedValue<null>;
export declare function expectType(
  value: FuncScriptInput,
  expectedType: FSDataType,
  message?: string
): TypedValue;
export declare function convertToCommonNumericType(
  left: FuncScriptInput,
  right: FuncScriptInput
): readonly [TypedValue, TypedValue];

export declare function test(
  expression: string,
  testExpression: string,
  provider?: FsDataProvider
): TestRunResult;

export declare function testPackage(
  resolver: PackageResolver,
  provider?: FsDataProvider
): PackageTestRunResult;

export declare function getTypeName(type: FSDataType): string;

export type BuiltinFunctionMap = Record<string, BaseFunction>;
export declare function buildBuiltinMap(): BuiltinFunctionMap;

export declare function registerLanguageBinding(identifier: string, binding: LanguageBinding): void;
export declare function tryGetLanguageBinding(identifier: string): LanguageBinding | null;
export declare function clearLanguageBindings(): void;

export declare function colorParseTree(
  node: import('./parser/funcscript-parser').ParseNode | null | undefined
): import('./parser/funcscript-parser').ParseNode[];

export declare const Engine: {
  evaluate: typeof evaluate;
  evaluateTemplate: typeof evaluateTemplate;
  FormatToJson: typeof FormatToJson;
  loadPackage: typeof loadPackage;
  createParsedResolver: typeof createParsedResolver;
  test: typeof test;
  testPackage: typeof testPackage;
  colorParseTree: typeof colorParseTree;
  FuncScriptParser: typeof import('./parser/funcscript-parser').FuncScriptParser;
  DefaultFsDataProvider: typeof DefaultFsDataProvider;
  FsDataProvider: typeof FsDataProvider;
  MapDataProvider: typeof MapDataProvider;
  KvcProvider: typeof KvcProvider;
  assertTyped: typeof assertTyped;
  normalize: typeof normalize;
  makeValue: typeof makeValue;
  typeOf: typeof typeOf;
  valueOf: typeof valueOf;
  typedNull: typeof typedNull;
  expectType: typeof expectType;
  convertToCommonNumericType: typeof convertToCommonNumericType;
  FSDataType: typeof FSDataType;
  getTypeName: typeof getTypeName;
  CallType: typeof CallType;
  BaseFunction: typeof BaseFunction;
  ParameterList: typeof ParameterList;
  ExpressionFunction: typeof ExpressionFunction;
  FsList: typeof FsList;
  ArrayFsList: typeof ArrayFsList;
  KeyValueCollection: typeof KeyValueCollection;
  SimpleKeyValueCollection: typeof SimpleKeyValueCollection;
  FsError: typeof FsError;
  buildBuiltinMap: typeof buildBuiltinMap;
  registerLanguageBinding: typeof registerLanguageBinding;
  tryGetLanguageBinding: typeof tryGetLanguageBinding;
  clearLanguageBindings: typeof clearLanguageBindings;
};

export { FuncScriptParser, ParseNodeType, ParseNode, ParseResult } from './parser/funcscript-parser';
