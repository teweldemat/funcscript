//! Built-in/native functions for the Rust core runtime.
//!
//! These are registered in the VM global scope (e.g. `Range`, `Len`, `First`, `And`/`Or`/`In`).

use crate::value::Value;
use crate::value::FsError;
use std::rc::Rc;
use crate::obj::Obj;

pub fn define_natives(globals: &mut std::collections::HashMap<String, Value>) {
    globals.insert("Range".to_string(), Value::Obj(Rc::new(Obj::NativeFn(fs_range))));
    globals.insert("true".to_string(), Value::Bool(true));
    globals.insert("false".to_string(), Value::Bool(false));
    
    globals.insert("Abs".to_string(), Value::Obj(Rc::new(Obj::NativeFn(math_abs))));
    globals.insert("Max".to_string(), Value::Obj(Rc::new(Obj::NativeFn(math_max))));
    globals.insert("Min".to_string(), Value::Obj(Rc::new(Obj::NativeFn(math_min))));
    globals.insert("Sqrt".to_string(), Value::Obj(Rc::new(Obj::NativeFn(math_sqrt))));

    globals.insert("Len".to_string(), Value::Obj(Rc::new(Obj::NativeFn(fs_len))));
    globals.insert("First".to_string(), Value::Obj(Rc::new(Obj::NativeFn(fs_first))));

    globals.insert("And".to_string(), Value::Obj(Rc::new(Obj::NativeFn(fs_and))));
    globals.insert("Or".to_string(), Value::Obj(Rc::new(Obj::NativeFn(fs_or))));
    globals.insert("In".to_string(), Value::Obj(Rc::new(Obj::NativeFn(fs_in))));

    globals.insert("TemplateMerge".to_string(), Value::Obj(Rc::new(Obj::NativeFn(fs_template_merge))));
}

fn math_abs(args: &[Value]) -> Value {
    if args.len() != 1 { return Value::Nil; }
    match &args[0] {
        Value::Number(n) => Value::Number(n.abs()),
        _ => Value::Nil,
    }
}

fn math_max(args: &[Value]) -> Value {
    if args.len() != 2 { return Value::Nil; }
    match (&args[0], &args[1]) {
        (Value::Number(a), Value::Number(b)) => Value::Number(a.max(*b)),
        _ => Value::Nil,
    }
}

fn math_min(args: &[Value]) -> Value {
    if args.len() != 2 { return Value::Nil; }
    match (&args[0], &args[1]) {
        (Value::Number(a), Value::Number(b)) => Value::Number(a.min(*b)),
        _ => Value::Nil,
    }
}

fn math_sqrt(args: &[Value]) -> Value {
    if args.len() != 1 { return Value::Nil; }
    match &args[0] {
         Value::Number(n) => Value::Number(n.sqrt()),
         _ => Value::Nil,
    }
}

fn fs_len(args: &[Value]) -> Value {
    if args.len() != 1 { return Value::Nil; }
    if let Value::Error(e) = &args[0] {
        return Value::Error(e.clone());
    }
    match &args[0] {
        Value::Obj(o) => match &**o {
            Obj::String(s) => Value::Number(s.len() as f64),
            Obj::List(l) => Value::Number(l.len() as f64),
            Obj::Range(r) => Value::Number(r.count as f64),
            Obj::Kvc(k) => Value::Number(k.borrow().order.len() as f64),
            _ => Value::Nil,
        },
        _ => Value::Nil,
    }
}

fn fs_first(args: &[Value]) -> Value {
    if args.len() != 1 { return Value::Nil; }
    if let Value::Error(e) = &args[0] {
        return Value::Error(e.clone());
    }
    match &args[0] {
        Value::Obj(o) => match &**o {
             Obj::List(l) => l.first().cloned().unwrap_or(Value::Nil),
             Obj::Range(r) => {
                 if r.count == 0 { Value::Nil } else { Value::Number(r.start as f64) }
             }
             Obj::String(s) => if !s.is_empty() { 
                 Value::Obj(Rc::new(Obj::String(s[0..1].to_string()))) 
             } else { Value::Nil },
             _ => Value::Nil,
        },
        _ => Value::Nil,
    }
}

fn fs_range(args: &[Value]) -> Value {
    if args.len() != 2 { return Value::Nil; } 
    
    let start = match &args[0] {
        Value::Number(n) if n.is_finite() => *n,
        _ => return Value::Nil,
    };
    let count_n = match &args[1] {
        Value::Number(n) if n.is_finite() => *n,
        _ => return Value::Nil,
    };

    if count_n < 0.0 {
        return Value::Error(FsError { code: 1, message: "Range: count must be >= 0".to_string() });
    }
    if count_n > (usize::MAX as f64) {
        return Value::Error(FsError { code: 1, message: "Range: count is out of range".to_string() });
    }

    let count = count_n.trunc() as usize;
    if count == 0 {
        return Value::Obj(Rc::new(Obj::Range(crate::obj::RangeObject { start: 0, count: 0 })));
    }

    if start.fract() != 0.0 {
        return Value::Error(FsError { code: 1, message: "Range: start must be an integer".to_string() });
    }
    if start < (i64::MIN as f64) || start > (i64::MAX as f64) {
        return Value::Error(FsError { code: 1, message: "Range: start is out of range".to_string() });
    }
    let start_i = start as i64;

  
    if let Some(last) = start_i.checked_add((count - 1) as i64) {
    
        const MAX_SAFE_INT: i64 = 9_007_199_254_740_991; // 2^53 - 1
        if start_i.abs() > MAX_SAFE_INT || last.abs() > MAX_SAFE_INT {
            return Value::Error(FsError { code: 1, message: "Range: exceeds f64 safe integer range".to_string() });
        }
        return Value::Obj(Rc::new(Obj::Range(crate::obj::RangeObject { start: start_i, count })));
    }

    Value::Error(FsError { code: 1, message: "Range: overflow".to_string() })
}

fn fs_and(args: &[Value]) -> Value {
    
    let mut has_bool = false;
    for v in args {
        match v {
            Value::Nil => continue,
            Value::Error(e) => return Value::Error(e.clone()),
            Value::Bool(b) => {
                has_bool = true;
                if !*b { return Value::Bool(false); }
            }
            _ => return Value::Error(FsError { code: 2, message: "and doesn't apply to this type".to_string() }),
        }
    }
    if !has_bool { Value::Nil } else { Value::Bool(true) }
}

fn fs_or(args: &[Value]) -> Value {
    
    let mut first_error: Option<FsError> = None;
    let mut has_bool = false;
    for v in args {
        match v {
            Value::Nil => continue,
            Value::Error(e) => {
                if first_error.is_none() {
                    first_error = Some(e.clone());
                }
            }
            Value::Bool(b) => {
                has_bool = true;
                if *b { return Value::Bool(true); }
            }
            _ => return Value::Error(FsError { code: 2, message: "or doesn't apply to this type".to_string() }),
        }
    }
    if let Some(e) = first_error { return Value::Error(e); }
    if !has_bool { Value::Nil } else { Value::Bool(false) }
}

fn fs_in(args: &[Value]) -> Value {
    if args.len() != 2 {
        return Value::Error(FsError { code: 3, message: "in: invalid parameter count".to_string() });
    }
    let needle = &args[0];
    let hay = &args[1];
    if let Value::Error(e) = needle {
        return Value::Error(e.clone());
    }
    if let Value::Error(e) = hay {
        return Value::Error(e.clone());
    }
    if matches!(hay, Value::Nil) {
        return Value::Nil;
    }
  
    if matches!(needle, Value::Nil) {
        return Value::Bool(false);
    }
    let list = match hay {
        Value::Obj(o) => match &**o {
            Obj::List(items) => items,
            Obj::Range(r) => {
               
                let needle_n = match needle {
                    Value::Number(n) => *n,
                    _ => return Value::Bool(false),
                };
                if !needle_n.is_finite() || needle_n.fract() != 0.0 {
                    return Value::Bool(false);
                }
                let needle_i = needle_n as i64;
                if needle_i < r.start || needle_i >= r.start + (r.count as i64) {
                    return Value::Bool(false);
                }
                return Value::Bool(true);
            }
            _ => return Value::Error(FsError { code: 2, message: "in: list expected".to_string() }),
        },
        _ => return Value::Error(FsError { code: 2, message: "in: list expected".to_string() }),
    };
    for v in list.iter() {
        if matches!(v, Value::Nil) {
            continue;
        }
        
        match (needle, v) {
            (Value::Number(a), Value::Number(b)) => if (a - b).abs() < f64::EPSILON { return Value::Bool(true); },
            _ => if needle == v { return Value::Bool(true); },
        }
    }
    Value::Bool(false)
}

fn fs_template_merge(args: &[Value]) -> Value {
    let mut out = String::new();
    for v in args {
        match v {
            Value::Obj(o) => match &**o {
                Obj::String(s) => out.push_str(s),
                _ => out.push_str(&v.to_string()),
            },
            _ => out.push_str(&v.to_string()),
        }
    }
    Value::Obj(Rc::new(Obj::String(out)))
}
