import { type CSSProperties } from 'react';
import type { ColoredSegment } from './funcscriptColoring.js';
export declare const VSCODE_FONT_STACK = "\"Cascadia Code\", \"Fira Code\", \"Fira Mono\", \"Menlo\", \"Consolas\", \"Liberation Mono\", \"Courier New\", monospace";
type RawParseNode = {
    Pos?: number;
    pos?: number;
    Length?: number;
    length?: number;
    Childs?: RawParseNode[];
    childs?: RawParseNode[];
    Children?: RawParseNode[];
    children?: RawParseNode[];
    NodeType?: string;
    nodeType?: string;
    Type?: string;
    type?: string;
};
export type FuncScriptParseNode = RawParseNode;
export type FuncScriptExpressionBlock = {
    Pos?: number;
    pos?: number;
    Length?: number;
    length?: number;
    getChilds?: () => FuncScriptExpressionBlock[];
    constructor?: {
        name?: string;
    };
} | null;
export type FuncScriptEditorProps = {
    value: string;
    onChange: (value: string) => void;
    onSegmentsChange?: (segments: ColoredSegment[]) => void;
    onError?: (message: string | null) => void;
    onParseModelChange?: (model: {
        parseNode: FuncScriptParseNode | null;
        expressionBlock: FuncScriptExpressionBlock;
    }) => void;
    minHeight?: number;
    style?: CSSProperties;
    readOnly?: boolean;
};
declare const FuncScriptEditor: ({ value, onChange, onSegmentsChange, onError, onParseModelChange, minHeight, style, readOnly }: FuncScriptEditorProps) => import("react/jsx-runtime").JSX.Element;
export default FuncScriptEditor;
