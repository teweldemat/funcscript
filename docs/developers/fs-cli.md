# FuncScript CLI

`@tewelde/fs-cli` is a lightweight Node.js command line interface that wraps the FuncScript runtime from the JavaScript port. It lets you evaluate expressions, execute FuncScript test suites, and recursively scan folders for `.fs` / `.fx` scripts.

## Installation

Install globally (requires Node.js 18+):

```bash
npm install -g @tewelde/fs-cli
```

or invoke it ad-hoc with `npx`:

```bash
npx @tewelde/fs-cli '1 + 2'
```

## Basic Usage

Evaluate an expression and print the result:

```bash
fs-cli '1 + 2'
```

Run an expression together with a FuncScript test expression:

```bash
fs-cli 'a + b' --test '{ suite: { name: "adds"; cases: [{"a":1, "b":2}]; test: (res, data) => res = data.a + data.b }; eval [suite]; }'
```

Reference files instead of inline expressions when you already have `.fs` artifacts on disk:

```bash
fs-cli -i script.fs --test script.test.fs
```

### Scan Mode

Use the `--scan` / `-s` flag to traverse a folder, parse every `.fs`/`.fx` file, and run matching `<name>.test.fs` suites:

```bash
fs-cli --scan /path/to/project
```

The scan output lists each parsed file, runs any paired tests, and summarizes totals. Failures include per-case assertion details (inputs, results, and the assertion error message such as `1 != 2`). Use `--json` or `--compact` to emit machine-readable summaries.

## Flags

- `-i <path>` – Read the expression under test from a FuncScript file (only used in conjunction with `--test`).
- `--test`, `-t` – Enable test mode using either inline expressions or `-i`/file inputs.
- `--scan <path>`, `-s <path>` – Recursively parse scripts under the provided path and run paired `<name>.test.fs` suites.
- `--json` – Output JSON only.
- `--compact` – Emit compact JSON (implies `--json`).
- `--version`, `-v` – Show CLI version.
- `--help`, `-h` – Display usage instructions.

## Self-test

The CLI exposes a smoke test that exercises both evaluation and the test runner:

```bash
npm test
```

This command runs `fs-cli --self-test` and verifies the bundled evaluation + testing harness is functioning.
