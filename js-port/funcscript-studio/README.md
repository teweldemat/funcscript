# FuncScript Studio

FuncScript Studio is an interactive playground for the FuncScript runtime. It pairs the
`@tewelde/funcscript` evaluator with the `FuncScriptEditor` React component so you can:

- author and tweak FuncScript expressions with syntax-aware editing
- define the variables each expression depends on and inspect their typed results
- save named collections of variables to your browser's local storage for quick reuse

## Getting Started

```bash
npm install
npm run dev
```

The development server runs on [http://localhost:5173](http://localhost:5173) by default.

## Available Scripts

- `npm run dev` – start the Webpack dev server in development mode with hot reloading
- `npm run build` – type-check the project and produce a production build in `dist`
- `npm run preview` – serve the project with Webpack in production mode
- `npm run lint` – run the generated ESLint configuration

## Formulas

Use the header controls to load any saved formula or save the current expression. Saved formulas
are persisted to `window.localStorage` under the key `funscript-studio:formulas`.

## Test Cases

The Test Cases panel (to the right of the editor) lets you capture variable sets for the active
formula. Use **New** to capture the tester’s current variables as a fresh case, **Duplicate** to fork
the selected case, and **Delete** when you no longer need it. Selecting a case immediately hydrates
the playground, and any edits you make in the tester’s variable editor are applied back to that case
in real time. Data is stored alongside each formula inside the same
`funscript-studio:formulas` `localStorage` entry.

## Variable Sets

Variable sets are stored under the key `funscript-studio:variablesets` in `window.localStorage`.
If you want to reset the studio, clear that key (or use the "Delete" button for any saved set).
