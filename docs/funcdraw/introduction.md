# FuncDraw Overview

FuncDraw is a lightweight rendering runtime built on top of the FuncScript language. Each drawing is described as a composition of FuncScript expressions that return primitive shapes—circles, lines, polygons, groups, and so on. FuncDraw walks the filesystem, resolves those expressions, and streams the resulting graphics tree to your chosen output format (raw JSON, SVG, PNG).

## FuncScript under the hood

FuncScript is a declarative, functional language optimized for small data transformations. Expressions look like `foo.fx` files that return literal values or calculate new ones through expressions, pipelines, and helper functions.

- **Expressions**: Each `.fx` file is a self-contained expression that returns a value (number, string, list, key/value object, or shape). You can reference other expressions by folder/file name.
- **Functions**: Parentheses/arrow syntax (`(a, b) => { ... }`) builds functions. FuncDraw expressions typically return either a list of shapes or an object describing reusable helpers.
- **Language reference**: See `docs/syntax.md` for operators, functions, conditionals, and collections; this serves as the FuncScript overview.

## Folders, modules, and return.fx

FuncDraw resolves expressions relative to the filesystem. Each folder under the workspace becomes part of the expression namespace:

- `bicycle/frame.fx` is available as `bicycle/frame` from any other expression.
- A folder containing a `return.fx` acts as a module. Invoking the folder name (`bicycle`) runs `return.fx`, which should return an object exposing helpers (e.g., `return { frame, drive }`). Subexpressions in that folder are hidden unless `return.fx` explicitly returns them.
- Plain folders without `return.fx` expose each `.fx` file directly.

## Anatomy of a FuncDraw scene

A typical project wires together multiple expressions:

1. **`model.fx`** – Builds the scene: computes layout, invokes helper modules, returns `{ graphics, metadata }`.
2. **`main.fx`** – Simple entry point returning `model.graphics` so FuncDraw knows what to render.
3. **`view.fx`** – Defines `{ minX, minY, maxX, maxY }` for the viewport.
4. **Modules** – Folders such as `bicycle/`, `background/`, or `lib/` export reusable pieces through their `return.fx`.
5. **Helpers** – Individual expressions (e.g., `road.fx`, `sky.fx`) encapsulate specific drawing routines.

Because every piece is just a FuncScript expression, you can orchestrate complex scenes by composing small, reusable expressions. FuncDraw handles the execution order, turns the final list of shapes into JSON/SVG/PNG, and keeps the render loop declarative and easy to reason about.
