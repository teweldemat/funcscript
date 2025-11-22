import MinimalCodeMirror from './MinimalCodeMirror';

function App(): JSX.Element {
  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 24,
        maxWidth: 960,
        margin: '0 auto',
      }}
    >
      <header>
        <p style={{ margin: 0, color: '#94a3b8', letterSpacing: 0.3 }}>
          CRA + react-scripts smoke test
        </p>
        <h1 style={{ margin: '4px 0 8px', color: '#e2e8f0' }}>
          FuncScriptEditor CommonJS compatibility
        </h1>
        <p style={{ margin: 0, maxWidth: 720, color: '#cbd5e1' }}>
          This project mirrors create-react-app projects (react-scripts test +
          build) and depends on the local file build of
          <code style={{ marginLeft: 6 }}>@tewelde/funcscript-editor</code>.
          If Jest or the dev server fails to parse ESM, something is wrong with
          the CJS output.
        </p>
      </header>

      <MinimalCodeMirror />
    </div>
  );
}

export default App;
