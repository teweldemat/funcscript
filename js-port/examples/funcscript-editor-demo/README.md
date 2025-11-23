# FuncScript editor demo

This mini Vite + React + TypeScript project isolates the
`@tewelde/funcscript-editor` component so we can investigate syntax coloring and
parse issues without the rest of the CIS10 front-end.

The UI renders the editor on the left and exposes helpful diagnostics on the
right:

- Parser metadata (root node, block type, child count)
- Current runtime status / errors from `FuncScriptParser`
- A paged table of the colored segments the editor generates

Use it to quickly verify whether glitches originate from the FuncScript parser,
segment coloring, or the React wrapper.

## Getting started

```bash
cd scratch-pad/funcscript-editor-demo

# Install dependencies (set ESBUILD_BINARY_PATH on Apple Silicon if needed)
npm install
# example fallback when npm hits the esbuild binary validation bug
# ESBUILD_BINARY_PATH=$(pwd)/node_modules/@esbuild/darwin-arm64/bin/esbuild npm install

# Start the local dev server
npm run dev

# Build for production (optional)
npm run build
```

Once `npm run dev` is running, open the printed URL (typically
`http://localhost:5173`) and start typing into the editor. The inspector panel
will refresh live with the computed segments and parser status so you can
capture screenshots or JSON snapshots for debugging.

## Notes

- React is pinned to v18 because the editor currently requires it as a peer
  dependency.
- The project intentionally uses minimal global state so that you can copy
  `src/App.tsx` into CodeSandbox or other repro environments with almost no
  changes.
