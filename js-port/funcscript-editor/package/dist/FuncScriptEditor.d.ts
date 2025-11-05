import type { CSSProperties } from 'react';
import type { ColoredSegment } from './funcscriptColoring';
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
        parseNode: unknown;
        expressionBlock: FuncScriptExpressionBlock;
    }) => void;
    minHeight?: number;
    style?: CSSProperties;
    readOnly?: boolean;
};
declare const FuncScriptEditor: ({ value, onChange, onSegmentsChange, onError, onParseModelChange, minHeight, style, readOnly }: FuncScriptEditorProps) => import("react/jsx-runtime").JSX.Element;
export default FuncScriptEditor;
