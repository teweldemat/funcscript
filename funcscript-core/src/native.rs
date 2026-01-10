//! Built-in/native functions for the Rust core runtime.
//!
//! These are registered in the VM global scope (e.g. `Range`, `Len`, `First`, `And`/`Or`/`In`).

use crate::value::Value;
use crate::value::FsError;
use std::rc::Rc;
use crate::obj::Obj;
use num_bigint::BigInt;
use num_traits::{Signed, ToPrimitive, Zero};
use base64::{engine::general_purpose, Engine as _};
use uuid::Uuid;
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use crate::obj::KvcObject;
use regex::Regex;
use crate::host;

pub fn define_natives(globals: &mut std::collections::HashMap<String, Value>) {
    let mut insert = |name: &str, v: Value| {
        globals.insert(name.to_ascii_lowercase(), v);
    };

    insert("Range", Value::Obj(Rc::new(Obj::NativeFn(fs_range))));
    insert("true", Value::Bool(true));
    insert("false", Value::Bool(false));
    
    insert("Abs", Value::Obj(Rc::new(Obj::NativeFn(math_abs))));
    insert("Max", Value::Obj(Rc::new(Obj::NativeFn(math_max))));
    insert("Min", Value::Obj(Rc::new(Obj::NativeFn(math_min))));
    insert("Sqrt", Value::Obj(Rc::new(Obj::NativeFn(math_sqrt))));

    insert("Len", Value::Obj(Rc::new(Obj::NativeFn(fs_len))));
    insert("First", Value::Obj(Rc::new(Obj::NativeFn(fs_first))));

    insert("And", Value::Obj(Rc::new(Obj::NativeFn(fs_and))));
    insert("Or", Value::Obj(Rc::new(Obj::NativeFn(fs_or))));
    insert("In", Value::Obj(Rc::new(Obj::NativeFn(fs_in))));

    insert("TemplateMerge", Value::Obj(Rc::new(Obj::NativeFn(fs_template_merge))));

    insert("Sum", Value::Obj(Rc::new(Obj::NativeFn(fs_sum))));
    insert("SumApprox", Value::Obj(Rc::new(Obj::NativeFn(fs_sum_approx))));

    insert("Date", Value::Obj(Rc::new(Obj::NativeFn(fs_date))));
    insert("TicksToDate", Value::Obj(Rc::new(Obj::NativeFn(fs_ticks_to_date))));
    insert("guid", Value::Obj(Rc::new(Obj::NativeFn(fs_guid))));
    insert("ChangeType", Value::Obj(Rc::new(Obj::NativeFn(fs_change_type))));

    insert("lower", Value::Obj(Rc::new(Obj::NativeFn(text_lower))));
    insert("upper", Value::Obj(Rc::new(Obj::NativeFn(text_upper))));
    insert("endswith", Value::Obj(Rc::new(Obj::NativeFn(text_endswith))));
    insert("substring", Value::Obj(Rc::new(Obj::NativeFn(text_substring))));
    insert("find", Value::Obj(Rc::new(Obj::NativeFn(text_find))));
    insert("isBlank", Value::Obj(Rc::new(Obj::NativeFn(text_is_blank))));
    insert("join", Value::Obj(Rc::new(Obj::NativeFn(text_join))));

    insert("Take", Value::Obj(Rc::new(Obj::NativeFn(list_take))));
    insert("Skip", Value::Obj(Rc::new(Obj::NativeFn(list_skip))));
    insert("Reverse", Value::Obj(Rc::new(Obj::NativeFn(list_reverse))));
    insert("Distinct", Value::Obj(Rc::new(Obj::NativeFn(list_distinct))));
    insert("Contains", Value::Obj(Rc::new(Obj::NativeFn(list_contains))));

    // Provider collections (C# parity): `math.*`, `text.*`, `float.*`
    insert("math", build_math_provider());
    insert("text", build_text_provider());
    insert("float", build_float_provider());

    // Common math globals (C# function names)
    insert("Pow", Value::Obj(Rc::new(Obj::NativeFn(math_pow))));
    insert("Sin", Value::Obj(Rc::new(Obj::NativeFn(math_sin))));
    insert("Cos", Value::Obj(Rc::new(Obj::NativeFn(math_cos))));
    insert("Tan", Value::Obj(Rc::new(Obj::NativeFn(math_tan))));
    insert("Asin", Value::Obj(Rc::new(Obj::NativeFn(math_asin))));
    insert("Acos", Value::Obj(Rc::new(Obj::NativeFn(math_acos))));
    insert("Atan", Value::Obj(Rc::new(Obj::NativeFn(math_atan))));
    insert("Atan2", Value::Obj(Rc::new(Obj::NativeFn(math_atan2))));
    insert("Exp", Value::Obj(Rc::new(Obj::NativeFn(math_exp))));
    insert("Ln", Value::Obj(Rc::new(Obj::NativeFn(math_ln))));
    insert("Log10", Value::Obj(Rc::new(Obj::NativeFn(math_log10))));
    insert("Log2", Value::Obj(Rc::new(Obj::NativeFn(math_log2))));
    insert("Ceiling", Value::Obj(Rc::new(Obj::NativeFn(math_ceil))));
    insert("Floor", Value::Obj(Rc::new(Obj::NativeFn(math_floor))));
    insert("Round", Value::Obj(Rc::new(Obj::NativeFn(math_round))));
    insert("Trunc", Value::Obj(Rc::new(Obj::NativeFn(math_trunc))));
    insert("Sign", Value::Obj(Rc::new(Obj::NativeFn(math_sign))));
    insert("Clamp", Value::Obj(Rc::new(Obj::NativeFn(math_clamp))));
    insert("Random", Value::Obj(Rc::new(Obj::NativeFn(math_random))));
    insert("Cbrt", Value::Obj(Rc::new(Obj::NativeFn(math_cbrt))));
    insert("DegToRad", Value::Obj(Rc::new(Obj::NativeFn(math_deg_to_rad))));
    insert("RadToDeg", Value::Obj(Rc::new(Obj::NativeFn(math_rad_to_deg))));

    insert("IsNaN", Value::Obj(Rc::new(Obj::NativeFn(float_is_nan))));
    insert("IsInfinity", Value::Obj(Rc::new(Obj::NativeFn(float_is_infinity))));
    insert("IsNormal", Value::Obj(Rc::new(Obj::NativeFn(float_is_normal))));

    // Remaining C# built-ins
    insert("regex", Value::Obj(Rc::new(Obj::NativeFn(text_regex))));
    insert("parse", Value::Obj(Rc::new(Obj::NativeFn(text_parse))));
    insert("format", Value::Obj(Rc::new(Obj::NativeFn(text_format))));
    insert("_templatemerge", Value::Obj(Rc::new(Obj::NativeFn(text_templatemerge))));
    insert("HEncode", Value::Obj(Rc::new(Obj::NativeFn(html_encode))));

    insert("error", Value::Obj(Rc::new(Obj::NativeFn(misc_error))));
    insert("log", Value::Obj(Rc::new(Obj::NativeFn(misc_log))));

    insert("file", Value::Obj(Rc::new(Obj::NativeFn(os_file_text))));
    insert("fileexists", Value::Obj(Rc::new(Obj::NativeFn(os_file_exists))));
    insert("isfile", Value::Obj(Rc::new(Obj::NativeFn(os_is_file))));
    insert("dirlist", Value::Obj(Rc::new(Obj::NativeFn(os_dir_list))));
}

fn kvc_from_cache(display_names_in_order: Vec<(&str, Value)>) -> Value {
    let mut cache: HashMap<String, Value> = HashMap::new();
    let mut order: Vec<String> = Vec::with_capacity(display_names_in_order.len());
    let mut display_names: HashMap<String, String> = HashMap::new();
    for (display, v) in display_names_in_order {
        let key_l = display.to_lowercase();
        cache.insert(key_l.clone(), v);
        order.push(key_l.clone());
        display_names.insert(key_l, display.to_string());
    }
    let kvc = KvcObject {
        entries: HashMap::new(),
        cache,
        evaluating: HashSet::new(),
        parent: None,
        order,
        display_names,
    };
    Value::Obj(Rc::new(Obj::Kvc(Rc::new(RefCell::new(kvc)))))
}

fn build_math_provider() -> Value {
    kvc_from_cache(vec![
        ("Pi", Value::Number(std::f64::consts::PI)),
        ("E", Value::Number(std::f64::consts::E)),

        ("Abs", Value::Obj(Rc::new(Obj::NativeFn(math_abs)))),
        ("Min", Value::Obj(Rc::new(Obj::NativeFn(math_min)))),
        ("Max", Value::Obj(Rc::new(Obj::NativeFn(math_max)))),
        ("Sqrt", Value::Obj(Rc::new(Obj::NativeFn(math_sqrt)))),
        ("Pow", Value::Obj(Rc::new(Obj::NativeFn(math_pow)))),

        ("Sin", Value::Obj(Rc::new(Obj::NativeFn(math_sin)))),
        ("Cos", Value::Obj(Rc::new(Obj::NativeFn(math_cos)))),
        ("Tan", Value::Obj(Rc::new(Obj::NativeFn(math_tan)))),
        ("Asin", Value::Obj(Rc::new(Obj::NativeFn(math_asin)))),
        ("Acos", Value::Obj(Rc::new(Obj::NativeFn(math_acos)))),
        ("Atan", Value::Obj(Rc::new(Obj::NativeFn(math_atan)))),
        ("Atan2", Value::Obj(Rc::new(Obj::NativeFn(math_atan2)))),

        ("Exp", Value::Obj(Rc::new(Obj::NativeFn(math_exp)))),
        ("Ln", Value::Obj(Rc::new(Obj::NativeFn(math_ln)))),
        ("Log10", Value::Obj(Rc::new(Obj::NativeFn(math_log10)))),
        ("Log2", Value::Obj(Rc::new(Obj::NativeFn(math_log2)))),

        ("Ceiling", Value::Obj(Rc::new(Obj::NativeFn(math_ceil)))),
        ("Floor", Value::Obj(Rc::new(Obj::NativeFn(math_floor)))),
        ("Round", Value::Obj(Rc::new(Obj::NativeFn(math_round)))),
        ("Trunc", Value::Obj(Rc::new(Obj::NativeFn(math_trunc)))),
        ("Sign", Value::Obj(Rc::new(Obj::NativeFn(math_sign)))),
        ("Clamp", Value::Obj(Rc::new(Obj::NativeFn(math_clamp)))),

        ("Random", Value::Obj(Rc::new(Obj::NativeFn(math_random)))),
        ("Cbrt", Value::Obj(Rc::new(Obj::NativeFn(math_cbrt)))),
        ("DegToRad", Value::Obj(Rc::new(Obj::NativeFn(math_deg_to_rad)))),
        ("RadToDeg", Value::Obj(Rc::new(Obj::NativeFn(math_rad_to_deg)))),
    ])
}

fn build_text_provider() -> Value {
    kvc_from_cache(vec![
        ("lower", Value::Obj(Rc::new(Obj::NativeFn(text_lower)))),
        ("upper", Value::Obj(Rc::new(Obj::NativeFn(text_upper)))),
        ("endswith", Value::Obj(Rc::new(Obj::NativeFn(text_endswith)))),
        ("substring", Value::Obj(Rc::new(Obj::NativeFn(text_substring)))),
        ("find", Value::Obj(Rc::new(Obj::NativeFn(text_find)))),
        ("isBlank", Value::Obj(Rc::new(Obj::NativeFn(text_is_blank)))),
        ("join", Value::Obj(Rc::new(Obj::NativeFn(text_join)))),
        ("regex", Value::Obj(Rc::new(Obj::NativeFn(text_regex)))),
        ("parse", Value::Obj(Rc::new(Obj::NativeFn(text_parse)))),
        ("format", Value::Obj(Rc::new(Obj::NativeFn(text_format)))),
        ("_templatemerge", Value::Obj(Rc::new(Obj::NativeFn(text_templatemerge)))),
    ])
}

fn build_float_provider() -> Value {
    kvc_from_cache(vec![
        ("IsNormal", Value::Obj(Rc::new(Obj::NativeFn(float_is_normal)))),
        ("IsNaN", Value::Obj(Rc::new(Obj::NativeFn(float_is_nan)))),
        ("IsInfinity", Value::Obj(Rc::new(Obj::NativeFn(float_is_infinity)))),
    ])
}

fn math_abs(args: &[Value]) -> Value {
    if args.len() != 1 { return Value::Nil; }
    match &args[0] {
        Value::Number(n) => Value::Number(n.abs()),
        Value::Int(n) => match n.checked_abs() {
            Some(v) => Value::Int(v),
            None => Value::BigInt(BigInt::from(*n).abs()),
        },
        Value::BigInt(n) => Value::BigInt(n.abs()),
        _ => Value::Nil,
    }
}

fn math_max(args: &[Value]) -> Value {
    if args.len() != 2 { return Value::Nil; }
    match (&args[0], &args[1]) {
        (Value::Number(a), Value::Number(b)) => Value::Number(a.max(*b)),
        (a, b) => {
            let ai = match a {
                Value::Int(n) => Some(BigInt::from(*n)),
                Value::BigInt(n) => Some(n.clone()),
                _ => None,
            };
            let bi = match b {
                Value::Int(n) => Some(BigInt::from(*n)),
                Value::BigInt(n) => Some(n.clone()),
                _ => None,
            };
            if let (Some(ai), Some(bi)) = (ai, bi) {
                let m = if ai >= bi { ai } else { bi };
                if let Some(v) = m.to_i64() { Value::Int(v) } else { Value::BigInt(m) }
            } else {
                Value::Nil
            }
        }
    }
}

fn math_min(args: &[Value]) -> Value {
    if args.len() != 2 { return Value::Nil; }
    match (&args[0], &args[1]) {
        (Value::Number(a), Value::Number(b)) => Value::Number(a.min(*b)),
        (a, b) => {
            let ai = match a {
                Value::Int(n) => Some(BigInt::from(*n)),
                Value::BigInt(n) => Some(n.clone()),
                _ => None,
            };
            let bi = match b {
                Value::Int(n) => Some(BigInt::from(*n)),
                Value::BigInt(n) => Some(n.clone()),
                _ => None,
            };
            if let (Some(ai), Some(bi)) = (ai, bi) {
                let m = if ai <= bi { ai } else { bi };
                if let Some(v) = m.to_i64() { Value::Int(v) } else { Value::BigInt(m) }
            } else {
                Value::Nil
            }
        }
    }
}

fn math_sqrt(args: &[Value]) -> Value {
    if args.len() != 1 { return Value::Nil; }
    match &args[0] {
         Value::Number(n) => Value::Number(n.sqrt()),
         Value::Int(n) => Value::Number((*n as f64).sqrt()),
         Value::BigInt(n) => match n.to_f64() {
             Some(x) => Value::Number(x.sqrt()),
             None => Value::Nil,
         },
         _ => Value::Nil,
    }
}

fn math_num1(args: &[Value], name: &str) -> Result<f64, Value> {
    if args.len() != 1 {
        return Err(Value::Error(FsError { code: 1, message: format!("{name}: number expected"), line: -1, column: -1 }));
    }
    match &args[0] {
        Value::Error(e) => Err(Value::Error(e.clone())),
        Value::Int(n) => Ok(*n as f64),
        Value::BigInt(n) => n.to_f64().ok_or_else(|| Value::Error(FsError { code: 1, message: format!("{name}: number out of range"), line: -1, column: -1 })),
        Value::Number(n) if n.is_finite() => Ok(*n),
        _ => Err(Value::Error(FsError { code: 2, message: format!("{name}: number expected"), line: -1, column: -1 })),
    }
}

fn math_num2(args: &[Value], name: &str) -> Result<(f64, f64), Value> {
    if args.len() != 2 {
        return Err(Value::Error(FsError { code: 1, message: format!("{name}: Expected 2 parameters"), line: -1, column: -1 }));
    }
    let a = math_num1(&args[0..1], name)?;
    let b = math_num1(&args[1..2], name)?;
    Ok((a, b))
}

fn math_pow(args: &[Value]) -> Value {
    match math_num2(args, "Pow") {
        Ok((a, b)) => Value::Number(a.powf(b)),
        Err(e) => e,
    }
}

fn math_sin(args: &[Value]) -> Value { math_num1(args, "Sin").map(|n| Value::Number(n.sin())).unwrap_or_else(|e| e) }
fn math_cos(args: &[Value]) -> Value { math_num1(args, "Cos").map(|n| Value::Number(n.cos())).unwrap_or_else(|e| e) }
fn math_tan(args: &[Value]) -> Value { math_num1(args, "Tan").map(|n| Value::Number(n.tan())).unwrap_or_else(|e| e) }
fn math_asin(args: &[Value]) -> Value { math_num1(args, "Asin").map(|n| Value::Number(n.asin())).unwrap_or_else(|e| e) }
fn math_acos(args: &[Value]) -> Value { math_num1(args, "Acos").map(|n| Value::Number(n.acos())).unwrap_or_else(|e| e) }
fn math_atan(args: &[Value]) -> Value { math_num1(args, "Atan").map(|n| Value::Number(n.atan())).unwrap_or_else(|e| e) }
fn math_atan2(args: &[Value]) -> Value {
    match math_num2(args, "Atan2") {
        Ok((y, x)) => Value::Number(y.atan2(x)),
        Err(e) => e,
    }
}

fn math_exp(args: &[Value]) -> Value { math_num1(args, "Exp").map(|n| Value::Number(n.exp())).unwrap_or_else(|e| e) }

fn math_ln(args: &[Value]) -> Value {
    if args.is_empty() || args.len() > 2 {
        return Value::Error(FsError { code: 1, message: "Ln: Expecting 1 or 2 parameters".to_string(), line: -1, column: -1 });
    }
    let v = match math_num1(&args[0..1], "Ln") {
        Ok(v) => v,
        Err(e) => return e,
    };
    if v <= 0.0 {
        return Value::Error(FsError { code: 2, message: "Ln: value must be greater than 0.".to_string(), line: -1, column: -1 });
    }
    if args.len() == 1 {
        return Value::Number(v.ln());
    }
    let base = match math_num1(&args[1..2], "Ln") {
        Ok(v) => v,
        Err(e) => return e,
    };
    if base <= 0.0 || (base - 1.0).abs() < f64::EPSILON {
        return Value::Error(FsError { code: 2, message: "Ln: base must be greater than 0 and not equal to 1.".to_string(), line: -1, column: -1 });
    }
    Value::Number(v.log(base))
}

fn math_log10(args: &[Value]) -> Value {
    match math_num1(args, "Log10") {
        Ok(v) if v > 0.0 => Value::Number(v.log10()),
        Ok(_) => Value::Error(FsError { code: 2, message: "Log10: value must be greater than 0.".to_string(), line: -1, column: -1 }),
        Err(e) => e,
    }
}

fn math_log2(args: &[Value]) -> Value {
    match math_num1(args, "Log2") {
        Ok(v) if v > 0.0 => Value::Number(v.log2()),
        Ok(_) => Value::Error(FsError { code: 2, message: "Log2: value must be greater than 0.".to_string(), line: -1, column: -1 }),
        Err(e) => e,
    }
}

fn math_ceil(args: &[Value]) -> Value { math_num1(args, "Ceiling").map(|n| Value::Number(n.ceil())).unwrap_or_else(|e| e) }
fn math_floor(args: &[Value]) -> Value { math_num1(args, "Floor").map(|n| Value::Number(n.floor())).unwrap_or_else(|e| e) }
fn math_round(args: &[Value]) -> Value { math_num1(args, "Round").map(|n| Value::Number(n.round())).unwrap_or_else(|e| e) }
fn math_trunc(args: &[Value]) -> Value { math_num1(args, "Trunc").map(|n| Value::Number(n.trunc())).unwrap_or_else(|e| e) }
fn math_sign(args: &[Value]) -> Value { math_num1(args, "Sign").map(|n| Value::Int(n.signum() as i64)).unwrap_or_else(|e| e) }

fn math_clamp(args: &[Value]) -> Value {
    if args.len() != 3 {
        return Value::Error(FsError { code: 1, message: "Clamp: Expected 3 parameters".to_string(), line: -1, column: -1 });
    }
    let x = match math_num1(&args[0..1], "Clamp") { Ok(v) => v, Err(e) => return e };
    let lo = match math_num1(&args[1..2], "Clamp") { Ok(v) => v, Err(e) => return e };
    let hi = match math_num1(&args[2..3], "Clamp") { Ok(v) => v, Err(e) => return e };
    Value::Number(x.clamp(lo, hi))
}

fn math_random(args: &[Value]) -> Value {
    // Deterministic seed → [0,1)
    let seed = match args.get(0) {
        None => 0.0,
        Some(v) => match math_num1(std::slice::from_ref(v), "Random") {
            Ok(x) => x,
            Err(e) => return e,
        },
    };
    let mut x = seed.to_bits() ^ 0x9E37_79B9_7F4A_7C15u64;
    x ^= x >> 12;
    x ^= x << 25;
    x ^= x >> 27;
    let y = x.wrapping_mul(0x2545_F491_4F6C_DD1D);
    let u = (y >> 11) as f64 / ((1u64 << 53) as f64);
    Value::Number(u)
}

fn math_cbrt(args: &[Value]) -> Value { math_num1(args, "Cbrt").map(|n| Value::Number(n.cbrt())).unwrap_or_else(|e| e) }
fn math_deg_to_rad(args: &[Value]) -> Value { math_num1(args, "DegToRad").map(|n| Value::Number(n.to_radians())).unwrap_or_else(|e| e) }
fn math_rad_to_deg(args: &[Value]) -> Value { math_num1(args, "RadToDeg").map(|n| Value::Number(n.to_degrees())).unwrap_or_else(|e| e) }

fn float_is_nan(args: &[Value]) -> Value { math_num1(args, "IsNaN").map(|n| Value::Bool(n.is_nan())).unwrap_or_else(|e| e) }
fn float_is_infinity(args: &[Value]) -> Value { math_num1(args, "IsInfinity").map(|n| Value::Bool(n.is_infinite())).unwrap_or_else(|e| e) }
fn float_is_normal(args: &[Value]) -> Value { math_num1(args, "IsNormal").map(|n| Value::Bool(n.is_normal())).unwrap_or_else(|e| e) }

fn text_regex(args: &[Value]) -> Value {
    if args.len() < 2 || args.len() > 3 {
        return Value::Error(FsError { code: 1, message: "regex: two or three parameters expected".to_string(), line: -1, column: -1 });
    }
    let text = match &args[0] {
        Value::Error(e) => return Value::Error(e.clone()),
        Value::Obj(o) => match &**o {
            Obj::String(s) => s.clone(),
            _ => return Value::Error(FsError { code: 2, message: "regex: text parameter must be string".to_string(), line: -1, column: -1 }),
        },
        _ => return Value::Error(FsError { code: 2, message: "regex: text parameter must be string".to_string(), line: -1, column: -1 }),
    };
    let pattern = match &args[1] {
        Value::Error(e) => return Value::Error(e.clone()),
        Value::Obj(o) => match &**o {
            Obj::String(s) => s.clone(),
            _ => return Value::Error(FsError { code: 2, message: "regex: pattern parameter must be string".to_string(), line: -1, column: -1 }),
        },
        _ => return Value::Error(FsError { code: 2, message: "regex: pattern parameter must be string".to_string(), line: -1, column: -1 }),
    };
    let flags = if args.len() == 3 {
        match &args[2] {
            Value::Nil => None,
            Value::Error(e) => return Value::Error(e.clone()),
            Value::Obj(o) => match &**o {
                Obj::String(s) => Some(s.clone()),
                _ => return Value::Error(FsError { code: 2, message: "regex: flags parameter must be string".to_string(), line: -1, column: -1 }),
            },
            _ => return Value::Error(FsError { code: 2, message: "regex: flags parameter must be string".to_string(), line: -1, column: -1 }),
        }
    } else {
        None
    };

    let mut prefix = String::new();
    if let Some(f) = flags {
        for ch in f.chars() {
            if ch.is_whitespace() || ch == ',' || ch == '|' { continue; }
            match ch.to_ascii_lowercase() {
                'i' => prefix.push_str("(?i)"),
                'm' => prefix.push_str("(?m)"),
                's' => prefix.push_str("(?s)"),
                'x' => prefix.push_str("(?x)"),
                other => {
                    return Value::Error(FsError { code: 1, message: format!("regex: unsupported regex option '{other}'"), line: -1, column: -1 });
                }
            }
        }
    }

    let pat = format!("{prefix}{pattern}");
    match Regex::new(&pat) {
        Ok(re) => Value::Bool(re.is_match(&text)),
        Err(e) => Value::Error(FsError { code: 1, message: format!("regex: invalid pattern: {e}"), line: -1, column: -1 }),
    }
}

fn text_parse(args: &[Value]) -> Value {
    if args.is_empty() {
        return Value::Error(FsError { code: 1, message: "parse requires at least one parameter".to_string(), line: -1, column: -1 });
    }
    if let Value::Error(e) = &args[0] { return Value::Error(e.clone()); }
    if matches!(args[0], Value::Nil) { return Value::Nil; }
    let s = args[0].to_string();
    let fmt = if args.len() > 1 {
        if let Value::Error(e) = &args[1] { return Value::Error(e.clone()); }
        if matches!(args[1], Value::Nil) { None } else { Some(args[1].to_string()) }
    } else {
        None
    };
    let fmt = fmt.unwrap_or_default();
    if fmt.trim().is_empty() {
        return Value::Obj(Rc::new(Obj::String(s)));
    }
    match fmt.to_lowercase().as_str() {
        "hex" => {
            let t = s.trim();
            let t = t.strip_prefix("0x").unwrap_or(t);
            match i64::from_str_radix(t, 16) {
                Ok(v) => Value::Int(v),
                Err(_) => Value::Error(FsError { code: 1, message: "parse: invalid hex".to_string(), line: -1, column: -1 }),
            }
        }
        "l" => match s.trim().parse::<i64>() {
            Ok(v) => Value::Int(v),
            Err(_) => Value::Error(FsError { code: 1, message: "parse: invalid int64".to_string(), line: -1, column: -1 }),
        },
        "fs" => {
            let mut vm = crate::vm::VM::new();
            match vm.interpret(&s) {
                Ok(v) => v,
                Err(e) => {
                    let err = match e {
                        crate::vm::InterpretResult::CompileError(err) => err,
                        crate::vm::InterpretResult::RuntimeError(err) => err,
                    };
                    Value::Error(err)
                }
            }
        }
        _ => Value::Obj(Rc::new(Obj::String(s))),
    }
}

fn text_format(args: &[Value]) -> Value {
    if args.is_empty() {
        return Value::Error(FsError { code: 1, message: "format requires at least one parameter.".to_string(), line: -1, column: -1 });
    }
    let value = &args[0];
    if let Value::Error(e) = value { return Value::Error(e.clone()); }
    let fmt = if args.len() > 1 {
        if let Value::Error(e) = &args[1] { return Value::Error(e.clone()); }
        match &args[1] {
            Value::Nil => None,
            Value::Obj(o) => match &**o {
                Obj::String(s) => Some(s.clone()),
                _ => Some(args[1].to_string()),
            },
            _ => Some(args[1].to_string()),
        }
    } else {
        None
    };
    if let Some(f) = fmt {
        if f.eq_ignore_ascii_case("json") {
            // Best-effort JSON formatting (does not force-evaluate lazy KVC entries).
            let json = format_json_value(value);
            return Value::Obj(Rc::new(Obj::String(json)));
        }
        // For now, non-json uses Display formatting (Rust core doesn't implement .NET format patterns yet).
    }
    Value::Obj(Rc::new(Obj::String(value.to_string())))
}

fn format_json_escape(s: &str) -> String {
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

fn format_json_value(v: &Value) -> String {
    match v {
        Value::Nil => "null".to_string(),
        Value::Bool(b) => if *b { "true".to_string() } else { "false".to_string() },
        Value::Int(n) => n.to_string(),
        Value::BigInt(n) => n.to_string(),
        Value::Number(n) => if n.is_finite() { n.to_string() } else { "null".to_string() },
        Value::Error(e) => format!("{{\"kind\":\"value\",\"code\":{},\"message\":\"{}\",\"line\":{},\"column\":{}}}",
            e.code, format_json_escape(&e.message), e.line, e.column),
        Value::Obj(o) => match &**o {
            Obj::String(s) => format!("\"{}\"", format_json_escape(s)),
            Obj::List(items) => {
                let parts: Vec<String> = items.iter().map(format_json_value).collect();
                format!("[{}]", parts.join(","))
            }
            Obj::Range(r) => format!("{{\"type\":\"range\",\"start\":{},\"count\":{}}}", r.start, r.count),
            Obj::Bytes(b) => format!("{{\"type\":\"bytes\",\"base64\":\"{}\"}}", format_json_escape(&general_purpose::STANDARD.encode(b))),
            Obj::Guid(g) => format!("{{\"type\":\"guid\",\"value\":\"{}\"}}", format_json_escape(&g.to_string())),
            Obj::DateTimeTicks(t) => format!("{{\"type\":\"datetime\",\"ticks\":{}}}", t),
            Obj::Kvc(k) => {
                let b = k.borrow();
                let mut parts: Vec<String> = Vec::new();
                for key_l in b.order.iter() {
                    let display = b.display_names.get(key_l).cloned().unwrap_or_else(|| key_l.clone());
                    let val = b.cache.get(key_l).cloned().unwrap_or(Value::Nil);
                    parts.push(format!("\"{}\":{}", format_json_escape(&display), format_json_value(&val)));
                }
                format!("{{{}}}", parts.join(","))
            }
            Obj::Provider(p) => format_json_value(&p.current),
            Obj::Function(f) => format!("{{\"type\":\"function\",\"name\":\"{}\",\"arity\":{}}}", format_json_escape(&f.name), f.arity),
            Obj::NativeFn(_) => "{\"type\":\"native\"}".to_string(),
        }
    }
}

fn text_templatemerge(args: &[Value]) -> Value {
    fn push_val(out: &mut String, v: &Value) {
        match v {
            Value::Nil => {}
            Value::Obj(o) => match &**o {
                Obj::List(items) => for it in items { push_val(out, it); }
                Obj::Range(r) => for i in 0..r.count { out.push_str(&(r.start + i as i64).to_string()); }
                Obj::String(s) => out.push_str(s),
                _ => out.push_str(&v.to_string()),
            },
            _ => out.push_str(&v.to_string()),
        }
    }
    let mut out = String::new();
    for v in args {
        if let Value::Error(e) = v { return Value::Error(e.clone()); }
        push_val(&mut out, v);
    }
    Value::Obj(Rc::new(Obj::String(out)))
}

fn html_encode(args: &[Value]) -> Value {
    if args.is_empty() { return Value::Nil; }
    if let Value::Error(e) = &args[0] { return Value::Error(e.clone()); }
    if matches!(args[0], Value::Nil) { return Value::Nil; }
    let s = args[0].to_string();
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(ch),
        }
    }
    Value::Obj(Rc::new(Obj::String(out)))
}

fn misc_error(args: &[Value]) -> Value {
    if args.is_empty() || args.len() > 2 {
        return Value::Error(FsError { code: 1, message: "error: message and optional type expected".to_string(), line: -1, column: -1 });
    }
    let msg = match &args[0] {
        Value::Error(e) => return Value::Error(e.clone()),
        Value::Obj(o) => match &**o {
            Obj::String(s) => s.clone(),
            _ => return Value::Error(FsError { code: 2, message: "error: message must be a string".to_string(), line: -1, column: -1 }),
        },
        _ => return Value::Error(FsError { code: 2, message: "error: message must be a string".to_string(), line: -1, column: -1 }),
    };
    let typ = if args.len() == 2 {
        match &args[1] {
            Value::Nil => None,
            Value::Error(e) => return Value::Error(e.clone()),
            Value::Obj(o) => match &**o {
                Obj::String(s) => Some(s.clone()),
                _ => return Value::Error(FsError { code: 2, message: "error: optional type must be a string".to_string(), line: -1, column: -1 }),
            },
            _ => return Value::Error(FsError { code: 2, message: "error: optional type must be a string".to_string(), line: -1, column: -1 }),
        }
    } else { None };
    let message = if let Some(t) = typ { format!("{t}: {msg}") } else { msg };
    Value::Error(FsError { code: 3000, message, line: -1, column: -1 })
}

fn misc_log(args: &[Value]) -> Value {
    if args.is_empty() {
        return Value::Error(FsError { code: 1, message: "log: value expected".to_string(), line: -1, column: -1 });
    }
    if args.len() > 2 {
        return Value::Error(FsError { code: 1, message: "log: invalid parameter count".to_string(), line: -1, column: -1 });
    }
    if let Value::Error(e) = &args[0] { return Value::Error(e.clone()); }
    if args.len() == 1 {
        host::log_line(&format_json_value(&args[0]));
        return args[0].clone();
    }
    if let Value::Error(e) = &args[1] { return Value::Error(e.clone()); }
    match &args[1] {
        Value::Obj(o) => match &**o {
            Obj::Function(_) | Obj::NativeFn(_) => {
                host::log_line("<handler>");
            }
            _ => host::log_line(&args[1].to_string()),
        },
        _ => host::log_line(&args[1].to_string()),
    }
    args[0].clone()
}

fn os_file_text(args: &[Value]) -> Value {
    if args.len() != 1 {
        return Value::Error(FsError { code: 1, message: "file: invalid parameter count. 1 expected".to_string(), line: -1, column: -1 });
    }
    if let Value::Error(e) = &args[0] { return Value::Error(e.clone()); }
    if matches!(args[0], Value::Nil) { return Value::Nil; }
    let path = match &args[0] {
        Value::Obj(o) => match &**o {
            Obj::String(s) => s.clone(),
            _ => return Value::Error(FsError { code: 2, message: "file: expected string".to_string(), line: -1, column: -1 }),
        },
        _ => return Value::Error(FsError { code: 2, message: "file: expected string".to_string(), line: -1, column: -1 }),
    };
    match host::file_read_text(&path) {
        Ok(s) => Value::Obj(Rc::new(Obj::String(s))),
        Err(e) => Value::Error(e),
    }
}

fn os_file_exists(args: &[Value]) -> Value {
    if args.len() != 1 {
        return Value::Error(FsError { code: 1, message: "fileexists: invalid parameter count. 1 expected".to_string(), line: -1, column: -1 });
    }
    let path = match &args[0] {
        Value::Obj(o) => match &**o {
            Obj::String(s) => s.as_str(),
            _ => return Value::Error(FsError { code: 2, message: "fileexists: expected a string".to_string(), line: -1, column: -1 }),
        },
        _ => return Value::Error(FsError { code: 2, message: "fileexists: expected a string".to_string(), line: -1, column: -1 }),
    };
    match host::file_exists(path) {
        Ok(b) => Value::Bool(b),
        Err(e) => Value::Error(e),
    }
}

fn os_is_file(args: &[Value]) -> Value {
    if args.len() != 1 {
        return Value::Error(FsError { code: 1, message: "isfile: invalid parameter count. 1 expected".to_string(), line: -1, column: -1 });
    }
    let path = match &args[0] {
        Value::Obj(o) => match &**o {
            Obj::String(s) => s.as_str(),
            _ => return Value::Error(FsError { code: 2, message: "isfile: expected a string".to_string(), line: -1, column: -1 }),
        },
        _ => return Value::Error(FsError { code: 2, message: "isfile: expected a string".to_string(), line: -1, column: -1 }),
    };
    match host::is_file(path) {
        Ok(b) => Value::Bool(b),
        Err(e) => Value::Error(e),
    }
}

fn os_dir_list(args: &[Value]) -> Value {
    if args.len() != 1 {
        return Value::Error(FsError { code: 1, message: "dirlist: invalid parameter count. 1 expected".to_string(), line: -1, column: -1 });
    }
    let path = match &args[0] {
        Value::Obj(o) => match &**o {
            Obj::String(s) => s.clone(),
            _ => return Value::Error(FsError { code: 2, message: "dirlist: expected a string".to_string(), line: -1, column: -1 }),
        },
        _ => return Value::Error(FsError { code: 2, message: "dirlist: expected a string".to_string(), line: -1, column: -1 }),
    };
    match host::dir_list(&path) {
        Ok(entries) => {
            let out: Vec<Value> = entries.into_iter().map(|s| Value::Obj(Rc::new(Obj::String(s)))).collect();
            Value::Obj(Rc::new(Obj::List(out)))
        }
        Err(e) => Value::Error(e),
    }
}

fn fs_len(args: &[Value]) -> Value {
    if args.len() != 1 { return Value::Nil; }
    if let Value::Error(e) = &args[0] {
        return Value::Error(e.clone());
    }
    match &args[0] {
        Value::Obj(o) => match &**o {
            Obj::String(s) => Value::Int(s.len() as i64),
            Obj::List(l) => Value::Int(l.len() as i64),
            Obj::Range(r) => Value::Int(r.count as i64),
            Obj::Bytes(b) => Value::Int(b.len() as i64),
            Obj::Kvc(k) => Value::Int(k.borrow().order.len() as i64),
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
                 if r.count == 0 { Value::Nil } else { Value::Int(r.start) }
             }
             Obj::Bytes(b) => {
                 if b.is_empty() { Value::Nil } else { Value::Int(b[0] as i64) }
             }
             Obj::String(s) => if !s.is_empty() { 
                 Value::Obj(Rc::new(Obj::String(s[0..1].to_string()))) 
             } else { Value::Nil },
             _ => Value::Nil,
        },
        _ => Value::Nil,
    }
}

fn as_i64_exact(v: &Value) -> Option<i64> {
    match v {
        Value::Int(n) => Some(*n),
        Value::Number(n)
            if n.is_finite()
                && n.fract() == 0.0
                && *n >= (i64::MIN as f64)
                && *n <= (i64::MAX as f64) =>
        {
            Some(*n as i64)
        }
        Value::BigInt(n) => n.to_i64(),
        _ => None,
    }
}

fn as_usize_exact(v: &Value) -> Option<usize> {
    match v {
        Value::Int(n) if *n >= 0 => (*n as u64).try_into().ok(),
        Value::Number(n)
            if n.is_finite() && n.fract() == 0.0 && *n >= 0.0 && *n <= (usize::MAX as f64) =>
        {
            Some(*n as usize)
        }
        Value::BigInt(n) => n.to_u64().and_then(|u| u.try_into().ok()),
        _ => None,
    }
}

fn fs_range(args: &[Value]) -> Value {
    if args.len() != 2 { return Value::Nil; } 
    let start_i = match as_i64_exact(&args[0]) {
        Some(n) => n,
        None => return Value::Nil,
    };
    if matches!(&args[1], Value::Int(n) if *n < 0)
        || matches!(&args[1], Value::Number(n) if n.is_finite() && *n < 0.0)
        || matches!(&args[1], Value::BigInt(n) if n.sign() == num_bigint::Sign::Minus)
    {
        return Value::Error(FsError { code: 1, message: "Range: count must be >= 0".to_string(), line: -1, column: -1 });
    }
    let count = match as_usize_exact(&args[1]) {
        Some(n) => n,
        None => return Value::Nil,
    };

    if count == 0 {
        return Value::Obj(Rc::new(Obj::Range(crate::obj::RangeObject { start: start_i, count: 0 })));
    }

    if start_i.checked_add((count - 1) as i64).is_none() {
        return Value::Error(FsError { code: 1, message: "Range: overflow".to_string(), line: -1, column: -1 });
    }

    Value::Obj(Rc::new(Obj::Range(crate::obj::RangeObject { start: start_i, count })))
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
            _ => return Value::Error(FsError { code: 2, message: "and doesn't apply to this type".to_string(), line: -1, column: -1 }),
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
            _ => return Value::Error(FsError { code: 2, message: "or doesn't apply to this type".to_string(), line: -1, column: -1 }),
        }
    }
    if let Some(e) = first_error { return Value::Error(e); }
    if !has_bool { Value::Nil } else { Value::Bool(false) }
}

fn fs_in(args: &[Value]) -> Value {
    if args.len() != 2 {
        return Value::Error(FsError { code: 3, message: "in: invalid parameter count".to_string(), line: -1, column: -1 });
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
               
                let needle_i = match as_i64_exact(needle) {
                    Some(n) => n,
                    None => return Value::Bool(false),
                };
                if needle_i < r.start || needle_i >= r.start + (r.count as i64) {
                    return Value::Bool(false);
                }
                return Value::Bool(true);
            }
            _ => return Value::Error(FsError { code: 2, message: "in: list expected".to_string(), line: -1, column: -1 }),
        },
        _ => return Value::Error(FsError { code: 2, message: "in: list expected".to_string(), line: -1, column: -1 }),
    };
    for v in list.iter() {
        if matches!(v, Value::Nil) {
            continue;
        }
        
        if needle == v { return Value::Bool(true); }
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

fn fs_sum(args: &[Value]) -> Value {
    if args.len() != 1 {
        return Value::Nil;
    }
    if let Value::Error(e) = &args[0] {
        return Value::Error(e.clone());
    }
    if matches!(args[0], Value::Nil) {
        return Value::Nil;
    }

    fn err(msg: &str) -> Value {
        Value::Error(FsError { code: 4, message: msg.to_string(), line: -1, column: -1 })
    }

    match &args[0] {
        Value::Obj(o) => match &**o {
            Obj::Range(r) => {
                if r.count == 0 {
                    return Value::Int(0);
                }
                let n = BigInt::from(r.count as u64);
                let a0 = BigInt::from(r.start);
                let a_last = BigInt::from(r.start + (r.count as i64) - 1);
                let sum = (n.clone() * (a0 + a_last)) / BigInt::from(2);
                if let Some(v) = sum.to_i64() { Value::Int(v) } else { Value::BigInt(sum) }
            }
            Obj::List(items) => {
                let mut sum_i = BigInt::from(0);
                let mut sum_f: Option<f64> = None;
                for v in items.iter() {
                    match v {
                        Value::Int(n) => {
                            if let Some(sf) = sum_f.as_mut() {
                                *sf += *n as f64;
                            } else {
                                sum_i += BigInt::from(*n);
                            }
                        }
                        Value::BigInt(n) => {
                            if let Some(sf) = sum_f.as_mut() {
                                let nf = match n.to_f64() {
                                    Some(x) => x,
                                    None => return err("Sum: bigint too large for float sum"),
                                };
                                *sf += nf;
                            } else {
                                sum_i += n.clone();
                            }
                        }
                        Value::Number(n) if n.is_finite() => {
                            let mut sf = sum_f.unwrap_or_else(|| sum_i.to_f64().unwrap_or(0.0));
                            sf += *n;
                            sum_f = Some(sf);
                        }
                        Value::Nil => {}
                        Value::Error(e) => return Value::Error(e.clone()),
                        _ => return err("Sum: expects list/range of numbers"),
                    }
                }
                if let Some(sf) = sum_f {
                    Value::Number(sf)
                } else if let Some(v) = sum_i.to_i64() {
                    Value::Int(v)
                } else {
                    Value::BigInt(sum_i)
                }
            }
            _ => Value::Nil,
        },
        _ => Value::Nil,
    }
}

fn fs_sum_approx(args: &[Value]) -> Value {
    if args.len() != 1 {
        return Value::Nil;
    }
    if let Value::Error(e) = &args[0] {
        return Value::Error(e.clone());
    }
    if matches!(args[0], Value::Nil) {
        return Value::Nil;
    }

    match &args[0] {
        Value::Obj(o) => match &**o {
            Obj::Range(r) => {
                let n = r.count as f64;
                if n == 0.0 {
                    return Value::Number(0.0);
                }
                let a0 = r.start as f64;
                let a_last = a0 + (n - 1.0);
                Value::Number(n * (a0 + a_last) / 2.0)
            }
            Obj::List(items) => {
                let mut sum = 0.0f64;
                for v in items.iter() {
                    match v {
                        Value::Int(n) => sum += *n as f64,
                        Value::BigInt(n) => {
                            let nf = match n.to_f64() {
                                Some(x) => x,
                                None => return Value::Error(FsError { code: 4, message: "SumApprox: bigint too large".to_string(), line: -1, column: -1 }),
                            };
                            sum += nf;
                        }
                        Value::Number(n) if n.is_finite() => sum += *n,
                        Value::Nil => {}
                        Value::Error(e) => return Value::Error(e.clone()),
                        _ => return Value::Error(FsError { code: 4, message: "SumApprox: expects list/range of numbers".to_string(), line: -1, column: -1 }),
                    }
                }
                Value::Number(sum)
            }
            _ => Value::Nil,
        },
        _ => Value::Nil,
    }
}

fn fs_guid(args: &[Value]) -> Value {
    if args.len() != 1 { return Value::Nil; }
    if let Value::Error(e) = &args[0] { return Value::Error(e.clone()); }
    if matches!(args[0], Value::Nil) { return Value::Nil; }
    let s = match &args[0] {
        Value::Obj(o) => match &**o {
            Obj::String(s) => s.as_str(),
            _ => return Value::Error(FsError { code: 2, message: "guid: string expected".to_string(), line: -1, column: -1 }),
        },
        _ => return Value::Error(FsError { code: 2, message: "guid: string expected".to_string(), line: -1, column: -1 }),
    };
    match Uuid::parse_str(s) {
        Ok(u) => Value::Obj(Rc::new(Obj::Guid(u))),
        Err(_) => Value::Error(FsError { code: 1, message: format!("guid: '{s}' is not a valid GUID"), line: -1, column: -1 }),
    }
}

fn fs_ticks_to_date(args: &[Value]) -> Value {
    if args.len() > 1 { return Value::Error(FsError { code: 1, message: "TicksToDate: invalid parameter count".to_string(), line: -1, column: -1 }); }
    if args.is_empty() { return Value::Nil; }
    if let Value::Error(e) = &args[0] { return Value::Error(e.clone()); }
    if matches!(args[0], Value::Nil) { return Value::Nil; }
    let ticks = match as_i64_exact(&args[0]) {
        Some(t) => t,
        None => return Value::Error(FsError { code: 2, message: "TicksToDate: integer ticks expected".to_string(), line: -1, column: -1 }),
    };
    Value::Obj(Rc::new(Obj::DateTimeTicks(ticks)))
}

fn fs_date(args: &[Value]) -> Value {
    if args.is_empty() || args.len() > 2 {
        return Value::Error(FsError { code: 1, message: "Date: invalid parameter count".to_string(), line: -1, column: -1 });
    }
    if let Value::Error(e) = &args[0] { return Value::Error(e.clone()); }
    if matches!(args[0], Value::Nil) { return Value::Nil; }
    let s = match &args[0] {
        Value::Obj(o) => match &**o {
            Obj::String(s) => s.clone(),
            _ => return Value::Error(FsError { code: 2, message: "Date: string expected".to_string(), line: -1, column: -1 }),
        },
        _ => return Value::Error(FsError { code: 2, message: "Date: string expected".to_string(), line: -1, column: -1 }),
    };
    let format = if args.len() == 2 {
        match &args[1] {
            Value::Nil => None,
            Value::Error(e) => return Value::Error(e.clone()),
            Value::Obj(o) => match &**o {
                Obj::String(f) => Some(f.clone()),
                _ => return Value::Error(FsError { code: 2, message: "Date: format must be a string".to_string(), line: -1, column: -1 }),
            },
            _ => return Value::Error(FsError { code: 2, message: "Date: format must be a string".to_string(), line: -1, column: -1 }),
        }
    } else {
        None
    };

    const UNIX_EPOCH_TICKS: i64 = 621_355_968_000_000_000;
    const TICKS_PER_SEC: i64 = 10_000_000;

    let parse_iso = || -> Option<i64> {
        let dt = time::OffsetDateTime::parse(&s, &time::format_description::well_known::Rfc3339).ok()?;
        let unix_seconds = dt.unix_timestamp();
        let nanos = dt.nanosecond() as i64;
        let ticks = UNIX_EPOCH_TICKS
            .checked_add(unix_seconds.checked_mul(TICKS_PER_SEC)?)
            .and_then(|base| base.checked_add(nanos / 100))?;
        Some(ticks)
    };

    let ticks = match format.as_deref() {
        None | Some("") => parse_iso(),
        Some("o") | Some("O") => parse_iso(),
        Some("yyyy-MM-dd") => {
            time::Date::parse(&s, &time::macros::format_description!("[year]-[month]-[day]"))
                .ok()
                .map(|d| {
                    let dt = d.with_time(time::Time::MIDNIGHT).assume_utc();
                    let unix_seconds = dt.unix_timestamp();
                    UNIX_EPOCH_TICKS + unix_seconds * TICKS_PER_SEC
                })
        }
        _ => None,
    };

    match ticks {
        Some(t) => Value::Obj(Rc::new(Obj::DateTimeTicks(t))),
        None => Value::Error(FsError { code: 1, message: format!("Date: String '{s}' can't be converted to date"), line: -1, column: -1 }),
    }
}

fn fs_change_type(args: &[Value]) -> Value {
    if args.len() != 2 {
        return Value::Error(FsError { code: 1, message: "ChangeType: invalid parameter count".to_string(), line: -1, column: -1 });
    }
    if let Value::Error(e) = &args[0] { return Value::Error(e.clone()); }
    if matches!(args[0], Value::Nil) { return Value::Nil; }

    let type_name = match &args[1] {
        Value::Error(e) => return Value::Error(e.clone()),
        Value::Obj(o) => match &**o {
            Obj::String(s) if !s.trim().is_empty() => s.trim().to_string(),
            _ => return Value::Error(FsError { code: 2, message: "ChangeType: Type name must be a string.".to_string(), line: -1, column: -1 }),
        },
        _ => return Value::Error(FsError { code: 2, message: "ChangeType: Type name must be a string.".to_string(), line: -1, column: -1 }),
    };
    let tn = type_name.to_lowercase();

    match tn.as_str() {
        "string" => {
            match &args[0] {
                Value::Obj(o) => match &**o {
                    Obj::Bytes(b) => {
                        let s = general_purpose::STANDARD.encode(b);
                        Value::Obj(Rc::new(Obj::String(s)))
                    }
                    Obj::Guid(g) => Value::Obj(Rc::new(Obj::String(g.to_string()))),
                    Obj::DateTimeTicks(t) => Value::Obj(Rc::new(Obj::String(t.to_string()))),
                    _ => Value::Obj(Rc::new(Obj::String(args[0].to_string()))),
                },
                _ => Value::Obj(Rc::new(Obj::String(args[0].to_string()))),
            }
        }
        "integer" => match &args[0] {
            Value::Int(n) => Value::Int(*n),
            Value::BigInt(n) => n.to_i64().map(Value::Int).unwrap_or(Value::Error(FsError { code: 1, message: "ChangeType: overflow converting to Integer".to_string(), line: -1, column: -1 })),
            Value::Number(n) if n.is_finite() && n.fract() == 0.0 => Value::Int(*n as i64),
            Value::Bool(b) => Value::Int(if *b { 1 } else { 0 }),
            Value::Obj(o) => match &**o {
                Obj::String(s) => s.parse::<i64>().map(Value::Int).unwrap_or(Value::Error(FsError { code: 1, message: "ChangeType: invalid Integer".to_string(), line: -1, column: -1 })),
                _ => Value::Error(FsError { code: 2, message: "ChangeType: Can't convert to Integer.".to_string(), line: -1, column: -1 }),
            },
            _ => Value::Error(FsError { code: 2, message: "ChangeType: Can't convert to Integer.".to_string(), line: -1, column: -1 }),
        },
        "biginteger" => match &args[0] {
            Value::Int(n) => Value::BigInt(BigInt::from(*n)),
            Value::BigInt(n) => Value::BigInt(n.clone()),
            Value::Number(n) if n.is_finite() && n.fract() == 0.0 => Value::BigInt(BigInt::from(*n as i64)),
            Value::Bool(b) => Value::BigInt(BigInt::from(if *b { 1 } else { 0 })),
            Value::Obj(o) => match &**o {
                Obj::String(s) => BigInt::parse_bytes(s.trim().as_bytes(), 10)
                    .map(Value::BigInt)
                    .unwrap_or(Value::Error(FsError { code: 1, message: "ChangeType: invalid BigInteger".to_string(), line: -1, column: -1 })),
                _ => Value::Error(FsError { code: 2, message: "ChangeType: Can't convert to BigInteger.".to_string(), line: -1, column: -1 }),
            },
            _ => Value::Error(FsError { code: 2, message: "ChangeType: Can't convert to BigInteger.".to_string(), line: -1, column: -1 }),
        },
        "float" => match &args[0] {
            Value::Number(n) => Value::Number(*n),
            Value::Int(n) => Value::Number(*n as f64),
            Value::BigInt(n) => n.to_f64().map(Value::Number).unwrap_or(Value::Error(FsError { code: 1, message: "ChangeType: overflow converting to Float".to_string(), line: -1, column: -1 })),
            Value::Bool(b) => Value::Number(if *b { 1.0 } else { 0.0 }),
            Value::Obj(o) => match &**o {
                Obj::String(s) => s.parse::<f64>().map(Value::Number).unwrap_or(Value::Error(FsError { code: 1, message: "ChangeType: invalid Float".to_string(), line: -1, column: -1 })),
                _ => Value::Error(FsError { code: 2, message: "ChangeType: Can't convert to Float.".to_string(), line: -1, column: -1 }),
            },
            _ => Value::Error(FsError { code: 2, message: "ChangeType: Can't convert to Float.".to_string(), line: -1, column: -1 }),
        },
        "boolean" => match &args[0] {
            Value::Bool(b) => Value::Bool(*b),
            Value::Int(n) => Value::Bool(*n != 0),
            Value::BigInt(n) => Value::Bool(!n.is_zero()),
            Value::Number(n) => Value::Bool(*n != 0.0),
            Value::Obj(o) => match &**o {
                Obj::String(s) => s.parse::<bool>().map(Value::Bool).unwrap_or(Value::Error(FsError { code: 1, message: "ChangeType: invalid Boolean".to_string(), line: -1, column: -1 })),
                _ => Value::Error(FsError { code: 2, message: "ChangeType: Can't convert to Boolean.".to_string(), line: -1, column: -1 }),
            },
            _ => Value::Error(FsError { code: 2, message: "ChangeType: Can't convert to Boolean.".to_string(), line: -1, column: -1 }),
        },
        "guid" => match &args[0] {
            Value::Obj(o) => match &**o {
                Obj::Guid(g) => Value::Obj(Rc::new(Obj::Guid(*g))),
                Obj::String(s) => match Uuid::parse_str(s) {
                    Ok(u) => Value::Obj(Rc::new(Obj::Guid(u))),
                    Err(_) => Value::Error(FsError { code: 1, message: "ChangeType: invalid Guid".to_string(), line: -1, column: -1 }),
                },
                _ => Value::Error(FsError { code: 2, message: "ChangeType: Can't convert to Guid.".to_string(), line: -1, column: -1 }),
            },
            _ => Value::Error(FsError { code: 2, message: "ChangeType: Can't convert to Guid.".to_string(), line: -1, column: -1 }),
        },
        "datetime" => match &args[0] {
            Value::Obj(o) => match &**o {
                Obj::DateTimeTicks(t) => Value::Obj(Rc::new(Obj::DateTimeTicks(*t))),
                Obj::String(s) => fs_date(&[Value::Obj(Rc::new(Obj::String(s.clone()))) ]),
                _ => Value::Error(FsError { code: 2, message: "ChangeType: Can't convert to DateTime.".to_string(), line: -1, column: -1 }),
            },
            Value::Int(t) => Value::Obj(Rc::new(Obj::DateTimeTicks(*t))),
            Value::BigInt(t) => t.to_i64().map(|x| Value::Obj(Rc::new(Obj::DateTimeTicks(x)))).unwrap_or(Value::Error(FsError { code: 1, message: "ChangeType: overflow converting to DateTime".to_string(), line: -1, column: -1 })),
            _ => Value::Error(FsError { code: 2, message: "ChangeType: Can't convert to DateTime.".to_string(), line: -1, column: -1 }),
        },
        "bytearray" => match &args[0] {
            Value::Obj(o) => match &**o {
                Obj::Bytes(b) => Value::Obj(Rc::new(Obj::Bytes(b.clone()))),
                Obj::String(s) => match general_purpose::STANDARD.decode(s.trim()) {
                    Ok(bytes) => Value::Obj(Rc::new(Obj::Bytes(bytes))),
                    Err(_) => Value::Error(FsError { code: 1, message: "ChangeType: invalid base64 for ByteArray".to_string(), line: -1, column: -1 }),
                },
                _ => Value::Error(FsError { code: 2, message: "ChangeType: Can't convert to ByteArray.".to_string(), line: -1, column: -1 }),
            },
            _ => Value::Error(FsError { code: 2, message: "ChangeType: Can't convert to ByteArray.".to_string(), line: -1, column: -1 }),
        },
        _ => Value::Error(FsError { code: 1, message: format!("ChangeType: Unknown target type '{type_name}'."), line: -1, column: -1 }),
    }
}

fn text_lower(args: &[Value]) -> Value {
    if args.len() != 1 {
        return Value::Error(FsError { code: 1, message: "lower: single string parameter expected".to_string(), line: -1, column: -1 });
    }
    match &args[0] {
        Value::Error(e) => Value::Error(e.clone()),
        Value::Nil => Value::Nil,
        Value::Obj(o) => match &**o {
            Obj::String(s) => Value::Obj(Rc::new(Obj::String(s.to_lowercase()))),
            _ => Value::Error(FsError { code: 2, message: "lower: string parameter expected".to_string(), line: -1, column: -1 }),
        },
        _ => Value::Error(FsError { code: 2, message: "lower: string parameter expected".to_string(), line: -1, column: -1 }),
    }
}

fn text_upper(args: &[Value]) -> Value {
    if args.len() != 1 {
        return Value::Error(FsError { code: 1, message: "upper: single string parameter expected".to_string(), line: -1, column: -1 });
    }
    match &args[0] {
        Value::Error(e) => Value::Error(e.clone()),
        Value::Nil => Value::Nil,
        Value::Obj(o) => match &**o {
            Obj::String(s) => Value::Obj(Rc::new(Obj::String(s.to_uppercase()))),
            _ => Value::Error(FsError { code: 2, message: "upper: string parameter expected".to_string(), line: -1, column: -1 }),
        },
        _ => Value::Error(FsError { code: 2, message: "upper: string parameter expected".to_string(), line: -1, column: -1 }),
    }
}

fn text_endswith(args: &[Value]) -> Value {
    if args.len() != 2 {
        return Value::Error(FsError { code: 1, message: "endswith: two parameters expected".to_string(), line: -1, column: -1 });
    }
    if matches!(&args[0], Value::Nil) || matches!(&args[1], Value::Nil) {
        return Value::Bool(false);
    }
    match (&args[0], &args[1]) {
        (Value::Error(e), _) | (_, Value::Error(e)) => Value::Error(e.clone()),
        (Value::Obj(a), Value::Obj(b)) => match (&**a, &**b) {
            (Obj::String(s1), Obj::String(s2)) => Value::Bool(s1.ends_with(s2)),
            _ => Value::Error(FsError { code: 2, message: "endswith: both parameters must be strings".to_string(), line: -1, column: -1 }),
        },
        _ => Value::Error(FsError { code: 2, message: "endswith: both parameters must be strings".to_string(), line: -1, column: -1 }),
    }
}

fn value_to_i64_default(v: &Value, default: i64) -> Result<i64, Value> {
    match v {
        Value::Nil => Ok(default),
        Value::Error(e) => Err(Value::Error(e.clone())),
        Value::Int(n) => Ok(*n),
        Value::BigInt(n) => n.to_i64().ok_or_else(|| Value::Error(FsError { code: 1, message: "numeric value is out of range".to_string(), line: -1, column: -1 })),
        Value::Number(n) if n.is_finite() => Ok(*n as i64),
        Value::Bool(b) => Ok(if *b { 1 } else { 0 }),
        Value::Obj(o) => match &**o {
            Obj::String(s) => s.trim().parse::<i64>().map_err(|_| Value::Error(FsError { code: 1, message: "invalid numeric string".to_string(), line: -1, column: -1 })),
            _ => Err(Value::Error(FsError { code: 2, message: "number expected".to_string(), line: -1, column: -1 })),
        },
        _ => Err(Value::Error(FsError { code: 2, message: "number expected".to_string(), line: -1, column: -1 })),
    }
}

fn substring_by_char_indices(s: &str, index: i64, count: i64) -> String {
    if index < 0 {
        return "".to_string();
    }
    let chars: Vec<char> = s.chars().collect();
    let len = chars.len() as i64;
    if index >= len {
        return "".to_string();
    }
    let mut c = count;
    if c < 0 || index + c > len {
        c = len - index;
    }
    let start = index as usize;
    let end = (index + c) as usize;
    chars[start..end].iter().collect()
}

fn text_substring(args: &[Value]) -> Value {
    if args.is_empty() {
        return Value::Error(FsError { code: 1, message: "substring requires at least one parameter.".to_string(), line: -1, column: -1 });
    }
    let s = match &args[0] {
        Value::Nil => return Value::Nil,
        Value::Error(e) => return Value::Error(e.clone()),
        Value::Obj(o) => match &**o {
            Obj::String(s) => s.clone(),
            _ => return Value::Nil,
        },
        _ => return Value::Nil,
    };
    let index = match value_to_i64_default(args.get(1).unwrap_or(&Value::Nil), 0) {
        Ok(v) => v,
        Err(e) => return e,
    };
    let count_default = s.chars().count() as i64;
    let count = match value_to_i64_default(args.get(2).unwrap_or(&Value::Nil), count_default) {
        Ok(v) => v,
        Err(e) => return e,
    };
    Value::Obj(Rc::new(Obj::String(substring_by_char_indices(&s, index, count))))
}

fn text_find(args: &[Value]) -> Value {
    if args.len() < 2 || args.len() > 3 {
        return Value::Error(FsError { code: 1, message: "find: two or three parameters expected".to_string(), line: -1, column: -1 });
    }
    let text = match &args[0] {
        Value::Error(e) => return Value::Error(e.clone()),
        Value::Obj(o) => match &**o {
            Obj::String(s) => s.clone(),
            _ => return Value::Error(FsError { code: 2, message: "find: first parameter should be string".to_string(), line: -1, column: -1 }),
        },
        _ => return Value::Error(FsError { code: 2, message: "find: first parameter should be string".to_string(), line: -1, column: -1 }),
    };
    let search = match &args[1] {
        Value::Error(e) => return Value::Error(e.clone()),
        Value::Obj(o) => match &**o {
            Obj::String(s) => s.clone(),
            _ => return Value::Error(FsError { code: 2, message: "find: second parameter should be string".to_string(), line: -1, column: -1 }),
        },
        _ => return Value::Error(FsError { code: 2, message: "find: second parameter should be string".to_string(), line: -1, column: -1 }),
    };

    let start_index = if args.len() == 3 {
        match &args[2] {
            Value::Int(i) => *i,
            _ => 0,
        }
    } else {
        0
    };
    let len = text.chars().count() as i64;
    if start_index < 0 || start_index >= len {
        return Value::Error(FsError { code: 1, message: "find: index is out of range".to_string(), line: -1, column: -1 });
    }

    let hay: Vec<char> = text.chars().collect();
    let needle: Vec<char> = search.chars().collect();
    if needle.is_empty() {
        return Value::Int(start_index);
    }
    let start = start_index as usize;
    for i in start..=hay.len().saturating_sub(needle.len()) {
        if hay[i..i + needle.len()] == needle[..] {
            return Value::Int(i as i64);
        }
    }
    Value::Int(-1)
}

fn text_is_blank(args: &[Value]) -> Value {
    if args.is_empty() {
        return Value::Error(FsError { code: 1, message: "isBlank: argument expected".to_string(), line: -1, column: -1 });
    }
    match &args[0] {
        Value::Error(e) => Value::Error(e.clone()),
        Value::Nil => Value::Bool(true),
        Value::Obj(o) => match &**o {
            Obj::String(s) => Value::Bool(s.trim().is_empty()),
            _ => Value::Error(FsError { code: 2, message: "isBlank: string expected".to_string(), line: -1, column: -1 }),
        },
        _ => Value::Error(FsError { code: 2, message: "isBlank: string expected".to_string(), line: -1, column: -1 }),
    }
}

fn text_join(args: &[Value]) -> Value {
    if args.len() != 2 {
        return Value::Error(FsError { code: 1, message: "join: Two parameters expected".to_string(), line: -1, column: -1 });
    }
    let list_val = &args[0];
    let sep = match &args[1] {
        Value::Error(e) => return Value::Error(e.clone()),
        Value::Obj(o) => match &**o {
            Obj::String(s) => s.clone(),
            _ => return Value::Error(FsError { code: 2, message: "join: second parameter should be string".to_string(), line: -1, column: -1 }),
        },
        _ => return Value::Error(FsError { code: 2, message: "join: second parameter should be string".to_string(), line: -1, column: -1 }),
    };

    if matches!(list_val, Value::Nil) {
        return Value::Error(FsError { code: 2, message: "join: first parameter should be list".to_string(), line: -1, column: -1 });
    }
    if let Value::Error(e) = list_val {
        return Value::Error(e.clone());
    }

    let mut out = String::new();
    let mut first = true;
    match list_val {
        Value::Obj(o) => match &**o {
            Obj::List(items) => {
                for item in items.iter() {
                    if matches!(item, Value::Nil) { continue; }
                    if !first { out.push_str(&sep); }
                    first = false;
                    out.push_str(&item.to_string());
                }
            }
            Obj::Range(r) => {
                for i in 0..r.count {
                    if !first { out.push_str(&sep); }
                    first = false;
                    out.push_str(&(r.start + i as i64).to_string());
                }
            }
            _ => return Value::Error(FsError { code: 2, message: "join: first parameter should be list".to_string(), line: -1, column: -1 }),
        },
        _ => return Value::Error(FsError { code: 2, message: "join: first parameter should be list".to_string(), line: -1, column: -1 }),
    }
    Value::Obj(Rc::new(Obj::String(out)))
}

fn list_take(args: &[Value]) -> Value {
    if args.len() != 2 {
        return Value::Error(FsError { code: 1, message: "Take: Invalid parameter count. Expected 2.".to_string(), line: -1, column: -1 });
    }
    if let Value::Error(e) = &args[0] { return Value::Error(e.clone()); }
    if matches!(args[0], Value::Nil) { return Value::Nil; }
    let n = match &args[1] {
        Value::Error(e) => return Value::Error(e.clone()),
        Value::Int(i) => *i,
        _ => return Value::Error(FsError { code: 2, message: "Take: second parameter should be Number".to_string(), line: -1, column: -1 }),
    };
    if n <= 0 {
        return Value::Obj(Rc::new(Obj::List(vec![])));
    }
    match &args[0] {
        Value::Obj(o) => match &**o {
            Obj::List(items) => {
                let take_n = (n as usize).min(items.len());
                Value::Obj(Rc::new(Obj::List(items.iter().take(take_n).cloned().collect())))
            }
            Obj::Range(r) => {
                let take_n = (n as usize).min(r.count);
                Value::Obj(Rc::new(Obj::Range(crate::obj::RangeObject { start: r.start, count: take_n })))
            }
            _ => Value::Error(FsError { code: 2, message: "Take: first parameter should be List".to_string(), line: -1, column: -1 }),
        },
        _ => Value::Error(FsError { code: 2, message: "Take: first parameter should be List".to_string(), line: -1, column: -1 }),
    }
}

fn list_skip(args: &[Value]) -> Value {
    if args.len() != 2 {
        return Value::Error(FsError { code: 1, message: "Skip: Invalid parameter count. Expected 2.".to_string(), line: -1, column: -1 });
    }
    if let Value::Error(e) = &args[0] { return Value::Error(e.clone()); }
    if matches!(args[0], Value::Nil) { return Value::Nil; }
    let n = match &args[1] {
        Value::Error(e) => return Value::Error(e.clone()),
        Value::Int(i) => *i,
        _ => return Value::Error(FsError { code: 2, message: "Skip: second parameter should be Number".to_string(), line: -1, column: -1 }),
    };
    if n <= 0 {
        return args[0].clone();
    }
    match &args[0] {
        Value::Obj(o) => match &**o {
            Obj::List(items) => {
                if (n as usize) >= items.len() {
                    return Value::Obj(Rc::new(Obj::List(vec![])));
                }
                Value::Obj(Rc::new(Obj::List(items.iter().skip(n as usize).cloned().collect())))
            }
            Obj::Range(r) => {
                let skip_n = (n as usize).min(r.count);
                if skip_n >= r.count {
                    return Value::Obj(Rc::new(Obj::List(vec![])));
                }
                Value::Obj(Rc::new(Obj::Range(crate::obj::RangeObject { start: r.start + skip_n as i64, count: r.count - skip_n })))
            }
            _ => Value::Error(FsError { code: 2, message: "Skip: first parameter should be List".to_string(), line: -1, column: -1 }),
        },
        _ => Value::Error(FsError { code: 2, message: "Skip: first parameter should be List".to_string(), line: -1, column: -1 }),
    }
}

fn list_reverse(args: &[Value]) -> Value {
    if args.len() != 1 {
        return Value::Error(FsError { code: 1, message: "Reverse: Invalid parameter count. Expected 1.".to_string(), line: -1, column: -1 });
    }
    if let Value::Error(e) = &args[0] { return Value::Error(e.clone()); }
    if matches!(args[0], Value::Nil) { return Value::Nil; }
    match &args[0] {
        Value::Obj(o) => match &**o {
            Obj::List(items) => {
                let mut out = items.clone();
                out.reverse();
                Value::Obj(Rc::new(Obj::List(out)))
            }
            Obj::Range(r) => {
                let mut out: Vec<Value> = Vec::with_capacity(r.count);
                for i in 0..r.count {
                    out.push(Value::Int(r.start + (r.count - 1 - i) as i64));
                }
                Value::Obj(Rc::new(Obj::List(out)))
            }
            _ => Value::Error(FsError { code: 2, message: "Reverse: parameter should be List".to_string(), line: -1, column: -1 }),
        },
        _ => Value::Error(FsError { code: 2, message: "Reverse: parameter should be List".to_string(), line: -1, column: -1 }),
    }
}

fn list_distinct(args: &[Value]) -> Value {
    if args.len() != 1 {
        return Value::Error(FsError { code: 1, message: "Distinct: Invalid parameter count. Expected 1.".to_string(), line: -1, column: -1 });
    }
    if let Value::Error(e) = &args[0] { return Value::Error(e.clone()); }
    if matches!(args[0], Value::Nil) { return Value::Nil; }
    match &args[0] {
        Value::Obj(o) => match &**o {
            Obj::Range(r) => Value::Obj(Rc::new(Obj::Range(r.clone()))),
            Obj::List(items) => {
                let mut out: Vec<Value> = Vec::new();
                'outer: for v in items.iter().cloned() {
                    for seen in out.iter() {
                        if *seen == v {
                            continue 'outer;
                        }
                    }
                    out.push(v);
                }
                Value::Obj(Rc::new(Obj::List(out)))
            }
            _ => Value::Error(FsError { code: 2, message: "Distinct: parameter should be List".to_string(), line: -1, column: -1 }),
        },
        _ => Value::Error(FsError { code: 2, message: "Distinct: parameter should be List".to_string(), line: -1, column: -1 }),
    }
}

fn list_contains(args: &[Value]) -> Value {
    if args.len() != 2 {
        return Value::Error(FsError { code: 1, message: "Contains: Invalid parameter count. Expected 2.".to_string(), line: -1, column: -1 });
    }
    let container = &args[0];
    let item = &args[1];
    if let Value::Error(e) = container { return Value::Error(e.clone()); }
    if let Value::Error(e) = item { return Value::Error(e.clone()); }
    match container {
        Value::Obj(o) => match &**o {
            Obj::List(items) => Value::Bool(items.iter().any(|x| x == item)),
            Obj::Range(r) => {
                let needle = as_i64_exact(item);
                if let Some(n) = needle {
                    Value::Bool(n >= r.start && n < r.start + (r.count as i64))
                } else {
                    Value::Bool(false)
                }
            }
            Obj::String(s) => {
                if let Value::Obj(o2) = item {
                    if let Obj::String(sub) = &**o2 {
                        Value::Bool(s.to_lowercase().contains(&sub.to_lowercase()))
                    } else {
                        Value::Error(FsError { code: 2, message: "Contains: Invalid types for parameters".to_string(), line: -1, column: -1 })
                    }
                } else {
                    Value::Error(FsError { code: 2, message: "Contains: Invalid types for parameters".to_string(), line: -1, column: -1 })
                }
            }
            _ => Value::Error(FsError { code: 2, message: "Contains: Invalid types for parameters".to_string(), line: -1, column: -1 }),
        },
        _ => Value::Error(FsError { code: 2, message: "Contains: Invalid types for parameters".to_string(), line: -1, column: -1 }),
    }
}
