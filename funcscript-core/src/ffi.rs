//! C ABI entrypoints for embedding FuncScript core.

use std::ffi::{CStr, CString};
use std::os::raw::{c_char};
use crate::vm::VM;

#[unsafe(no_mangle)]
pub extern "C" fn fs_execute(source: *const c_char) {
    let c_str = unsafe { CStr::from_ptr(source) };
    let r_str = c_str.to_str().unwrap();

    let mut vm = VM::new();
    match vm.interpret(r_str) {
        Ok(value) => println!("{}", value),
        Err(_) => eprintln!("Error executing script."),
    }
}


#[unsafe(no_mangle)]
pub extern "C" fn fs_eval_json(source: *const c_char) -> *mut c_char {
    let c_str = unsafe { CStr::from_ptr(source) };
    let r_str = c_str.to_str().unwrap_or("");

    let mut vm = VM::new();
    let json = vm.eval_result_json(r_str);
    CString::new(json).unwrap().into_raw()
}

#[unsafe(no_mangle)]
pub extern "C" fn fs_free_string(ptr: *mut c_char) {
    if ptr.is_null() {
        return;
    }
    unsafe {
        let _ = CString::from_raw(ptr);
    }
}
