use std::ffi::{CStr, CString};
use std::ptr;

use funcscript_core::ffi::{
    fs_error_free, fs_free_string, fs_vm_eval, fs_vm_eval_value, fs_vm_free, fs_vm_new, fs_vm_value_call,
    fs_vm_value_free, fs_vm_value_to_json, FsErrorC, FsValue,
};

#[test]
fn c_abi_vm_reuse_and_ok_json() {
    let vm = fs_vm_new();
    assert!(!vm.is_null());

    let src = CString::new("1+2").unwrap();
    let mut out_json: *mut i8 = ptr::null_mut();
    let mut out_err = FsErrorC { code: 0, line: 0, column: 0, message: ptr::null_mut() };

    let rc = fs_vm_eval(vm, src.as_ptr(), &mut out_json, &mut out_err);
    assert_eq!(rc, 0);
    assert!(!out_json.is_null());
    assert_eq!(out_err.code, 0);

    let got = unsafe { CStr::from_ptr(out_json) }.to_str().unwrap().to_string();
    fs_free_string(out_json);
    assert_eq!(got, "3");

    fs_error_free(&mut out_err);
    fs_vm_free(vm);
}

#[test]
fn c_abi_compile_error_has_location() {
    let vm = fs_vm_new();
    let src = CString::new("If(true, 1, )").unwrap();
    let mut out_json: *mut i8 = ptr::null_mut();
    let mut out_err = FsErrorC { code: 0, line: 0, column: 0, message: ptr::null_mut() };

    let rc = fs_vm_eval(vm, src.as_ptr(), &mut out_json, &mut out_err);
    assert_eq!(rc, 1);
    assert!(out_json.is_null());
    assert_eq!(out_err.code, 1000);
    assert_eq!(out_err.line, 1);
    assert!(out_err.column >= 1);
    assert!(!out_err.message.is_null());

    fs_error_free(&mut out_err);
    fs_vm_free(vm);
}

#[test]
fn c_abi_value_error_returns_error() {
    let vm = fs_vm_new();
    let src = CString::new("Range(1, -1)").unwrap();
    let mut out_json: *mut i8 = ptr::null_mut();
    let mut out_err = FsErrorC { code: 0, line: 0, column: 0, message: ptr::null_mut() };

    let rc = fs_vm_eval(vm, src.as_ptr(), &mut out_json, &mut out_err);
    assert_eq!(rc, 1);
    assert!(out_json.is_null());
    assert_eq!(out_err.code, 1);
    assert!(!out_err.message.is_null());

    fs_error_free(&mut out_err);
    fs_vm_free(vm);
}

#[test]
fn c_abi_null_vm_returns_error() {
    let src = CString::new("1+2").unwrap();
    let mut out_json: *mut i8 = ptr::null_mut();
    let mut out_err = FsErrorC { code: 0, line: 0, column: 0, message: ptr::null_mut() };

    let rc = fs_vm_eval(ptr::null_mut(), src.as_ptr(), &mut out_json, &mut out_err);
    assert_eq!(rc, 1);
    assert!(out_json.is_null());
    assert_eq!(out_err.code, 2001);
    assert!(!out_err.message.is_null());

    fs_error_free(&mut out_err);
}

#[test]
fn c_abi_arity_mismatch_returns_runtime_error_with_message() {
    let vm = fs_vm_new();
    let src = CString::new("((x)=>x)(1,2)").unwrap();
    let mut out_json: *mut i8 = ptr::null_mut();
    let mut out_err = FsErrorC { code: 0, line: 0, column: 0, message: ptr::null_mut() };

    let rc = fs_vm_eval(vm, src.as_ptr(), &mut out_json, &mut out_err);
    assert_eq!(rc, 1);
    assert!(out_json.is_null());
    assert_eq!(out_err.code, 2004);
    assert!(!out_err.message.is_null());

    fs_error_free(&mut out_err);
    fs_vm_free(vm);
}

#[test]
fn c_abi_value_handles_can_call_returned_function() {
    let vm = fs_vm_new();
    assert!(!vm.is_null());

    let src_fn = CString::new("(x)=>x+1").unwrap();
    let mut out_fn = FsValue { id: 0 };
    let mut out_err = FsErrorC { code: 0, line: 0, column: 0, message: ptr::null_mut() };
    let rc = fs_vm_eval_value(vm, src_fn.as_ptr(), &mut out_fn, &mut out_err);
    assert_eq!(rc, 0);
    assert!(out_fn.id != 0);

    let src_arg = CString::new("2").unwrap();
    let mut out_arg = FsValue { id: 0 };
    let rc = fs_vm_eval_value(vm, src_arg.as_ptr(), &mut out_arg, &mut out_err);
    assert_eq!(rc, 0);
    assert!(out_arg.id != 0);

    let argv = [out_arg];
    let mut out_res = FsValue { id: 0 };
    let rc = fs_vm_value_call(vm, out_fn, 1, argv.as_ptr(), &mut out_res, &mut out_err);
    assert_eq!(rc, 0);
    assert!(out_res.id != 0);

    let mut out_json: *mut i8 = ptr::null_mut();
    let rc = fs_vm_value_to_json(vm, out_res, &mut out_json, &mut out_err);
    assert_eq!(rc, 0);
    assert!(!out_json.is_null());
    let got = unsafe { CStr::from_ptr(out_json) }.to_str().unwrap().to_string();
    fs_free_string(out_json);
    assert_eq!(got, "3");

    assert_eq!(fs_vm_value_free(vm, out_res), 0);
    assert_eq!(fs_vm_value_free(vm, out_arg), 0);
    assert_eq!(fs_vm_value_free(vm, out_fn), 0);

    fs_error_free(&mut out_err);
    fs_vm_free(vm);
}
