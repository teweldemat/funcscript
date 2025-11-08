import type { DefaultFsDataProvider, FsDataProvider, TypedValue } from '@tewelde/funcscript/browser';

type PathSegments = string[];

export type ExpressionListItem = {
  kind: 'folder' | 'expression';
  name: string;
  createdAt?: number;
};

export interface ExpressionCollectionResolver {
  listItems(path: PathSegments): ExpressionListItem[];
  getExpression(path: PathSegments): string | null;
}

export type EvaluationResult = {
  value: unknown;
  typed: TypedValue | null;
  error: string | null;
};

export type EvaluateOptions = {
  baseProvider?: DefaultFsDataProvider;
  timeName?: string;
};

export type FuncDrawEvaluation = {
  environmentProvider: FsDataProvider & {
    setNamedValue(name: string, value: TypedValue | null): void;
  };
  evaluateExpression(path: PathSegments): EvaluationResult | null;
  getFolderValue(path: PathSegments): TypedValue;
  listExpressions(): Array<{ path: PathSegments; name: string }>;
  listFolders(path: PathSegments): Array<{ path: PathSegments; name: string }>;
};

export declare const FuncDraw: {
  evaluate(
    resolver: ExpressionCollectionResolver,
    time?: number,
    options?: EvaluateOptions
  ): FuncDrawEvaluation;
};

export declare function evaluate(
  resolver: ExpressionCollectionResolver,
  time?: number,
  options?: EvaluateOptions
): FuncDrawEvaluation;

export default FuncDraw;
