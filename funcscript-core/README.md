# funcscript-core

Rust implementation of the **FuncScript** runtime (VM + standard library), designed to be **universal** and **language-independent**.

This crate provides:
- A Rust library (`rlib`) for embedding
- A C ABI (`cdylib`) for foreign language bindings (see `include/funcscript.h`)
- A CLI binary named `funcscript`

## Install (CLI)

```bash
cargo install funcscript
```

Then run:

```bash
funcscript 'Sum(Range(1, 1000000000))'
```

## Use as a library

If you're embedding in Rust, add the crate as a dependency and use the VM/compiler APIs from `src/` (these are still evolving while parity work continues).

## C ABI / Embedding notes

The C header lives at `include/funcscript.h`.

For portability/universal embedding, OS/file APIs and logging are expected to be provided by the host via callbacks (see `FsHostCallbacks` in the header).

