//! FuncScript core runtime (compiler + VM) with optional FFI/WASM bindings.

pub mod chunk;
pub mod compiler;
pub mod ffi;
pub mod native;
pub mod obj;
pub mod scanner;
pub mod value;
pub mod vm;
pub mod wasm;
