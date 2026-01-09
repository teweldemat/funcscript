//! WASM bindings for FuncScript core.

use wasm_bindgen::prelude::*;
use crate::vm::VM;


#[wasm_bindgen]
pub fn fs_eval_wasm(source: &str) -> String {
    let mut vm = VM::new();
    vm.eval_result_json(source)
}
