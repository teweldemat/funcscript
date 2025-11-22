import { defineConfig } from "tsup";

// Bundle Codemirror so the CommonJS build does not import ESM-only modules.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: false,
  splitting: false,
  clean: true,
  target: "es2019",
  external: ["react", "react-dom", "@tewelde/funcscript"],
  noExternal: [
    "@codemirror/commands",
    "@codemirror/state",
    "@codemirror/view",
  ],
});
