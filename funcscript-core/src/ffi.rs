//! C ABI entrypoints for embedding FuncScript core.

use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_void};
use crate::value::{FsError, Value};
use crate::vm::VM;
use crate::host;
use num_traits::ToPrimitive;

#[repr(C)]
pub struct FsVm {
    inner: VM,
    host: FsHostCallbacksC,
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct FsValue {
    pub id: u64,
}

#[repr(C)]
pub struct FsErrorC {
    pub code: u32,
    pub line: i32,
    pub column: i32,
    pub message: *mut c_char,
}

pub type FsHostWriteFn = Option<extern "C" fn(ctx: *mut c_void, bytes: *const u8, len: u64)>;

#[repr(C)]
#[derive(Clone, Copy)]
pub struct FsHostCallbacksC {
    pub user_data: *mut c_void,
    pub file_read_text: Option<extern "C" fn(user_data: *mut c_void, path: *const c_char, out_ctx: *mut c_void, out_write: FsHostWriteFn, out_error: *mut FsErrorC) -> i32>,
    pub file_exists: Option<extern "C" fn(user_data: *mut c_void, path: *const c_char, out_exists: *mut i32, out_error: *mut FsErrorC) -> i32>,
    pub is_file: Option<extern "C" fn(user_data: *mut c_void, path: *const c_char, out_is_file: *mut i32, out_error: *mut FsErrorC) -> i32>,
    pub dir_list: Option<extern "C" fn(user_data: *mut c_void, path: *const c_char, out_ctx: *mut c_void, out_write: FsHostWriteFn, out_error: *mut FsErrorC) -> i32>,
    pub log_line: Option<extern "C" fn(user_data: *mut c_void, text: *const c_char)>,
}

impl Default for FsHostCallbacksC {
    fn default() -> Self {
        Self { user_data: std::ptr::null_mut(), file_read_text: None, file_exists: None, is_file: None, dir_list: None, log_line: None }
    }
}

#[unsafe(no_mangle)]
pub static FS_CORE_ABI_VERSION: u32 = 3;

#[unsafe(no_mangle)]
pub static FS_VALUE_NIL: u32 = 1;
#[unsafe(no_mangle)]
pub static FS_VALUE_BOOL: u32 = 2;
#[unsafe(no_mangle)]
pub static FS_VALUE_NUMBER: u32 = 3;
#[unsafe(no_mangle)]
pub static FS_VALUE_INT: u32 = 11;
#[unsafe(no_mangle)]
pub static FS_VALUE_BIGINT: u32 = 12;
#[unsafe(no_mangle)]
pub static FS_VALUE_BYTES: u32 = 13;
#[unsafe(no_mangle)]
pub static FS_VALUE_GUID: u32 = 14;
#[unsafe(no_mangle)]
pub static FS_VALUE_DATETIME: u32 = 15;
#[unsafe(no_mangle)]
pub static FS_VALUE_STRING: u32 = 4;
#[unsafe(no_mangle)]
pub static FS_VALUE_LIST: u32 = 5;
#[unsafe(no_mangle)]
pub static FS_VALUE_KVC: u32 = 6;
#[unsafe(no_mangle)]
pub static FS_VALUE_RANGE: u32 = 7;
#[unsafe(no_mangle)]
pub static FS_VALUE_FUNCTION: u32 = 8;
#[unsafe(no_mangle)]
pub static FS_VALUE_NATIVE: u32 = 9;
#[unsafe(no_mangle)]
pub static FS_VALUE_ERROR: u32 = 10;

#[unsafe(no_mangle)]
pub extern "C" fn fs_execute(source: *const c_char) {
    if source.is_null() {
        return;
    }
    let c_str = unsafe { CStr::from_ptr(source) };
    let r_str = c_str.to_str().unwrap_or("");
    let mut vm = VM::new();
    let _ = vm.interpret(r_str);
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
pub extern "C" fn fs_vm_new() -> *mut FsVm {
    Box::into_raw(Box::new(FsVm { inner: VM::new(), host: FsHostCallbacksC::default() }))
}

#[unsafe(no_mangle)]
pub extern "C" fn fs_vm_free(vm: *mut FsVm) {
    if vm.is_null() {
        return;
    }
    unsafe {
        drop(Box::from_raw(vm));
    }
}

fn fs_error_to_c(err: &FsError) -> FsErrorC {
    let msg = CString::new(err.message.clone()).unwrap_or_else(|_| CString::new("error").unwrap());
    FsErrorC {
        code: err.code,
        line: err.line,
        column: err.column,
        message: msg.into_raw(),
    }
}

extern "C" fn fs_host_write_vec(ctx: *mut c_void, bytes: *const u8, len: u64) {
    if ctx.is_null() || bytes.is_null() || len == 0 {
        return;
    }
    unsafe {
        let buf = &mut *(ctx as *mut Vec<u8>);
        let slice = std::slice::from_raw_parts(bytes, len as usize);
        buf.extend_from_slice(slice);
    }
}

fn fs_host_err_to_fs(err: &FsErrorC, fallback_code: u32, fallback_message: &str) -> FsError {
    FsError {
        code: if err.code == 0 { fallback_code } else { err.code },
        message: if err.message.is_null() { fallback_message.to_string() } else {
            
            unsafe { CStr::from_ptr(err.message) }.to_string_lossy().to_string()
        },
        line: if err.line == 0 { -1 } else { err.line },
        column: if err.column == 0 { -1 } else { err.column },
    }
}

fn fs_build_host_callbacks(c: FsHostCallbacksC) -> host::HostCallbacks {
    let user_data = c.user_data as usize;

    host::HostCallbacks {
        file_read_text: c.file_read_text.map(|cb| {
            std::sync::Arc::new(move |path: &str| -> Result<String, FsError> {
                let c_path = CString::new(path).map_err(|_| FsError { code: 2601, message: "file: invalid path".to_string(), line: -1, column: -1 })?;
                let mut out: Vec<u8> = Vec::new();
                let mut err = FsErrorC { code: 0, line: 0, column: 0, message: std::ptr::null_mut() };
                let rc = cb(user_data as *mut c_void, c_path.as_ptr(), (&mut out as *mut Vec<u8>) as *mut c_void, Some(fs_host_write_vec), &mut err as *mut FsErrorC);
                if rc == 0 {
                    String::from_utf8(out).map_err(|_| FsError { code: 2601, message: "file: host returned invalid utf-8".to_string(), line: -1, column: -1 })
                } else {
                    Err(fs_host_err_to_fs(&err, 2601, "file: host error"))
                }
            }) as std::sync::Arc<dyn Fn(&str) -> Result<String, FsError> + Send + Sync>
        }),
        file_exists: c.file_exists.map(|cb| {
            std::sync::Arc::new(move |path: &str| -> Result<bool, FsError> {
                let c_path = CString::new(path).map_err(|_| FsError { code: 2602, message: "fileexists: invalid path".to_string(), line: -1, column: -1 })?;
                let mut out_exists: i32 = 0;
                let mut err = FsErrorC { code: 0, line: 0, column: 0, message: std::ptr::null_mut() };
                let rc = cb(user_data as *mut c_void, c_path.as_ptr(), &mut out_exists as *mut i32, &mut err as *mut FsErrorC);
                if rc == 0 { Ok(out_exists != 0) } else { Err(fs_host_err_to_fs(&err, 2602, "fileexists: host error")) }
            }) as std::sync::Arc<dyn Fn(&str) -> Result<bool, FsError> + Send + Sync>
        }),
        is_file: c.is_file.map(|cb| {
            std::sync::Arc::new(move |path: &str| -> Result<bool, FsError> {
                let c_path = CString::new(path).map_err(|_| FsError { code: 2603, message: "isfile: invalid path".to_string(), line: -1, column: -1 })?;
                let mut out_is_file: i32 = 0;
                let mut err = FsErrorC { code: 0, line: 0, column: 0, message: std::ptr::null_mut() };
                let rc = cb(user_data as *mut c_void, c_path.as_ptr(), &mut out_is_file as *mut i32, &mut err as *mut FsErrorC);
                if rc == 0 { Ok(out_is_file != 0) } else { Err(fs_host_err_to_fs(&err, 2603, "isfile: host error")) }
            }) as std::sync::Arc<dyn Fn(&str) -> Result<bool, FsError> + Send + Sync>
        }),
        dir_list: c.dir_list.map(|cb| {
            std::sync::Arc::new(move |path: &str| -> Result<Vec<String>, FsError> {
                let c_path = CString::new(path).map_err(|_| FsError { code: 2604, message: "dirlist: invalid path".to_string(), line: -1, column: -1 })?;
                let mut out: Vec<u8> = Vec::new();
                let mut err = FsErrorC { code: 0, line: 0, column: 0, message: std::ptr::null_mut() };
                let rc = cb(user_data as *mut c_void, c_path.as_ptr(), (&mut out as *mut Vec<u8>) as *mut c_void, Some(fs_host_write_vec), &mut err as *mut FsErrorC);
                if rc != 0 {
                    return Err(fs_host_err_to_fs(&err, 2604, "dirlist: host error"));
                }
                let s = String::from_utf8(out).map_err(|_| FsError { code: 2604, message: "dirlist: host returned invalid utf-8".to_string(), line: -1, column: -1 })?;
                let items = s.split('\n').filter(|x| !x.is_empty()).map(|x| x.to_string()).collect();
                Ok(items)
            }) as std::sync::Arc<dyn Fn(&str) -> Result<Vec<String>, FsError> + Send + Sync>
        }),
        log_line: c.log_line.map(|cb| {
            std::sync::Arc::new(move |text: &str| {
                if let Ok(c_text) = CString::new(text) {
                    cb(user_data as *mut c_void, c_text.as_ptr());
                }
            }) as std::sync::Arc<dyn Fn(&str) + Send + Sync>
        }),
    }
}

fn fs_with_host<T>(host_c: FsHostCallbacksC, f: impl FnOnce() -> T) -> T {
    let callbacks = fs_build_host_callbacks(host_c);
    let _g = host::push(callbacks);
    f()
}

#[unsafe(no_mangle)]
pub extern "C" fn fs_vm_set_host_callbacks(vm: *mut FsVm, callbacks: *const FsHostCallbacksC) -> i32 {
    if vm.is_null() {
        return 1;
    }
    unsafe {
        let vm_ref = &mut *vm;
        vm_ref.host = if callbacks.is_null() { FsHostCallbacksC::default() } else { *callbacks };
    }
    0
}

fn fs_json_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    for ch in s.chars() {
        match ch {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if c.is_control() => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out
}

#[unsafe(no_mangle)]
pub extern "C" fn fs_error_free(err: *mut FsErrorC) {
    if err.is_null() {
        return;
    }
    unsafe {
        if !(*err).message.is_null() {
            fs_free_string((*err).message);
            (*err).message = std::ptr::null_mut();
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn fs_vm_eval(
    vm: *mut FsVm,
    source: *const c_char,
    out_json: *mut *mut c_char,
    out_error: *mut FsErrorC,
) -> i32 {
    if out_json.is_null() || out_error.is_null() {
        return 2;
    }
    unsafe {
        *out_json = std::ptr::null_mut();
        (*out_error).code = 0;
        (*out_error).line = 0;
        (*out_error).column = 0;
        (*out_error).message = std::ptr::null_mut();
    }

    if vm.is_null() {
        let err = FsError { code: 2001, message: "vm is null".to_string(), line: -1, column: -1 };
        unsafe { *out_error = fs_error_to_c(&err); }
        return 1;
    }
    if source.is_null() {
        let err = FsError { code: 2002, message: "source is null".to_string(), line: -1, column: -1 };
        unsafe { *out_error = fs_error_to_c(&err); }
        return 1;
    }

    let c_str = unsafe { CStr::from_ptr(source) };
    let r_str = match c_str.to_str() {
        Ok(s) => s,
        Err(_) => {
            let err = FsError { code: 2003, message: "source is not valid UTF-8".to_string(), line: -1, column: -1 };
            unsafe { *out_error = fs_error_to_c(&err); }
            return 1;
        }
    };

    let vm_box = unsafe { &mut (*vm) };
    let host_c = vm_box.host;
    let vm_inner = &mut vm_box.inner;
    let res = fs_with_host(host_c, || vm_inner.interpret(r_str));
    match res {
        Ok(Value::Error(e)) => {
            unsafe { *out_error = fs_error_to_c(&e); }
            1
        }
        Ok(v) => {
            let json = vm_inner.value_to_json_string(&v);
            let s = CString::new(json).unwrap_or_else(|_| CString::new("null").unwrap());
            unsafe { *out_json = s.into_raw(); }
            0
        }
        Err(e) => {
            let err = match e {
                crate::vm::InterpretResult::CompileError(err) => err,
                crate::vm::InterpretResult::RuntimeError(err) => err,
            };
            unsafe { *out_error = fs_error_to_c(&err); }
            1
        }
    }
}

fn fs_reset_out_error(out_error: *mut FsErrorC) {
    unsafe {
        (*out_error).code = 0;
        (*out_error).line = 0;
        (*out_error).column = 0;
        (*out_error).message = std::ptr::null_mut();
    }
}

fn fs_set_error(out_error: *mut FsErrorC, err: &FsError) {
    unsafe { *out_error = fs_error_to_c(err); }
}

fn fs_read_source(source: *const c_char, out_error: *mut FsErrorC) -> Option<&'static str> {
    if source.is_null() {
        let err = FsError { code: 2002, message: "source is null".to_string(), line: -1, column: -1 };
        fs_set_error(out_error, &err);
        return None;
    }
    let c_str = unsafe { CStr::from_ptr(source) };
    match c_str.to_str() {
        Ok(s) => Some(unsafe { std::mem::transmute::<&str, &'static str>(s) }),
        Err(_) => {
            let err = FsError { code: 2003, message: "source is not valid UTF-8".to_string(), line: -1, column: -1 };
            fs_set_error(out_error, &err);
            None
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn fs_vm_eval_value(
    vm: *mut FsVm,
    source: *const c_char,
    out_value: *mut FsValue,
    out_error: *mut FsErrorC,
) -> i32 {
    if out_value.is_null() || out_error.is_null() {
        return 2;
    }
    unsafe { (*out_value).id = 0; }
    fs_reset_out_error(out_error);

    if vm.is_null() {
        let err = FsError { code: 2001, message: "vm is null".to_string(), line: -1, column: -1 };
        fs_set_error(out_error, &err);
        return 1;
    }
    let src = match fs_read_source(source, out_error) {
        Some(s) => s,
        None => return 1,
    };

    let vm_box = unsafe { &mut (*vm) };
    let host_c = vm_box.host;
    let vm_inner = &mut vm_box.inner;
    let res = fs_with_host(host_c, || vm_inner.interpret(src));
    match res {
        Ok(Value::Error(e)) => {
            fs_set_error(out_error, &e);
            1
        }
        Ok(v) => {
            let id = vm_inner.store_value(v);
            unsafe { (*out_value).id = id; }
            0
        }
        Err(e) => {
            let err = match e {
                crate::vm::InterpretResult::CompileError(err) => err,
                crate::vm::InterpretResult::RuntimeError(err) => err,
            };
            fs_set_error(out_error, &err);
            1
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn fs_vm_value_free(vm: *mut FsVm, value: FsValue) -> i32 {
    if vm.is_null() {
        return 1;
    }
    let vm = unsafe { &mut (*vm).inner };
    if vm.free_value(value.id) { 0 } else { 2 }
}

#[unsafe(no_mangle)]
pub extern "C" fn fs_vm_value_type(vm: *mut FsVm, value: FsValue) -> u32 {
    if vm.is_null() {
        return 0;
    }
    let vm = unsafe { &mut (*vm).inner };
    let v = match vm.get_value(value.id) {
        Some(v) => v,
        None => return 0,
    };
    match v {
        Value::Nil => FS_VALUE_NIL,
        Value::Bool(_) => FS_VALUE_BOOL,
        Value::Number(_) => FS_VALUE_NUMBER,
        Value::Int(_) => FS_VALUE_INT,
        Value::BigInt(_) => FS_VALUE_BIGINT,
        Value::Error(_) => FS_VALUE_ERROR,
        Value::Obj(o) => match &**o {
            crate::obj::Obj::String(_) => FS_VALUE_STRING,
            crate::obj::Obj::List(_) => FS_VALUE_LIST,
            crate::obj::Obj::Kvc(_) => FS_VALUE_KVC,
            crate::obj::Obj::Range(_) => FS_VALUE_RANGE,
            crate::obj::Obj::Bytes(_) => FS_VALUE_BYTES,
            crate::obj::Obj::Guid(_) => FS_VALUE_GUID,
            crate::obj::Obj::DateTimeTicks(_) => FS_VALUE_DATETIME,
            crate::obj::Obj::Function(_) => FS_VALUE_FUNCTION,
            crate::obj::Obj::NativeFn(_) => FS_VALUE_NATIVE,
            crate::obj::Obj::Provider(_) => FS_VALUE_KVC,
        },
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn fs_vm_value_to_json(
    vm: *mut FsVm,
    value: FsValue,
    out_json: *mut *mut c_char,
    out_error: *mut FsErrorC,
) -> i32 {
    if out_json.is_null() || out_error.is_null() {
        return 2;
    }
    unsafe { *out_json = std::ptr::null_mut(); }
    fs_reset_out_error(out_error);

    if vm.is_null() {
        let err = FsError { code: 2001, message: "vm is null".to_string(), line: -1, column: -1 };
        fs_set_error(out_error, &err);
        return 1;
    }
    let vm = unsafe { &mut (*vm).inner };
    let v = match vm.get_value(value.id) {
        Some(v) => v.clone(),
        None => {
            let err = FsError { code: 2006, message: "invalid value handle".to_string(), line: -1, column: -1 };
            fs_set_error(out_error, &err);
            return 1;
        }
    };
    let json = vm.value_to_json_string(&v);
    let s = CString::new(json).unwrap_or_else(|_| CString::new("null").unwrap());
    unsafe { *out_json = s.into_raw(); }
    0
}

#[unsafe(no_mangle)]
pub extern "C" fn fs_vm_value_range_info(
    vm: *mut FsVm,
    value: FsValue,
    out_start: *mut i64,
    out_count: *mut u64,
    out_error: *mut FsErrorC,
) -> i32 {
    if out_start.is_null() || out_count.is_null() || out_error.is_null() {
        return 2;
    }
    unsafe {
        *out_start = 0;
        *out_count = 0;
    }
    fs_reset_out_error(out_error);
    if vm.is_null() {
        let err = FsError { code: 2001, message: "vm is null".to_string(), line: -1, column: -1 };
        fs_set_error(out_error, &err);
        return 1;
    }
    let vm = unsafe { &mut (*vm).inner };
    let v = match vm.get_value(value.id) {
        Some(v) => v,
        None => {
            let err = FsError { code: 2006, message: "invalid value handle".to_string(), line: -1, column: -1 };
            fs_set_error(out_error, &err);
            return 1;
        }
    };
    match v {
        Value::Obj(o) => match &**o {
            crate::obj::Obj::Range(r) => {
                unsafe {
                    *out_start = r.start;
                    *out_count = r.count as u64;
                }
                0
            }
            _ => {
                let err = FsError { code: 2007, message: "value is not a range".to_string(), line: -1, column: -1 };
                fs_set_error(out_error, &err);
                1
            }
        },
        _ => {
            let err = FsError { code: 2007, message: "value is not a range".to_string(), line: -1, column: -1 };
            fs_set_error(out_error, &err);
            1
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn fs_vm_value_len(
    vm: *mut FsVm,
    value: FsValue,
    out_len: *mut u64,
    out_error: *mut FsErrorC,
) -> i32 {
    if out_len.is_null() || out_error.is_null() {
        return 2;
    }
    unsafe { *out_len = 0; }
    fs_reset_out_error(out_error);
    if vm.is_null() {
        let err = FsError { code: 2001, message: "vm is null".to_string(), line: -1, column: -1 };
        fs_set_error(out_error, &err);
        return 1;
    }
    let vm = unsafe { &mut (*vm).inner };
    let v = match vm.get_value(value.id) {
        Some(v) => v.clone(),
        None => {
            let err = FsError { code: 2006, message: "invalid value handle".to_string(), line: -1, column: -1 };
            fs_set_error(out_error, &err);
            return 1;
        }
    };
    match vm.value_len(&v) {
        Value::Int(n) if n >= 0 => {
            unsafe { *out_len = n as u64; }
            0
        }
        Value::Number(n) if n.is_finite() && n.fract() == 0.0 && n >= 0.0 => {
            unsafe { *out_len = n as u64; }
            0
        }
        Value::BigInt(n) => match n.to_u64() {
            Some(u) => {
                unsafe { *out_len = u; }
                0
            }
            None => {
                let err = FsError { code: 2008, message: "len result is out of range".to_string(), line: -1, column: -1 };
                fs_set_error(out_error, &err);
                1
            }
        },
        Value::Error(e) => {
            fs_set_error(out_error, &e);
            1
        }
        _ => {
            let err = FsError { code: 2008, message: "len not supported for this value".to_string(), line: -1, column: -1 };
            fs_set_error(out_error, &err);
            1
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn fs_vm_value_index(
    vm: *mut FsVm,
    receiver: FsValue,
    index: i64,
    out_value: *mut FsValue,
    out_error: *mut FsErrorC,
) -> i32 {
    if out_value.is_null() || out_error.is_null() {
        return 2;
    }
    unsafe { (*out_value).id = 0; }
    fs_reset_out_error(out_error);
    if vm.is_null() {
        let err = FsError { code: 2001, message: "vm is null".to_string(), line: -1, column: -1 };
        fs_set_error(out_error, &err);
        return 1;
    }
    let vm = unsafe { &mut (*vm).inner };
    let recv = match vm.get_value(receiver.id) {
        Some(v) => v.clone(),
        None => {
            let err = FsError { code: 2006, message: "invalid value handle".to_string(), line: -1, column: -1 };
            fs_set_error(out_error, &err);
            return 1;
        }
    };
    let v = vm.value_index(&recv, index);
    if let Value::Error(e) = &v {
        fs_set_error(out_error, e);
        return 1;
    }
    let id = vm.store_value(v);
    unsafe { (*out_value).id = id; }
    0
}

#[unsafe(no_mangle)]
pub extern "C" fn fs_vm_value_get_key(
    vm: *mut FsVm,
    receiver: FsValue,
    key: *const c_char,
    out_value: *mut FsValue,
    out_error: *mut FsErrorC,
) -> i32 {
    if out_value.is_null() || out_error.is_null() {
        return 2;
    }
    unsafe { (*out_value).id = 0; }
    fs_reset_out_error(out_error);
    if vm.is_null() {
        let err = FsError { code: 2001, message: "vm is null".to_string(), line: -1, column: -1 };
        fs_set_error(out_error, &err);
        return 1;
    }
    if key.is_null() {
        let err = FsError { code: 2009, message: "key is null".to_string(), line: -1, column: -1 };
        fs_set_error(out_error, &err);
        return 1;
    }
    let key_c = unsafe { CStr::from_ptr(key) };
    let key_s = match key_c.to_str() {
        Ok(s) => s,
        Err(_) => {
            let err = FsError { code: 2010, message: "key is not valid UTF-8".to_string(), line: -1, column: -1 };
            fs_set_error(out_error, &err);
            return 1;
        }
    };
    let vm = unsafe { &mut (*vm).inner };
    let recv = match vm.get_value(receiver.id) {
        Some(v) => v.clone(),
        None => {
            let err = FsError { code: 2006, message: "invalid value handle".to_string(), line: -1, column: -1 };
            fs_set_error(out_error, &err);
            return 1;
        }
    };
    let v = vm.value_get_prop(&recv, key_s);
    if let Value::Error(e) = &v {
        fs_set_error(out_error, e);
        return 1;
    }
    let id = vm.store_value(v);
    unsafe { (*out_value).id = id; }
    0
}

#[unsafe(no_mangle)]
pub extern "C" fn fs_vm_value_keys_json(
    vm: *mut FsVm,
    receiver: FsValue,
    out_json: *mut *mut c_char,
    out_error: *mut FsErrorC,
) -> i32 {
    if out_json.is_null() || out_error.is_null() {
        return 2;
    }
    unsafe { *out_json = std::ptr::null_mut(); }
    fs_reset_out_error(out_error);
    if vm.is_null() {
        let err = FsError { code: 2001, message: "vm is null".to_string(), line: -1, column: -1 };
        fs_set_error(out_error, &err);
        return 1;
    }
    let vm = unsafe { &mut (*vm).inner };
    let recv = match vm.get_value(receiver.id) {
        Some(v) => v.clone(),
        None => {
            let err = FsError { code: 2006, message: "invalid value handle".to_string(), line: -1, column: -1 };
            fs_set_error(out_error, &err);
            return 1;
        }
    };
    let keys = match recv {
        Value::Obj(o) => match &*o {
            crate::obj::Obj::Kvc(k) => vm.kvc_keys(std::rc::Rc::clone(k)),
            crate::obj::Obj::Provider(p) => match &p.current {
                Value::Obj(o2) => match &**o2 {
                    crate::obj::Obj::Kvc(k) => vm.kvc_keys(std::rc::Rc::clone(k)),
                    _ => Vec::new(),
                },
                _ => Vec::new(),
            },
            _ => Vec::new(),
        },
        _ => Vec::new(),
    };
    let json_parts: Vec<String> = keys
        .into_iter()
        .map(|s| format!("\"{}\"", fs_json_escape(&s)))
        .collect();
    let json = format!("[{}]", json_parts.join(","));
    let s = CString::new(json).unwrap_or_else(|_| CString::new("[]").unwrap());
    unsafe { *out_json = s.into_raw(); }
    0
}

#[unsafe(no_mangle)]
pub extern "C" fn fs_vm_value_call(
    vm: *mut FsVm,
    callee: FsValue,
    argc: u64,
    argv: *const FsValue,
    out_value: *mut FsValue,
    out_error: *mut FsErrorC,
) -> i32 {
    if out_value.is_null() || out_error.is_null() {
        return 2;
    }
    unsafe { (*out_value).id = 0; }
    fs_reset_out_error(out_error);
    if vm.is_null() {
        let err = FsError { code: 2001, message: "vm is null".to_string(), line: -1, column: -1 };
        fs_set_error(out_error, &err);
        return 1;
    }
    if argc > 0 && argv.is_null() {
        let err = FsError { code: 2011, message: "argv is null".to_string(), line: -1, column: -1 };
        fs_set_error(out_error, &err);
        return 1;
    }
    let vm_box = unsafe { &mut (*vm) };
    let host_c = vm_box.host;
    let vm = &mut vm_box.inner;
    let callee_v = match vm.get_value(callee.id) {
        Some(v) => v.clone(),
        None => {
            let err = FsError { code: 2006, message: "invalid value handle".to_string(), line: -1, column: -1 };
            fs_set_error(out_error, &err);
            return 1;
        }
    };
    let mut args: Vec<Value> = Vec::with_capacity(argc as usize);
    if argc > 0 {
        let slice = unsafe { std::slice::from_raw_parts(argv, argc as usize) };
        for a in slice {
            match vm.get_value(a.id) {
                Some(v) => args.push(v.clone()),
                None => {
                    let err = FsError { code: 2006, message: "invalid value handle".to_string(), line: -1, column: -1 };
                    fs_set_error(out_error, &err);
                    return 1;
                }
            }
        }
    }
    let res = fs_with_host(host_c, || vm.call_value_direct(callee_v, args));
    match res {
        Ok(Value::Error(e)) => {
            fs_set_error(out_error, &e);
            1
        }
        Ok(v) => {
            let id = vm.store_value(v);
            unsafe { (*out_value).id = id; }
            0
        }
        Err(e) => {
            let err = match e {
                crate::vm::InterpretResult::CompileError(err) => err,
                crate::vm::InterpretResult::RuntimeError(err) => err,
            };
            fs_set_error(out_error, &err);
            1
        }
    }
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
