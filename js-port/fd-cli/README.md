# fd-cli

Command line interface for running FuncDraw workspaces directly from filesystem folders that contain `.fx` expressions. The CLI walks folders, exposes them through FuncDraw's resolver, and can evaluate any expression tree.

## Usage

```bash
fd-cli --root ./workspace --expression graphics/main [options]
```

Key options:

- `-r, --root <path>`: folder that contains `.fx` files and subfolders.
- `-e, --expression <path>`: expression path using folder segments (e.g. `graphics/main`).
- `--view <path>`: optional view expression path; falls back to the built-in default viewport when omitted.
- `-f, --format <raw|svg|png>`: choose between JSON output, SVG markup, or PNG bitmap rendering.
- `-o, --out <file>`: write SVG/PNG output to a file (PNG uses `./fd-output.png` when omitted).
- `--width`, `--height`, `--padding`: configure render dimensions.
- `--time`, `--time-name`: control the injected FuncDraw time variable (seconds).
- `--list`: print all discovered expressions.

SVG output is printed to stdout when `--out` is omitted, while PNG output always writes to a file.
