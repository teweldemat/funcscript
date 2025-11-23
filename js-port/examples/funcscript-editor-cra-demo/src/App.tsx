import { useMemo, useState } from 'react';
import {
  FuncScriptEditor,
  type ColoredSegment,
  type FuncScriptExpressionBlock
} from '@tewelde/funcscript-editor';
import { javascript } from '@codemirror/lang-javascript';

import './App.css';

const SAMPLE_EXPRESSION = `{
  gross:5200,
  taxRate:0.12,
  net:(amount)=>amount*(1-taxRate);
  return net(gross);
}`;

type ParseSummary = {
  blockLabel: string;
  nodeLabel: string;
  childCount: number;
};

const DEFAULT_SUMMARY: ParseSummary = {
  blockLabel: 'No expression block',
  nodeLabel: 'Editor has not parsed any text yet.',
  childCount: 0
};

function App(): JSX.Element {
  const [expression, setExpression] = useState(SAMPLE_EXPRESSION);
  const [segments, setSegments] = useState<ColoredSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ParseSummary>(DEFAULT_SUMMARY);

  const visibleSegments = useMemo(() => segments.slice(0, 12), [segments]);
  const overflowCount = Math.max(segments.length - visibleSegments.length, 0);

  const handleParseModelChange = ({
    parseNode,
    expressionBlock
  }: {
    parseNode: unknown;
    expressionBlock: FuncScriptExpressionBlock;
  }) => {
    if (!parseNode && !expressionBlock) {
      setSummary(DEFAULT_SUMMARY);
      return;
    }

    const rawNode = (parseNode ?? {}) as Record<string, unknown>;
    const childCollection =
      (Array.isArray(rawNode.Childs)
        ? (rawNode.Childs as unknown[])
        : Array.isArray(rawNode.childs)
        ? (rawNode.childs as unknown[])
        : []) ?? [];

    setSummary({
      nodeLabel:
        typeof rawNode.NodeType === 'string'
          ? (rawNode.NodeType as string)
          : typeof rawNode.nodeType === 'string'
          ? (rawNode.nodeType as string)
          : 'No parse node returned',
      blockLabel: expressionBlock
        ? expressionBlock.constructor?.name ?? 'Anonymous block'
        : 'No expression block returned',
      childCount: childCollection.length
    });
  };

  const resetExpression = () => {
    setExpression(SAMPLE_EXPRESSION);
  };

  return (
    <main className="app-shell">
      <section className="editor-panel">
        <header className="panel-header">
          <div>
            <p className="eyebrow">FuncScript playground</p>
            <h1>FuncScriptEditor CRA demo</h1>
            <p className="subtitle">
              This mirrors create-react-app projects (react-scripts dev/test/build). Use it to
              verify syntax highlighting, parse node callbacks, and runtime diagnostics without the
              rest of the portal.
            </p>
          </div>
          <button type="button" onClick={resetExpression} className="ghost-button">
            Reset sample script
          </button>
        </header>

        <FuncScriptEditor
          value={expression}
          onChange={setExpression}
          onSegmentsChange={setSegments}
          onError={setError}
          onParseModelChange={handleParseModelChange}
          minHeight={360}
          language={javascript()}
        />

        <div className="helper-text">
          The editor relies on <code>@tewelde/funcscript</code> for parsing. If syntax coloring
          fails, check the "Segments" and "Parser output" panels for mismatches.
        </div>
      </section>

      <section className="inspector-panel">
        <div className="card">
          <h2>Parser output</h2>
          <dl>
            <div>
              <dt>Root node</dt>
              <dd>{summary.nodeLabel}</dd>
            </div>
            <div>
              <dt>Block type</dt>
              <dd>{summary.blockLabel}</dd>
            </div>
            <div>
              <dt>Child nodes</dt>
              <dd>{summary.childCount}</dd>
            </div>
          </dl>
        </div>

        <div className="card">
          <h2>Runtime status</h2>
          <p className={`status-pill ${error ? 'error' : 'ok'}`}>
            {error ?? 'Expression parsed successfully'}
          </p>
        </div>

        <div className="card segments-card">
          <div className="segments-header">
            <h2>Segments ({segments.length})</h2>
            {overflowCount > 0 && (
              <span className="muted">Showing first {visibleSegments.length} entries</span>
            )}
          </div>
          <div className="segment-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Range</th>
                  <th>Type</th>
                  <th>Color</th>
                </tr>
              </thead>
              <tbody>
                {visibleSegments.map((segment, index) => (
                  <tr key={`${segment.start}-${segment.end}-${index}`}>
                    <td>{index + 1}</td>
                    <td>
                      {segment.start} – {segment.end}
                    </td>
                    <td>{segment.nodeType ?? 'n/a'}</td>
                    <td>
                      {segment.color ? (
                        <span className="color-chip" style={{ backgroundColor: segment.color }}>
                          {segment.color}
                        </span>
                      ) : (
                        'default'
                      )}
                    </td>
                  </tr>
                ))}
                {visibleSegments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      Start typing to see highlighted segments.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
