import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { Compartment, EditorState, StateField, type Range } from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  drawSelection,
  highlightActiveLine,
  keymap
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { foldGutter, foldKeymap, foldService } from '@codemirror/language';
import { lineNumbers } from '@codemirror/view';
import { Engine, FuncScriptParser } from '@tewelde/funcscript/browser';
import type { DefaultFsDataProvider } from '@tewelde/funcscript/browser';
import type { ColoredSegment } from './funcscriptColoring.js';
import { computeColoredSegments } from './funcscriptColoring.js';

export const VSCODE_FONT_STACK =
  '"Cascadia Code", "Fira Code", "Fira Mono", "Menlo", "Consolas", "Liberation Mono", "Courier New", monospace';

type HighlightCallbacks = {
  getSegmentsCallback: () => ((segments: ColoredSegment[]) => void) | undefined;
  getErrorCallback: () => ((message: string | null) => void) | undefined;
  getParseModelCallback: () =>
    | ((model: { parseNode: RawParseNode | null; expressionBlock: FuncScriptExpressionBlock | null }) => void)
    | undefined;
};

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
  constructor?: { name?: string };
} | null;

type FoldRange = {
  lineStart: number;
  from: number;
  to: number;
};

type FuncScriptAnalysis = {
  decorations: DecorationSet;
  segments: ColoredSegment[];
  foldRanges: FoldRange[];
  parseNode: RawParseNode | null;
  expressionBlock: FuncScriptExpressionBlock;
};

const defaultContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid #2d2d2d',
  borderRadius: 6,
  backgroundColor: '#1e1e1e',
  overflow: 'hidden'
};

const clampRange = (start: number, end: number, length: number) => {
  const safeStart = Math.max(0, Math.min(start, length));
  const safeEnd = Math.max(safeStart, Math.min(end, length));
  return safeEnd > safeStart ? { start: safeStart, end: safeEnd } : null;
};

const toNodeRange = (node: RawParseNode, docLength: number) => {
  const pos =
    typeof node.Pos === 'number' ? node.Pos : typeof node.pos === 'number' ? node.pos : null;
  const len =
    typeof node.Length === 'number'
      ? node.Length
      : typeof node.length === 'number'
      ? node.length
      : null;
  if (pos === null || len === null) {
    return null;
  }
  return clampRange(pos, pos + len, docLength);
};

const getChildNodes = (node: RawParseNode): RawParseNode[] => {
  const value = node.Childs ?? node.childs ?? node.Children ?? node.children;
  return Array.isArray(value) ? (value as RawParseNode[]) : [];
};

const getNodeType = (node: RawParseNode): string => {
  const type = node.NodeType ?? node.nodeType ?? node.Type ?? node.type;
  return typeof type === 'string' ? type : '';
};

const isWhitespaceNode = (node: RawParseNode) => {
  const nodeType = getNodeType(node).trim().toLowerCase();
  return nodeType.length > 0 && nodeType.includes('whitespace');
};

const skipLeadingLineBreaks = (
  doc: EditorState['doc'],
  start: number,
  limit: number
) => {
  let cursor = start;
  const safeLimit = Math.min(limit, doc.length);
  while (cursor < safeLimit) {
    const ch = doc.sliceString(cursor, cursor + 1);
    if (ch === '\n' || ch === '\r') {
      cursor += 1;
      continue;
    }
    break;
  }
  return cursor;
};

const collectFoldRanges = (root: RawParseNode, doc: EditorState['doc']): FoldRange[] => {
  if (doc.length === 0) {
    return [];
  }

  const stack: RawParseNode[] = [root];
  const byLine = new Map<number, FoldRange>();

  while (stack.length) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    const range = toNodeRange(current, doc.length);
    if (range) {
      const { start, end } = range;
      if (end > start) {
        const isWhitespace = isWhitespaceNode(current);
        if (doc.length === 0) {
          continue;
        }

        let startPos = Math.min(start, doc.length - 1);
        let endPos = Math.max(startPos, Math.min(end - 1, doc.length - 1));

        if (isWhitespace) {
          const clampedStart = Math.max(0, Math.min(start, doc.length));
          const clampedEnd = Math.max(clampedStart, Math.min(end, doc.length));
          startPos = Math.min(clampedStart + 1, doc.length);
          if (startPos > clampedEnd) {
            startPos = clampedEnd;
          }
          endPos = Math.max(startPos, clampedEnd);
        } else {
          const adjustedStart = skipLeadingLineBreaks(doc, startPos, end);
          if (adjustedStart !== startPos) {
            startPos = Math.min(adjustedStart, doc.length - 1);
            if (startPos > endPos) {
              startPos = Math.max(0, Math.min(endPos, doc.length - 1));
            }
          }
        }

        const startLine = doc.lineAt(startPos);
        const endLine = doc.lineAt(Math.max(startPos, endPos));

        if (startLine.number < endLine.number) {
          const lineSpan = endLine.number - startLine.number + 1;
          if (lineSpan <= 2) {
            continue;
          }
          const from = isWhitespace ? startLine.from : startLine.to;
          const to = endLine.from;
          if (to > from) {
            const existing = byLine.get(startLine.from);
            if (!existing || to - from > existing.to - existing.from) {
              byLine.set(startLine.from, {
                lineStart: startLine.from,
                from,
                to
              });
            }
          }
        }
      }
    }

    for (const child of getChildNodes(current)) {
      stack.push(child);
    }
  }

  return Array.from(byLine.values()).sort((a, b) => a.lineStart - b.lineStart);
};

const areSegmentsEqual = (a: ColoredSegment[], b: ColoredSegment[]) => {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    const segA = a[index];
    const segB = b[index];
    if (
      segA.start !== segB.start ||
      segA.end !== segB.end ||
      segA.nodeType !== segB.nodeType ||
      segA.color !== segB.color
    ) {
      return false;
    }
  }
  return true;
};

const createFuncScriptExtensions = (
  provider: DefaultFsDataProvider,
  callbacks: HighlightCallbacks
) => {
  const { getSegmentsCallback, getErrorCallback, getParseModelCallback } = callbacks;

  const analyze = (state: EditorState): FuncScriptAnalysis => {
    const expression = state.doc.toString();
    let parseNode: RawParseNode | null = null;
    let errorMessage: string | null = null;
    let expressionBlock: FuncScriptExpressionBlock = null;

    if (expression.trim().length > 0) {
      try {
        const result = FuncScriptParser.parse(provider, expression);
        parseNode = (result?.parseNode as RawParseNode) ?? null;
        expressionBlock = (result?.block as FuncScriptExpressionBlock) ?? null;
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
      }
    }

    if (!errorMessage && expression.trim().length > 0 && !parseNode && !expressionBlock) {
      errorMessage = 'Expression could not be parsed.';
    }

    const segments = computeColoredSegments(expression, parseNode);

    const decorations: Range<Decoration>[] = [];
    for (const segment of segments) {
      if (!segment.color) {
        continue;
      }

      const style = 'color:' + segment.color + ';';
      decorations.push(
        Decoration.mark({
          attributes: {
            style
          }
        }).range(segment.start, segment.end)
      );
    }

    const segmentsCallback = getSegmentsCallback();
    if (segmentsCallback) {
      segmentsCallback(segments);
    }
    const errorCallback = getErrorCallback();
    if (errorCallback) {
      errorCallback(errorMessage);
    }
    const parseModelCallback = getParseModelCallback();
    if (parseModelCallback) {
      parseModelCallback({ parseNode, expressionBlock });
    }

    const foldRanges = parseNode ? collectFoldRanges(parseNode, state.doc) : [];

    return {
      decorations: Decoration.set(decorations, true),
      segments,
      foldRanges,
      parseNode,
      expressionBlock
    };
  };

  const analysisField = StateField.define<FuncScriptAnalysis>({
    create(state) {
      return analyze(state);
    },
    update(value, tr) {
      if (!tr.docChanged) {
      return value;
    }
    return analyze(tr.state);
  }
  });

  const highlightPlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      segments: ColoredSegment[];

      constructor(view: EditorView) {
        const analysis = view.state.field(analysisField);
        this.decorations = analysis.decorations;
        this.segments = analysis.segments;
      }

      update(update: ViewUpdate) {
        if (update.docChanged) {
          const analysis = update.state.field(analysisField);
          if (!areSegmentsEqual(this.segments, analysis.segments)) {
            this.segments = analysis.segments;
          } else {
            this.segments = analysis.segments;
          }
          this.decorations = analysis.decorations;
        }
      }
    },
    {
      decorations: (value) => value.decorations
    }
  );

  const folding = foldService.of((state, lineStart, _lineEnd) => {
    const analysis = state.field(analysisField, false);
    if (!analysis) {
      return null;
    }
    for (const range of analysis.foldRanges) {
      if (range.lineStart === lineStart) {
        return { from: range.from, to: range.to };
      }
    }
    return null;
  });

  return [analysisField, highlightPlugin, folding];
};

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

const FuncScriptEditor = ({
  value,
  onChange,
  onSegmentsChange,
  onError,
  onParseModelChange,
  minHeight = 260,
  style,
  readOnly = false
}: FuncScriptEditorProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const providerRef = useRef<DefaultFsDataProvider | null>(null);
  const editableCompartmentRef = useRef(new Compartment());

  const segmentsCallbackRef = useRef(onSegmentsChange);
  const errorCallbackRef = useRef(onError);
  const parseModelCallbackRef = useRef(onParseModelChange);

  useEffect(() => {
    segmentsCallbackRef.current = onSegmentsChange;
  }, [onSegmentsChange]);

  useEffect(() => {
    errorCallbackRef.current = onError;
  }, [onError]);

  useEffect(() => {
    parseModelCallbackRef.current = onParseModelChange;
  }, [onParseModelChange]);

  const containerStyle = useMemo(
    () => ({
      ...defaultContainerStyle,
      minHeight,
      ...(style ?? {})
    }),
    [minHeight, style]
  );

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const provider = providerRef.current ?? new Engine.DefaultFsDataProvider();
    providerRef.current = provider;

    const funcscriptExtensions = createFuncScriptExtensions(provider, {
      getSegmentsCallback: () => segmentsCallbackRef.current,
      getErrorCallback: () => errorCallbackRef.current,
      getParseModelCallback: () => parseModelCallbackRef.current
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        drawSelection(),
        highlightActiveLine(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab, ...foldKeymap]),
        lineNumbers(),
        EditorView.lineWrapping,
        foldGutter(),
        editableCompartmentRef.current.of(EditorView.editable.of(!readOnly)),
        EditorView.theme(
          {
            '&': {
              fontFamily: VSCODE_FONT_STACK,
              fontWeight: 400,
              fontSize: '13px',
              minHeight: `${minHeight}px`,
              height: '100%',
              backgroundColor: '#1e1e1e',
              color: '#d4d4d4'
            },
            '.cm-content': {
              padding: '16px 0'
            },
            '.cm-scroller': {
              overflow: 'auto',
              height: '100%'
            },
            '.cm-gutters': {
              backgroundColor: '#1e1e1e',
              color: '#858585',
              border: 'none'
            },
            '.cm-activeLine': {
              backgroundColor: 'rgba(255, 255, 255, 0.08)'
            },
            '.cm-activeLineGutter': {
              color: '#c6c6c6'
            },
            '.cm-lineNumbers .cm-gutterElement': {
              padding: '0 6px'
            },
            '.cm-selectionBackground': {
              backgroundColor: 'rgba(128, 189, 255, 0.35) !important'
            },
            '.cm-cursor': {
              borderLeftColor: '#aeafad'
            },
            '.cm-foldGutter': {
              color: '#c5c5c5'
            }
          },
          { dark: true }
        ),
        ...funcscriptExtensions,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const nextValue = update.state.doc.toString();
            onChange(nextValue);
          }
        })
      ]
    });

    const view = new EditorView({
      state,
      parent: containerRef.current
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
      providerRef.current = null;
    };
  }, [minHeight, onChange]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: editableCompartmentRef.current.reconfigure(EditorView.editable.of(!readOnly))
    });
  }, [readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const currentValue = view.state.doc.toString();
    if (currentValue !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value
        }
      });
    }
  }, [value]);

  return <div ref={containerRef} style={containerStyle} />;
};

export default FuncScriptEditor;
