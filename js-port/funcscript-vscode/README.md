# FuncScript VS Code Extension

This extension adds parser-backed language support for FuncScript `.fx` files in Visual Studio Code.

## Features

- Semantic syntax highlighting generated from the official FuncScript parser provided by `@tewelde/funcscript`.
- Structural folding ranges derived from the same parse tree, so folding respects FuncScript blocks, lists, and key/value collections.
- Language configuration for comments, bracket matching, and region markers (`// #region` and `// #endregion`).

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the extension once (VS Code will also compile on demand):
   ```bash
   npm run compile
   ```
3. Press `F5` in VS Code to launch an Extension Development Host with the extension loaded.

## Packaging

Use `vsce package` (from the [VSCE CLI](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)) to build a `.vsix` package for distribution.

## Icon Theme

This extension ships a file icon for `.fx` files. After installing, either run **FuncScript: Apply Icon Theme** (Command Palette) or choose **FuncScript** under **Preferences: File Icon Theme** to apply the custom `f(x)` icon in the explorer and tabs.

## File Associations

The extension automatically associates files ending in `.fx` with the FuncScript language definition.

## License

Licensed under the MIT License. See `LICENSE` for details.

## Contributing

Issues and pull requests are welcome if you would like to refine the highlighting, add diagnostics, or ship additional FuncScript tooling.
