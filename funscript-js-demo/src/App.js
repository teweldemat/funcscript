import { useState } from 'react';
import { DefaultFsDataProvider } from '@tewelde/funcscript';
import { FuncScriptParser } from '@tewelde/funcscript/parser';
import './App.css';

const SAMPLE_SCRIPT = `{ net:(x)=>x*(1-taxRate);
  return net(gross);
}`;

function App() {
  const [script, setScript] = useState(SAMPLE_SCRIPT);
  const [feedback, setFeedback] = useState(null);

  const handleParse = () => {
    if (!FuncScriptParser?.parse) {
      setFeedback({
        status: 'error',
        errors: [
          {
            key: 'parser-missing',
            message:
              'Parser is unavailable. Ensure that @tewelde/funcscript/parser is bundled correctly.',
            position: null,
            length: null
          }
        ]
      });
      return;
    }

    const provider = new DefaultFsDataProvider();
    const expression = script ?? '';
    const errors = [];

    try {
      const parseOutcome = FuncScriptParser.parse(provider, expression, errors);
      // The parser writes syntax issues either into the provided array or into the return object.
      const parseErrors = errors.length > 0 ? errors : parseOutcome?.errors || [];
      if (!parseOutcome?.block || parseErrors.length > 0) {
        const normalizedErrors =
          parseErrors.length > 0
            ? parseErrors
            : [
                {
                  Message: 'Parser did not return an executable block.',
                  Loc: 0,
                  Length: 0
                }
              ];
        setFeedback({
          status: 'error',
          errors: normalizedErrors.map((err, index) => ({
            key: `${index}-${err?.Loc ?? 0}`,
            message: err?.Message || 'Unknown parser error',
            position: typeof err?.Loc === 'number' ? err.Loc : null,
            length: typeof err?.Length === 'number' ? err.Length : null
          }))
        });
        return;
      }

      setFeedback({
        status: 'success',
        nodeType: parseOutcome.parseNode?.NodeType || 'RootExpression',
        coverage:
          typeof parseOutcome.parseNode?.Length === 'number'
            ? parseOutcome.parseNode.Length
            : expression.length
      });
    } catch (error) {
      setFeedback({
        status: 'error',
        errors: [
          {
            key: 'exception',
            message:
              error instanceof Error ? error.message : 'Unexpected parser failure',
            position: null,
            length: null
          }
        ]
      });
    }
  };

  return (
    <div className="App">
      <main className="panel">
        <h1>FuncScript Parser Demo</h1>
        <p className="lede">
          Type a FuncScript expression below and let the low-level parser from{' '}
          <code>@tewelde/funcscript</code> validate it.
        </p>

        <label className="field" htmlFor="script-input">
          <span>FuncScript Input</span>
          <textarea
            id="script-input"
            value={script}
            onChange={(event) => setScript(event.target.value)}
            spellCheck="false"
            rows={8}
            placeholder="{ return 2 + 2; }"
          />
        </label>

        <div className="actions">
          <button type="button" onClick={handleParse}>
            Parse Script
          </button>
        </div>

        {feedback && feedback.status === 'success' && (
          <section className="parser-result success">
            <h2>Parse Success</h2>
            <p>
              Root node <code>{feedback.nodeType}</code> covers{' '}
              <strong>{feedback.coverage}</strong> characters.
            </p>
          </section>
        )}

        {feedback && feedback.status === 'error' && (
          <section className="parser-result error">
            <h2>Parse Errors</h2>
            <ul>
              {feedback.errors.map((err) => (
                <li key={err.key}>
                  <p>{err.message}</p>
                  {err.position !== null && (
                    <p className="meta">
                      Position: {err.position}, Length: {err.length ?? 0}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
