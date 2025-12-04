# FuncScript Packages

FuncScript packages compose a FuncScript program from separate expressions that are organized hierarchically (for example, files and folders in a repository).  A package is a tree of expressions—folders, helper bindings, and executable leaves—and the resolver simply serves that tree to the runtime.  `loadPackage(resolver, provider?, traceHook?)` walks that tree, generates a FuncScript program, and evaluates it with the same runtime used by `evaluate` and `test`. Omit the optional parameters to use the default data provider and skip tracing.

## Resolver Contract

`loadPackage` expects an object with the following shape:

```ts
interface PackageResolver {
  listChildren(path: string[]): Iterable<string | { name: string } | { Name: string }>;
  getExpression(path: string[]): string | { expression?: string; code?: string; language?: string } | null;
  package?(name: string): PackageResolver | null; // optional dependency hook
}
```

- `path` is an array of case-sensitive segments (root is `[]`). The resolver decides how the path maps to files, database rows, etc.
- `listChildren` returns every entry owned by the node at `path`. Each entry can be a string or an object that exposes `name`/`Name`. Duplicate names (case-insensitive) are rejected.
- `getExpression` returns the FuncScript expression stored at `path`. The runtime accepts a raw string or an object with `expression`/`code` plus an optional `language` hint.
- Implement either `listChildren` or `getExpression` for a node, but not both. A node with an expression is a leaf; a node with children becomes a folder/block.
- Expose `package(name)` when the package can delegate to a different resolver. `loadPackage` wires that function into the runtime so package expressions can call `package('someName')` to pull in dependencies.

When `provider` is omitted, `loadPackage` falls back to `DefaultFsDataProvider`, so package expressions can reference host-provided values just like any other script.

## Node Semantics

Folders are turned into FuncScript blocks that declare each child as a binding. Leaves evaluate to whatever the stored expression produces. Special rules apply for a child named `eval`:

- Adding `eval <expression>` to a folder (including the root) says “return this binding from the block”. Without it, the folder evaluates to an object containing all of its declarations.
- Because blocks introduce lexical bindings, sibling expressions can reference each other (`helpers.doubler(21)`) and even return lambdas for other parts of the tree to invoke.
- You can nest folders arbitrarily. The generated block mirrors the resolver hierarchy, so `product.pricing.tax` inside FuncScript resolves to the segment path `['product', 'pricing', 'tax']` in the resolver.

Every binding defined inside a folder is available to FuncScript and to embedded JavaScript blocks thanks to the runtime’s provider plumbing.

### Evaluation flow and lazy members

`loadPackage` evaluates in three passes:

1. If the resolver exposes a root expression (`getExpression([])`), the loader evaluates it immediately and returns the result.
2. If the resolver exposes an `eval` child, the loader builds a lazy key-value collection for the resolver tree, evaluates the `eval` expression within that context, and returns its value.
3. Otherwise the loader returns a lazy key-value collection that resolves children on demand. This means unused malformed nodes (for example, `x: '1+{'`) do not fail the load; errors surface when the member is accessed. In JS the lazy access returns a typed `FsError`; in .NET it returns an `FsError` instance.

Nested packages (`package('name')`) are loaded using the same rules, so laziness and tracing (below) apply throughout the dependency graph.

## Expression Languages

The descriptor returned by `getExpression` can specify the language used to author the expression:

- Omit `language` (or set it to `funcscript`) to treat the payload as plain FuncScript.
- Set `language` to `javascript` to embed a fenced block that runs inside the FuncScript scope. The runtime automatically wraps the snippet in ```javascript fences, so values such as `helpers` or `package` are in scope and you can `return` data back to FuncScript.
- Any other language string throws, which keeps packages predictable.

Values can also be authored directly with fenced ```javascript blocks when your source system already stores the triple-backtick payload.

## Importing Nested Packages

If the resolver implements `package(name)`, `loadPackage` injects a FuncScript helper named `package`. Any `package('math')` call inside the package flows straight to `resolver.package('math')`, and the returned resolver is loaded recursively. Use this hook to stitch multiple packages together:

```funcscript
{
  height: package('stickman').helpers.doubler(21);
  eval height;
}
```

Inside a JavaScript block, use the same helper (`return package('stickman').helpers.doubler(21);`). The loader validates the requested name, throws for missing packages, and recursively calls `loadPackage` with the nested resolver.

## Tracing

Both runtimes accept an optional trace hook on `loadPackage`:

 - **JS**: `loadPackage(resolver, provider?, (path, traceInfo) => { ... })`
 - **.NET**: `PackageLoader.LoadPackage(resolver, provider?, (path, info) => { ... })`

The hook receives the package path being evaluated (for example, `eval`, `helpers/doubler`, or `x`), plus a trace payload with start/end line/column data, a snippet, and the evaluation result. Hooks fire for successful evaluations and for failures (syntax errors and exceptions are wrapped as `FsError`/`FsError` instances and delivered through the hook). Lazy member evaluations also invoke the hook when accessed, so you can observe deferred errors without breaking package load.

Example (JS):

```javascript
const traces = [];
const typed = loadPackage(resolver, undefined, (path, info) => traces.push({ path, info }));
console.log(traces.map(t => `${t.path}: ${t.info.snippet}`));
```

## Example

The snippet below sketches a resolver that hard-codes a few expressions. Real implementations read from disk, a database, or a remote API, but the contract is the same.

```javascript
const { loadPackage, valueOf } = require('@tewelde/funcscript');

const sketchResolver = {
  listChildren(path) {
    const key = path.join('/');
    switch (key) {
      case '':
        return ['scene', 'eval'];
      case 'scene':
        return ['helpers', 'leg'];
      case 'scene/helpers':
        return ['doubler'];
      default:
        return [];
    }
  },
  getExpression(path) {
    const key = path.join('/');
    switch (key) {
      case 'scene/helpers/doubler':
        return '(value) => value * 2';
      case 'scene/leg':
        return 'helpers.doubler(21)';
      case 'eval':
        return 'scene.leg';
      default:
        return null;
    }
  }
};

const typed = loadPackage(sketchResolver);
console.log(valueOf(typed)); // 42
```

Hooks such as `helpers` folders, lambdas, and JavaScript snippets behave exactly the same as they do in standalone FuncScript files because the generated program is just another FuncScript block. Test coverage in `js-port/funcscript-js-test/tests/fs-package` shows additional patterns such as exposing helper folders, returning functions from expressions, and binding multiple packages together.

## Package Tests

`testPackage(resolver, provider?)` scans each folder in a resolver for `<name>` / `<name>.test` siblings (case-insensitive) and runs the bundled tests using the FuncScript Test Framework. The `<name>` node represents the expression under test and `<name>.test` contains the test script. The special `eval` name is treated the same way, so providing both `eval` and `eval.test` lets you test the folder’s exported value.

```javascript
const { testPackage } = require('@tewelde/funcscript');

const resolver = createResolverFromFilesystem('/path/to/package');
const result = testPackage(resolver);

for (const test of result.tests) {
  console.log(test.path, test.result.summary);
}
```

Each `.test` expression is evaluated with the same package context as the script it targets, so shared helpers, nested folders, and even `package('other')` imports remain available. When the script under test is a function, you can either call it directly from your test or use the `{ ambient, input }` shape documented in the test framework to supply provider overrides and (optionally) the arguments to invoke it with.

## Failure Modes

`loadPackage` surfaces clear errors when the resolver violates its contract:

- Nodes cannot declare both children and an expression, and the root must expose at least one of them.
- Child names are canonicalized case-insensitively, so `tax` and `Tax` under the same folder throw.
- `package()` requires a non-empty name and must return a resolver, otherwise evaluation stops.
- Unsupported expression languages result in `Unsupported package expression language '<lang>'`.

Use these constraints to validate incoming metadata before calling `loadPackage`, or bubble the errors back to the system that stores your package definition.
