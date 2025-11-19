# FuncScript CLI

`@tewelde/fs-cli` is a lightweight Node.js command line interface that wraps the FuncScript runtime exported from `js-port/funcscript-js`. Use it to evaluate FuncScript expressions or execute FuncScript test suites directly from your terminal.

## Install

Install globally from npm (requires Node.js 18+):

```bash
npm install -g @tewelde/fs-cli
```

or run ad-hoc without installing:

```bash
npx @tewelde/fs-cli '1 + 2'
```

## Usage

Evaluate an expression:

```bash
fs-cli '1 + 2'
```

Run an expression together with a FuncScript test expression:

```bash
fs-cli 'a + b' --test '{ suite: { name: "adds"; cases: [{"a":1, "b":2}]; test: (result, data) => result = data.a + data.b }; eval [suite]; }'
```

Point to files instead of inline expressions:

```bash
fs-cli -i script.fs --test script.test.fs
```

### Flags

- `--test`, `-t` – Enable test mode; pair with `-i` to reference a test file or provide inline expressions.
- `--scan <path>`, `-s <path>` – Traverse the provided folder, parse every `.fs`/`.fx` file, and run paired `<name>.test.fs` suites.
- `-i <path>` – Read the expression under test from the specified FuncScript file.
- `--json` – Output JSON only.
- `--compact` – Emit compact JSON (implies `--json`).
- `--version`, `-v` – Show CLI version.
- `--help`, `-h` – Display usage instructions.

### Self-test

The CLI exposes a lightweight smoke test that exercises both the evaluator and the test runner:

```bash
npm test
```

## Development

The entry point for the runtime lives in `src/index.js`, and the executable shim resides in `bin/fs-cli.js`. When working inside this repository, run `npm install` followed by `npm link ../funcscript-js` (or `npm install ../funcscript-js --no-save`) so the CLI picks up the local runtime sources while you iterate.
