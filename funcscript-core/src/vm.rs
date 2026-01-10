//! Stack-based bytecode VM for FuncScript core.
//!
//! Key points:
//! - `providers` implements the FuncScript scoping/provider chain (for KVC + selectors).
//! - `Obj::Range` is lazy to avoid allocating huge lists for `Range(start,count)`.
//! - Many operations return `Value::Error` instead of panicking to keep scripts safe.

use crate::chunk::OpCode;
use crate::value::{FsError, Value};
use num_bigint::BigInt;
use num_traits::ToPrimitive;
use base64::{engine::general_purpose, Engine as _};

#[derive(Debug)]
pub enum InterpretResult {
    CompileError(FsError),
    RuntimeError(FsError),
}

use std::collections::HashMap;

use crate::obj::{Obj, FsFunction, KvcObject, ProviderObject};
use crate::compiler::Compiler;
use std::rc::Rc;
use std::cell::RefCell;

const FRAMES_MAX: usize = 64;
const STACK_MAX: usize = 256;

struct CallFrame {
    function: Rc<FsFunction>, 
    ip: usize,
    slots: usize, 
}

impl CallFrame {
    fn new(function: Rc<FsFunction>, slots: usize) -> Self {
        Self { function, ip: 0, slots }
    }
}

pub struct VM {
    frames: Vec<CallFrame>,
    stack: Vec<Value>,
    globals: HashMap<String, Value>,
    providers: Vec<Value>,
    values: Vec<Option<Value>>,
    free_value_ids: Vec<u64>,
}

impl VM {
    pub fn new() -> Self {
        let mut globals = HashMap::new();
        crate::native::define_natives(&mut globals);
        
        VM {
            frames: Vec::with_capacity(FRAMES_MAX),
            stack: Vec::with_capacity(STACK_MAX),
            globals,
            providers: Vec::new(),
            values: Vec::new(),
            free_value_ids: Vec::new(),
        }
    }

    pub fn store_value(&mut self, v: Value) -> u64 {
        if let Some(id) = self.free_value_ids.pop() {
            let idx = (id - 1) as usize;
            if idx < self.values.len() {
                self.values[idx] = Some(v);
                return id;
            }
        }
        self.values.push(Some(v));
        self.values.len() as u64
    }

    pub fn get_value(&self, id: u64) -> Option<&Value> {
        if id == 0 {
            return None;
        }
        let idx = (id - 1) as usize;
        self.values.get(idx).and_then(|v| v.as_ref())
    }

    pub fn clone_value(&self, id: u64) -> Option<Value> {
        self.get_value(id).cloned()
    }

    pub fn free_value(&mut self, id: u64) -> bool {
        if id == 0 {
            return false;
        }
        let idx = (id - 1) as usize;
        if idx >= self.values.len() {
            return false;
        }
        if self.values[idx].take().is_some() {
            self.free_value_ids.push(id);
            return true;
        }
        false
    }

    pub fn call_value_direct(&mut self, callee: Value, args: Vec<Value>) -> Result<Value, InterpretResult> {
        self.frames.clear();
        self.stack.clear();
        self.providers.clear();

        self.stack.push(callee);
        for a in args {
            self.stack.push(a);
        }

        let arg_count = self.stack.len() - 1;
        self.call_value(arg_count)?;
        if self.frames.is_empty() {
            return Ok(self.pop());
        }
        self.run()
    }

    pub fn value_get_prop(&mut self, receiver: &Value, key: &str) -> Value {
        self.provider_get(receiver, key)
    }

    pub fn value_index(&mut self, receiver: &Value, index: i64) -> Value {
        if let Value::Error(e) = receiver {
            return Value::Error(e.clone());
        }
        match receiver {
            Value::Obj(o) => match &**o {
                Obj::List(items) => {
                    if index < 0 {
                        return Value::Nil;
                    }
                    items.get(index as usize).cloned().unwrap_or(Value::Nil)
                }
                Obj::Range(r) => {
                    if index < 0 {
                        return Value::Nil;
                    }
                    let idx = index as usize;
                    if idx >= r.count {
                        Value::Nil
                    } else {
                        Value::Int(r.start + idx as i64)
                    }
                }
                Obj::Bytes(b) => {
                    if index < 0 {
                        return Value::Nil;
                    }
                    let idx = index as usize;
                    if idx >= b.len() {
                        Value::Nil
                    } else {
                        Value::Int(b[idx] as i64)
                    }
                }
                Obj::Kvc(k) => {
                    if index < 0 {
                        return Value::Nil;
                    }
                    let idx = index as usize;
                    let key_l = {
                        let b = k.borrow();
                        b.order.get(idx).cloned()
                    };
                    if let Some(key_l) = key_l {
                        let display = {
                            let b = k.borrow();
                            b.display_names.get(&key_l).cloned().unwrap_or_else(|| key_l.clone())
                        };
                        self.kvc_get(Rc::clone(k), &key_l, &display)
                    } else {
                        Value::Nil
                    }
                }
                _ => Value::Nil,
            },
            _ => Value::Nil,
        }
    }

    pub fn value_len(&mut self, v: &Value) -> Value {
        if let Value::Error(e) = v {
            return Value::Error(e.clone());
        }
        match v {
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

    pub fn kvc_keys(&self, k: Rc<RefCell<KvcObject>>) -> Vec<String> {
        let b = k.borrow();
        b.order
            .iter()
            .map(|key_l| b.display_names.get(key_l).cloned().unwrap_or_else(|| key_l.clone()))
            .collect()
    }

    fn current_provider(&self) -> Option<Value> {
        self.providers.last().cloned()
    }

    fn run(&mut self) -> Result<Value, InterpretResult> {
        loop {
            if let Some(v) = self.step_current()? {
                return Ok(v);
            }
        }
    }

    fn step_current(&mut self) -> Result<Option<Value>, InterpretResult> {
             if self.frames.is_empty() {
            return Ok(Some(Value::Nil));
             }

             let frame_idx = self.frames.len() - 1;
             
        if self.frames[frame_idx].ip >= self.frames[frame_idx].function.chunk.code.len() {
            let result = Value::Nil;
            let slots = self.frames[frame_idx].slots;
            self.frames.pop();
            self.stack.truncate(slots);
            if self.frames.is_empty() {
                return Ok(Some(result));
            }
            self.stack.push(result);
            return Ok(None);
        }

             let instruction = self.frames[frame_idx].function.chunk.code[self.frames[frame_idx].ip].clone();
             self.frames[frame_idx].ip += 1;

            match instruction {
                OpCode::OpConstant(idx) => {
                    let constant = {
                        let f = &self.frames[frame_idx];
                        f.function.chunk.constants[idx].clone()
                    };
                    self.stack.push(constant);
                }
            OpCode::OpReturn => {
                let result = self.pop();
                let slots = self.frames[frame_idx].slots;
                self.frames.pop();
                self.stack.truncate(slots);
                if self.frames.is_empty() {
                    return Ok(Some(result));
                }
                self.stack.push(result);
            }
                OpCode::OpAdd => {
                    let b = self.pop();
                    let a = self.pop();
                    match (a, b) {
                        (Value::Nil, Value::Nil) => self.stack.push(Value::Nil),
                        (Value::Nil, other) => self.stack.push(other),
                        (other, Value::Nil) => self.stack.push(other),
                        (a, b) if VM::is_numeric(&a) && VM::is_numeric(&b) => {
                            let v = self.numeric_add(a, b)?;
                            self.stack.push(v);
                        }
                        (Value::Obj(a), b)
                            if matches!(&*a, crate::obj::Obj::String(_)) && VM::is_numeric(&b) =>
                        {
                            let s1 = match &*a {
                                crate::obj::Obj::String(s) => s,
                                _ => unreachable!(),
                            };
                            let s = format!("{s1}{b}");
                            self.stack.push(Value::Obj(Rc::new(Obj::String(s))));
                        }
                        (a, Value::Obj(b))
                            if matches!(&*b, crate::obj::Obj::String(_)) && VM::is_numeric(&a) =>
                        {
                            let s2 = match &*b {
                                crate::obj::Obj::String(s) => s,
                                _ => unreachable!(),
                            };
                            let s = format!("{a}{s2}");
                            self.stack.push(Value::Obj(Rc::new(Obj::String(s))));
                        }
                        (Value::Obj(a), Value::Obj(b)) => {
                            match (&*a, &*b) {
                                (crate::obj::Obj::String(s1), crate::obj::Obj::String(s2)) => {
                                    let s = format!("{}{}", s1, s2);
                                    let obj = crate::obj::Obj::String(s);
                                    self.stack.push(Value::Obj(std::rc::Rc::new(obj)));
                                },
                                (crate::obj::Obj::List(l1), crate::obj::Obj::List(l2)) => {
                                    let mut out = Vec::with_capacity(l1.len() + l2.len());
                                    out.extend(l1.iter().cloned());
                                    out.extend(l2.iter().cloned());
                                    self.stack.push(Value::Obj(Rc::new(Obj::List(out))));
                                }
                                (crate::obj::Obj::List(l1), _) => {
                                    let mut out = Vec::with_capacity(l1.len() + 1);
                                    out.extend(l1.iter().cloned());
                                    out.push(Value::Obj(Rc::clone(&b)));
                                    self.stack.push(Value::Obj(Rc::new(Obj::List(out))));
                                }
                                (_, crate::obj::Obj::List(l2)) => {
                                    let mut out = Vec::with_capacity(l2.len() + 1);
                                    out.push(Value::Obj(Rc::clone(&a)));
                                    out.extend(l2.iter().cloned());
                                    self.stack.push(Value::Obj(Rc::new(Obj::List(out))));
                                }
                                (crate::obj::Obj::Kvc(k1), crate::obj::Obj::Kvc(k2)) => {
                                    let merged = self.merge_kvc(Rc::clone(k1), Rc::clone(k2));
                                    self.stack.push(merged);
                                }
                                _ => return Err(self.runtime_error()),
                            }
                        },
                        _ => return Err(self.runtime_error()),
                    }
                }
                OpCode::OpSubtract => self.numeric_subtract()?,
                OpCode::OpMultiply => self.numeric_multiply()?,
                OpCode::OpDivide => self.numeric_divide()?,
                OpCode::OpIntDiv => self.numeric_int_divide()?,
                OpCode::OpModulo => self.numeric_modulo()?,
                OpCode::OpPow => self.numeric_pow()?,
                OpCode::OpNegate => {
                    let popped = self.pop();
                    let v = self.numeric_negate(popped)?;
                    self.stack.push(v);
                }
                OpCode::OpJump(offset) => {
                    self.frames[frame_idx].ip += offset;
                }
                OpCode::OpJumpIfFalse(offset) => {
                     let condition = self.peek(0);
                     if self.is_falsey(&condition) {
                         self.frames[frame_idx].ip += offset;
                     }
                }
                OpCode::OpJumpIfNil(offset) => {
                    let v = self.peek(0);
                    if matches!(v, Value::Nil) {
                        self.frames[frame_idx].ip += offset;
                    }
                }
                OpCode::OpPop => {
                    self.pop();
                }
            OpCode::OpDup => {
                let v = self.peek(0);
                self.stack.push(v);
            }
            OpCode::OpSwap => {
                if self.stack.len() < 2 {
                    return Err(self.runtime_error());
                }
                let len = self.stack.len();
                self.stack.swap(len - 1, len - 2);
            }
                OpCode::OpNot => {
                    let value = self.pop();
                    match value {
                        Value::Bool(b) => self.stack.push(Value::Bool(!b)),
                        Value::Error(e) => self.stack.push(Value::Error(e)),
                        Value::Nil => return Err(self.runtime_error_with(2011, "not: bool expected (got nil)")),
                        _ => return Err(self.runtime_error_with(2011, "not: bool expected")),
                    }
                }
                OpCode::OpEqual => {
                    let b = self.pop();
                    let a = self.pop();
                    let eq = self.values_equal(&a, &b);
                    self.stack.push(Value::Bool(eq));
                }
                OpCode::OpGreater => {
                    let b = self.pop();
                    let a = self.pop();
                    let gt = self.numeric_compare_gt(&a, &b)?;
                    self.stack.push(Value::Bool(gt));
                }
                OpCode::OpLess => {
                    let b = self.pop();
                    let a = self.pop();
                    let lt = self.numeric_compare_lt(&a, &b)?;
                    self.stack.push(Value::Bool(lt));
                }
                OpCode::OpBuildList(count) => {
                    let start_idx = self.stack.len() - count;
                    let items: Vec<Value> = self.stack.drain(start_idx..).collect();
                    let obj = crate::obj::Obj::List(items);
                    self.stack.push(Value::Obj(std::rc::Rc::new(obj)));
                }
                OpCode::OpBuildKvc(count) => {
                    let mut entries: HashMap<String, Rc<FsFunction>> = HashMap::new();
                    let mut order: Vec<String> = Vec::with_capacity(count);
                    let mut display_names: HashMap<String, String> = HashMap::new();
                     for _ in 0..count {
                        let thunk = self.pop();
                         let key = self.pop();

                        let key = match key {
                            Value::Obj(o) => match &*o {
                                Obj::String(s) => s.clone(),
                                _ => return Err(self.runtime_error()),
                            },
                            _ => return Err(self.runtime_error()),
                        };

                        let thunk = match thunk {
                            Value::Obj(o) => match &*o {
                                Obj::Function(f) => Rc::clone(f),
                                _ => return Err(self.runtime_error()),
                            },
                            _ => return Err(self.runtime_error()),
                        };

                        let k = key.to_lowercase();
                        entries.insert(k.clone(), thunk);
                        display_names.insert(k.clone(), key);
                        order.push(k);
                    }

                    
                    let mut parent = self.current_provider();
                    if !self.frames.is_empty() {
                        let f = &self.frames[frame_idx].function;
                        let frame_slots = self.frames[frame_idx].slots;
                        let mut cache: HashMap<String, Value> = HashMap::new();
                        let mut scope_order: Vec<String> = Vec::new();
                        let mut scope_display_names: HashMap<String, String> = HashMap::new();

                        for (i, name) in f.slot_names.iter().enumerate() {
                            if name.is_empty() { continue; }
                            let stack_idx = frame_slots + i;
                            if stack_idx >= self.stack.len() { continue; }
                            let key_l = name.to_ascii_lowercase();
                            if cache.contains_key(&key_l) { continue; }
                            cache.insert(key_l.clone(), self.stack[stack_idx].clone());
                            scope_order.push(key_l.clone());
                            scope_display_names.insert(key_l, name.clone());
                        }

                        if !cache.is_empty() {
                            let scope_kvc = KvcObject {
                                entries: HashMap::new(),
                                cache,
                                evaluating: std::collections::HashSet::new(),
                                parent,
                                order: scope_order,
                                display_names: scope_display_names,
                            };
                            parent = Some(Value::Obj(Rc::new(Obj::Kvc(Rc::new(RefCell::new(scope_kvc))))));
                        }
                    }
                    let kvc = KvcObject {
                        entries,
                        cache: HashMap::new(),
                        evaluating: std::collections::HashSet::new(),
                        parent,
                        order: order.into_iter().rev().collect(),
                        display_names,
                    };
                    self.stack.push(Value::Obj(Rc::new(Obj::Kvc(Rc::new(RefCell::new(kvc))))));
                }
                OpCode::OpGetProp(idx) => {
                     let name_val = {
                         let f = &self.frames[frame_idx];
                         f.function.chunk.constants[idx].clone()
                     };
                     let name = if let Value::Obj(o) = name_val {
                         if let crate::obj::Obj::String(s) = &*o { s.clone() } else { return Err(self.runtime_error()); }
                     } else { return Err(self.runtime_error()); };

                     let receiver = self.peek(0);
                     let val = self.provider_get(&receiver, &name);
                     self.pop();
                     self.stack.push(val);
                }
                OpCode::OpCall(arg_count) => self.call_value(arg_count)?,
                OpCode::OpMap => {
                    let fn_val = self.pop();
                    let list_val = self.pop();

                    if matches!(list_val, Value::Nil) {
                        self.stack.push(Value::Nil);
                        return Ok(None);
                    }

                    let arity = match &fn_val {
                        Value::Obj(o) => match &**o {
                            Obj::Function(f) => f.arity,
                            Obj::NativeFn(_) => 2,
                            _ => return Err(self.runtime_error()),
                        },
                        _ => return Err(self.runtime_error()),
                    };
                    if arity != 1 && arity != 2 {
                        return Err(self.runtime_error_with(2015, "map: expected function of arity 1 or 2"));
                    }

                    let mut out: Vec<Value> = Vec::new();
                    match &list_val {
                        Value::Obj(o) => match &**o {
                            Obj::List(items) => {
                                out.reserve(items.len());
                                for (i, item) in items.iter().cloned().enumerate() {
                                    let before = self.frames.len();
                                    self.stack.push(fn_val.clone());
                                    self.stack.push(item);
                                    if arity == 2 {
                                        self.stack.push(Value::Int(i as i64));
                                    }
                                    self.call_value(arity)?;
                                    let v = if self.frames.len() > before {
                                        self.run_nested(before)?
                                    } else {
                                        self.pop()
                                    };
                                    out.push(v);
                                }
                            }
                            Obj::Range(r) => {
                                out.reserve(r.count);
                                for i in 0..r.count {
                                    let item = Value::Int(r.start + i as i64);
                                    let before = self.frames.len();
                                    self.stack.push(fn_val.clone());
                                    self.stack.push(item);
                                    if arity == 2 {
                                        self.stack.push(Value::Int(i as i64));
                                    }
                                    self.call_value(arity)?;
                                    let v = if self.frames.len() > before {
                                        self.run_nested(before)?
                                    } else {
                                        self.pop()
                                    };
                                    out.push(v);
                                }
                            }
                            _ => return Err(self.runtime_error()),
                        },
                        _ => return Err(self.runtime_error()),
                    }
                    self.stack.push(Value::Obj(Rc::new(Obj::List(out))));
                }
                OpCode::OpFilter => {
                    let fn_val = self.pop();
                    let list_val = self.pop();

                    if matches!(list_val, Value::Nil) {
                        self.stack.push(Value::Nil);
                        return Ok(None);
                    }

                    let arity = match &fn_val {
                        Value::Obj(o) => match &**o {
                            Obj::Function(f) => f.arity,
                            Obj::NativeFn(_) => 2,
                            _ => return Err(self.runtime_error()),
                        },
                        _ => return Err(self.runtime_error()),
                    };
                    if arity != 1 && arity != 2 {
                        return Err(self.runtime_error_with(2016, "filter: expected function of arity 1 or 2"));
                    }

                    let mut out: Vec<Value> = Vec::new();
                    match &list_val {
                        Value::Obj(o) => match &**o {
                            Obj::List(items) => {
                                for (i, item) in items.iter().cloned().enumerate() {
                                    let before = self.frames.len();
                                    self.stack.push(fn_val.clone());
                                    self.stack.push(item.clone());
                                    if arity == 2 {
                                        self.stack.push(Value::Int(i as i64));
                                    }
                                    self.call_value(arity)?;
                                    let pred = if self.frames.len() > before {
                                        self.run_nested(before)?
                                    } else {
                                        self.pop()
                                    };
                                    if let Value::Error(e) = pred {
                                        return Err(InterpretResult::RuntimeError(e));
                                    }
                                    if matches!(pred, Value::Bool(true)) {
                                        out.push(item);
                                    }
                                }
                            }
                            Obj::Range(r) => {
                                for i in 0..r.count {
                                    let item = Value::Int(r.start + i as i64);
                                    let before = self.frames.len();
                                    self.stack.push(fn_val.clone());
                                    self.stack.push(item.clone());
                                    if arity == 2 {
                                        self.stack.push(Value::Int(i as i64));
                                    }
                                    self.call_value(arity)?;
                                    let pred = if self.frames.len() > before {
                                        self.run_nested(before)?
                                    } else {
                                        self.pop()
                                    };
                                    if let Value::Error(e) = pred {
                                        return Err(InterpretResult::RuntimeError(e));
                                    }
                                    if matches!(pred, Value::Bool(true)) {
                                        out.push(item);
                                    }
                                }
                            }
                            _ => return Err(self.runtime_error()),
                        },
                        _ => return Err(self.runtime_error()),
                    }
                    self.stack.push(Value::Obj(Rc::new(Obj::List(out))));
                }
                OpCode::OpAny => {
                    let fn_val = self.pop();
                    let list_val = self.pop();

                    if matches!(list_val, Value::Nil) {
                        self.stack.push(Value::Bool(false));
                        return Ok(None);
                    }

                    let arity = match &fn_val {
                        Value::Obj(o) => match &**o {
                            Obj::Function(f) => f.arity,
                            Obj::NativeFn(_) => 2,
                            _ => return Err(self.runtime_error()),
                        },
                        _ => return Err(self.runtime_error()),
                    };
                    if arity != 1 && arity != 2 {
                        return Err(self.runtime_error_with(2017, "Any: expected function of arity 1 or 2"));
                    }

                    let mut any = false;
                    match &list_val {
                        Value::Obj(o) => match &**o {
                            Obj::List(items) => {
                                for (i, item) in items.iter().cloned().enumerate() {
                                    let before = self.frames.len();
                                    self.stack.push(fn_val.clone());
                                    self.stack.push(item);
                                    if arity == 2 {
                                        self.stack.push(Value::Int(i as i64));
                                    }
                                    self.call_value(arity)?;
                                    let pred = if self.frames.len() > before {
                                        self.run_nested(before)?
                                    } else {
                                        self.pop()
                                    };
                                    if let Value::Error(e) = pred {
                                        return Err(InterpretResult::RuntimeError(e));
                                    }
                                    if matches!(pred, Value::Bool(true)) {
                                        any = true;
                                        break;
                                    }
                                }
                            }
                            Obj::Range(r) => {
                                for i in 0..r.count {
                                    let item = Value::Int(r.start + i as i64);
                                    let before = self.frames.len();
                                    self.stack.push(fn_val.clone());
                                    self.stack.push(item);
                                    if arity == 2 {
                                        self.stack.push(Value::Int(i as i64));
                                    }
                                    self.call_value(arity)?;
                                    let pred = if self.frames.len() > before {
                                        self.run_nested(before)?
                                    } else {
                                        self.pop()
                                    };
                                    if let Value::Error(e) = pred {
                                        return Err(InterpretResult::RuntimeError(e));
                                    }
                                    if matches!(pred, Value::Bool(true)) {
                                        any = true;
                                        break;
                                    }
                                }
                            }
                            _ => return Err(self.runtime_error()),
                        },
                        _ => return Err(self.runtime_error()),
                    }
                    self.stack.push(Value::Bool(any));
                }
                OpCode::OpFirstWhere => {
                    let fn_val = self.pop();
                    let list_val = self.pop();

                    if matches!(list_val, Value::Nil) {
                        self.stack.push(Value::Nil);
                        return Ok(None);
                    }

                    let arity = match &fn_val {
                        Value::Obj(o) => match &**o {
                            Obj::Function(f) => f.arity,
                            Obj::NativeFn(_) => 2,
                            _ => return Err(self.runtime_error()),
                        },
                        _ => return Err(self.runtime_error()),
                    };
                    if arity != 1 && arity != 2 {
                        return Err(self.runtime_error_with(2018, "First: expected function of arity 1 or 2"));
                    }

                    let mut found: Option<Value> = None;
                    match &list_val {
                        Value::Obj(o) => match &**o {
                            Obj::List(items) => {
                                for (i, item) in items.iter().cloned().enumerate() {
                                    let before = self.frames.len();
                                    self.stack.push(fn_val.clone());
                                    self.stack.push(item.clone());
                                    if arity == 2 {
                                        self.stack.push(Value::Int(i as i64));
                                    }
                                    self.call_value(arity)?;
                                    let pred = if self.frames.len() > before {
                                        self.run_nested(before)?
                                    } else {
                                        self.pop()
                                    };
                                    if let Value::Error(e) = pred {
                                        return Err(InterpretResult::RuntimeError(e));
                                    }
                                    if matches!(pred, Value::Bool(true)) {
                                        found = Some(item);
                                        break;
                                    }
                                }
                            }
                            Obj::Range(r) => {
                                for i in 0..r.count {
                                    let item = Value::Int(r.start + i as i64);
                                    let before = self.frames.len();
                                    self.stack.push(fn_val.clone());
                                    self.stack.push(item.clone());
                                    if arity == 2 {
                                        self.stack.push(Value::Int(i as i64));
                                    }
                                    self.call_value(arity)?;
                                    let pred = if self.frames.len() > before {
                                        self.run_nested(before)?
                                    } else {
                                        self.pop()
                                    };
                                    if let Value::Error(e) = pred {
                                        return Err(InterpretResult::RuntimeError(e));
                                    }
                                    if matches!(pred, Value::Bool(true)) {
                                        found = Some(item);
                                        break;
                                    }
                                }
                            }
                            _ => return Err(self.runtime_error()),
                        },
                        _ => return Err(self.runtime_error()),
                    }
                    self.stack.push(found.unwrap_or(Value::Nil));
                }
                OpCode::OpSort => {
                    let fn_val = self.pop();
                    let list_val = self.pop();

                    if matches!(list_val, Value::Nil) {
                        self.stack.push(Value::Nil);
                        return Ok(None);
                    }

                    let arity = match &fn_val {
                        Value::Obj(o) => match &**o {
                            Obj::Function(f) => f.arity,
                            Obj::NativeFn(_) => 2,
                            _ => return Err(self.runtime_error()),
                        },
                        _ => return Err(self.runtime_error()),
                    };
                    if arity != 2 {
                        return Err(self.runtime_error_with(2019, "Sort: expected function of arity 2"));
                    }

                    let mut items: Vec<Value> = match &list_val {
                        Value::Obj(o) => match &**o {
                            Obj::List(items) => items.clone(),
                            Obj::Range(r) => (0..r.count).map(|i| Value::Int(r.start + i as i64)).collect(),
                            _ => return Err(self.runtime_error()),
                        },
                        _ => return Err(self.runtime_error()),
                    };
                    let mut cmp = |a: &Value, b: &Value| -> Result<std::cmp::Ordering, InterpretResult> {
                        let before = self.frames.len();
                        self.stack.push(fn_val.clone());
                        self.stack.push(a.clone());
                        self.stack.push(b.clone());
                        self.call_value(2)?;
                        let v = if self.frames.len() > before {
                            self.run_nested(before)?
                        } else {
                            self.pop()
                        };
                        let sign = match v {
                            Value::Int(i) => i,
                            Value::BigInt(bi) => bi.to_i64().ok_or_else(|| self.runtime_error_with(2020, "Sort: comparator result out of range"))?,
                            Value::Error(e) => return Err(InterpretResult::RuntimeError(e)),
                            _ => return Err(self.runtime_error_with(2020, "Sort: comparator must return an integer")),
                        };
                        Ok(if sign < 0 { std::cmp::Ordering::Less } else if sign > 0 { std::cmp::Ordering::Greater } else { std::cmp::Ordering::Equal })
                    };

                    for i in 1..items.len() {
                        let mut j = i;
                        while j > 0 {
                            let ord = cmp(&items[j - 1], &items[j])?;
                            if ord == std::cmp::Ordering::Greater {
                                items.swap(j - 1, j);
                                j -= 1;
                            } else {
                                break;
                            }
                        }
                    }
                    self.stack.push(Value::Obj(Rc::new(Obj::List(items))));
                }
                OpCode::OpReduce(has_seed) => {
                    let seed = if has_seed { Some(self.pop()) } else { None };
                    let fn_val = self.pop();
                    let list_val = self.pop();

                    if matches!(list_val, Value::Nil) {
                        self.stack.push(Value::Nil);
                        return Ok(None);
                    }

                    let arity = match &fn_val {
                        Value::Obj(o) => match &**o {
                            Obj::Function(f) => f.arity,
                            Obj::NativeFn(_) => 2,
                            _ => return Err(self.runtime_error()),
                        },
                        _ => return Err(self.runtime_error()),
                    };
                    if arity != 2 && arity != 3 {
                        return Err(self.runtime_error());
                    }

                    let mut total = seed.unwrap_or(Value::Nil);
                    match &list_val {
                        Value::Obj(o) => match &**o {
                            Obj::List(items) => {
                                for (i, item) in items.iter().cloned().enumerate() {
                                    let before = self.frames.len();
                                    self.stack.push(fn_val.clone());
                                    self.stack.push(total);
                                    self.stack.push(item);
                                    if arity == 3 {
                                        self.stack.push(Value::Int(i as i64));
                                    }
                                    self.call_value(arity)?;
                                    total = if self.frames.len() > before {
                                        self.run_nested(before)?
                                    } else {
                                        self.pop()
                                    };
                                }
                            }
                            Obj::Range(r) => {
                                for i in 0..r.count {
                                    let item = Value::Int(r.start + i as i64);
                                    let before = self.frames.len();
                                    self.stack.push(fn_val.clone());
                                    self.stack.push(total);
                                    self.stack.push(item);
                                    if arity == 3 {
                                        self.stack.push(Value::Int(i as i64));
                                    }
                                    self.call_value(arity)?;
                                    total = if self.frames.len() > before {
                                        self.run_nested(before)?
                                    } else {
                                        self.pop()
                                    };
                                }
                            }
                            _ => return Err(self.runtime_error()),
                        },
                        _ => return Err(self.runtime_error()),
                    }

                    self.stack.push(total);
                }
                
                OpCode::OpClosure(idx) => {
                    let constant = {
                         let f = &self.frames[frame_idx];
                         f.function.chunk.constants[idx].clone()
                    };
                    self.stack.push(constant);
                }
                
                OpCode::OpGetLocal(slot) => {
                     let frame_slots = self.frames[frame_idx].slots;
                     let val = self.stack[frame_slots + slot].clone();
                     self.stack.push(val);
                }

    
                OpCode::OpGetGlobal(idx) => {
                     let name_val = {
                         let f = &self.frames[frame_idx];
                         f.function.chunk.constants[idx].clone()
                     };
                     let name = if let Value::Obj(o) = name_val {
                         if let crate::obj::Obj::String(s) = &*o { s.clone() } else { return Err(self.runtime_error()); }
                     } else { return Err(self.runtime_error()); };
                     let name_l = name.to_ascii_lowercase();

                     if let Some(p) = self.current_provider() {
                        if self.provider_is_defined(&p, &name) {
                            let v = self.provider_get(&p, &name);
                            self.stack.push(v);
                            return Ok(None);
                        }
                     }
                     
                     if let Some(val) = self.globals.get(&name_l) {
                         self.stack.push(val.clone());
                     } else {
                        self.stack.push(Value::Nil);
                     }
                }

                OpCode::OpGetParent(idx) => {
                    let name_val = {
                        let f = &self.frames[frame_idx];
                        f.function.chunk.constants[idx].clone()
                    };
                    let name = if let Value::Obj(o) = name_val {
                        if let crate::obj::Obj::String(s) = &*o { s.clone() } else { return Err(self.runtime_error()); }
                    } else { return Err(self.runtime_error()); };

                    if let Some(p) = self.current_provider() {
                        let parent = self.provider_parent(&p);
                        if let Some(parent) = parent {
                            let v = self.provider_get(&parent, &name);
                            self.stack.push(v);
                        } else {
                            self.stack.push(Value::Nil);
                        }
                    } else {
                        self.stack.push(Value::Nil);
                    }
                }

                OpCode::OpIndex => {
                    let index = self.pop();
                    let receiver = self.pop();
                    if let Value::Error(e) = receiver {
                        self.stack.push(Value::Error(e));
                        return Ok(None);
                    }
                    if let Value::Error(e) = index {
                        self.stack.push(Value::Error(e));
                        return Ok(None);
                    }
                    match (receiver, index) {
                        (Value::Obj(o), idx) => {
                            let i64_idx: Option<i64> = match idx {
                                Value::Int(i) => Some(i),
                                Value::Number(n) if n.is_finite() && n.fract() == 0.0 => Some(n as i64),
                                Value::BigInt(b) => b.to_i64(),
                                _ => None,
                            };
                            if let Some(i64_idx) = i64_idx {
                                let i = i64_idx as isize;
                                match &*o {
                                    Obj::List(items) => {
                                        if i < 0 || i as usize >= items.len() {
                                            self.stack.push(Value::Nil);
                                        } else {
                                            self.stack.push(items[i as usize].clone());
                                        }
                                    }
                                    Obj::Range(r) => {
                                        if i < 0 || i as usize >= r.count {
                                            self.stack.push(Value::Nil);
                                        } else {
                                            self.stack.push(Value::Int(r.start + i64_idx));
                                        }
                                    }
                                    _ => self.stack.push(Value::Nil),
                                }
                            } else {
                                self.stack.push(Value::Nil);
                            }
                        }
                        (recv, Value::Obj(o)) => match &*o {
                            Obj::String(s) => {
                                let v = self.provider_get(&recv, s);
                                self.stack.push(v);
                            }
                            _ => self.stack.push(Value::Nil),
                        },
                        _ => self.stack.push(Value::Nil),
                    }
                }

                OpCode::OpMakeProvider => {
                    let current = self.pop();
                    let parent = self.current_provider();
                    let p = ProviderObject { current, parent };
                    self.stack.push(Value::Obj(Rc::new(Obj::Provider(Rc::new(p)))));
                }

                OpCode::OpPushProvider => {
                    let p = self.pop();
                    self.providers.push(p);
                }

                OpCode::OpPopProvider => {
                    self.providers.pop();
                }

                OpCode::OpSelect(idx) => {
                    let selector_val = {
                        let f = &self.frames[frame_idx];
                        f.function.chunk.constants[idx].clone()
                    };
                    let receiver = self.pop();

                    let selector_func = match selector_val {
                        Value::Obj(o) => match &*o {
                            Obj::Function(f) => Rc::clone(f),
                            _ => return Err(self.runtime_error()),
                        },
                        _ => return Err(self.runtime_error()),
                    };

                    match receiver {
                        Value::Obj(o) => match &*o {
                            Obj::List(items) => {
                                let outer_provider = self.current_provider();
                                let mut results = Vec::with_capacity(items.len());
                                for item in items.iter().cloned() {

                                    let before = self.frames.len();
                                    self.stack.push(Value::Obj(Rc::new(Obj::Function(Rc::clone(&selector_func)))));
                                    self.stack.push(item);
                                    self.call_value(1)?;
                                    let v = self.run_nested(before)?;
                                    if outer_provider != self.current_provider() {
                                        self.providers.clear();
                                        if let Some(p) = &outer_provider {
                                            self.providers.push(p.clone());
                     }
                }
                                    results.push(v);
                                }
                                self.stack.push(Value::Obj(Rc::new(Obj::List(results))));
                            }
                            _ => {
                                let before = self.frames.len();
                                self.stack.push(Value::Obj(Rc::new(Obj::Function(Rc::clone(&selector_func)))));
                                self.stack.push(Value::Obj(o));
                                self.call_value(1)?;
                                let v = self.run_nested(before)?;
                                self.stack.push(v);
                            }
                        },
                        other => {
                            let before = self.frames.len();
                            self.stack.push(Value::Obj(Rc::new(Obj::Function(Rc::clone(&selector_func)))));
                            self.stack.push(other);
                            self.call_value(1)?;
                            let v = self.run_nested(before)?;
                            self.stack.push(v);
                        }
                    }
                }
            }
        Ok(None)
    }

    fn run_nested(&mut self, target_frames_len: usize) -> Result<Value, InterpretResult> {
        while self.frames.len() > target_frames_len {
            if let Some(v) = self.step_current()? {
                return Ok(v);
            }
        }
        Ok(self.pop())
    }

    fn provider_parent(&self, provider: &Value) -> Option<Value> {
        match provider {
            Value::Obj(o) => match &**o {
                Obj::Kvc(k) => k.borrow().parent.clone(),
                Obj::Provider(p) => p.parent.clone(),
                _ => None,
            },
            _ => None,
        }
    }

    fn provider_is_defined(&self, provider: &Value, key: &str) -> bool {
        let key_l = key.to_lowercase();
        match provider {
            Value::Obj(o) => match &**o {
                Obj::Kvc(k) => {
                    let k = k.borrow();
                    if k.entries.contains_key(&key_l) || k.cache.contains_key(&key_l) {
                        true
                    } else if let Some(parent) = &k.parent {
                        self.provider_is_defined(parent, key)
                    } else {
                        false
                    }
                }
                Obj::Provider(p) => {
                    if self.provider_is_defined(&p.current, key) {
                        true
                    } else if let Some(parent) = &p.parent {
                        self.provider_is_defined(parent, key)
                    } else {
                        false
                    }
                }
                _ => false,
            },
            _ => false,
        }
    }

    fn provider_get(&mut self, provider: &Value, key: &str) -> Value {
        let key_l = key.to_lowercase();
        match provider {
            Value::Obj(o) => match &**o {
                Obj::Kvc(k) => self.kvc_get(Rc::clone(k), &key_l, key),
                Obj::Provider(p) => {
                    if self.provider_is_defined(&p.current, key) {
                        self.provider_get(&p.current, key)
                    } else if let Some(parent) = &p.parent {
                        self.provider_get(parent, key)
                    } else {
                        Value::Nil
                    }
                }
                _ => Value::Nil,
            },
            _ => Value::Nil,
        }
    }

    fn kvc_get(&mut self, kvc: Rc<RefCell<KvcObject>>, key_l: &str, key_orig: &str) -> Value {
        if let Some(v) = kvc.borrow().cache.get(key_l) {
            return v.clone();
        }

        if kvc.borrow().evaluating.contains(key_l) {
            let parent = kvc.borrow().parent.clone();
            return parent
                .as_ref()
                .map(|p| self.provider_get(p, key_orig))
                .unwrap_or(Value::Nil);
        }

        let thunk = {
            let k = kvc.borrow();
            k.entries.get(key_l).cloned()
        };

        if let Some(func) = thunk {
            {
                kvc.borrow_mut().evaluating.insert(key_l.to_string());
            }

            let before = self.frames.len();
            self.providers.push(Value::Obj(Rc::new(Obj::Kvc(Rc::clone(&kvc)))));
            self.stack.push(Value::Obj(Rc::new(Obj::Function(Rc::clone(&func)))));
            if self.call_value(0).is_err() {
                self.providers.pop();
                kvc.borrow_mut().evaluating.remove(key_l);
                return Value::Nil;
            }

            let value = self.run_nested(before).unwrap_or(Value::Nil);

            self.providers.pop();

            {
                let mut k = kvc.borrow_mut();
                k.cache.insert(key_l.to_string(), value.clone());
                k.evaluating.remove(key_l);
            }

            return value;
        }

        let parent = kvc.borrow().parent.clone();
        parent
            .as_ref()
            .map(|p| self.provider_get(p, key_orig))
            .unwrap_or(Value::Nil)
    }

    fn merge_kvc(&mut self, left: Rc<RefCell<KvcObject>>, right: Rc<RefCell<KvcObject>>) -> Value {
    
        let left = self.normalize_for_merge(left);
        let right = self.normalize_for_merge(right);
        let parent: Option<Value> = None;

                    let mut order: Vec<String> = Vec::new();
        let mut display_names: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        let mut cache: std::collections::HashMap<String, Value> = std::collections::HashMap::new();

        let l_order = left.borrow().order.clone();
        let r_order = right.borrow().order.clone();

        let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
        for k in l_order.iter() {
            if seen.insert(k.clone()) {
                order.push(k.clone());
            }
        }
        for k in r_order.iter() {
            if seen.insert(k.clone()) {
                order.push(k.clone());
            }
        }

        {
            let l = left.borrow();
            for (k, v) in l.display_names.iter() {
                display_names.insert(k.clone(), v.clone());
            }
        }
        {
            let r = right.borrow();
            for (k, v) in r.display_names.iter() {
                display_names.insert(k.clone(), v.clone());
            }
        }

        let left_defines = |k: &String| {
            let l = left.borrow();
            l.entries.contains_key(k) || l.cache.contains_key(k)
        };
        let right_defines = |k: &String| {
            let r = right.borrow();
            r.entries.contains_key(k) || r.cache.contains_key(k)
        };

        for k in order.iter() {
            let l_defined = left_defines(k);
            let r_defined = right_defines(k);

            let merged_val = if r_defined {
                let rv = self.kvc_get(Rc::clone(&right), k, k);
                if l_defined {
                    let lv = self.kvc_get(Rc::clone(&left), k, k);
                    match (&lv, &rv) {
                        (Value::Obj(lo), Value::Obj(ro)) => match (&**lo, &**ro) {
                            (Obj::Kvc(lk), Obj::Kvc(rk)) => self.merge_kvc(Rc::clone(lk), Rc::clone(rk)),
                            _ => rv,
                        },
                        _ => rv,
                    }
                } else {
                    rv
                }
            } else if l_defined {
                self.kvc_get(Rc::clone(&left), k, k)
            } else {
                Value::Nil
            };

            cache.insert(k.clone(), merged_val);
        }

        let kvc = KvcObject {
            entries: std::collections::HashMap::new(),
            cache,
            evaluating: std::collections::HashSet::new(),
            parent,
            order,
            display_names,
        };
        Value::Obj(Rc::new(Obj::Kvc(Rc::new(RefCell::new(kvc)))))
    }

    fn normalize_for_merge(&mut self, k: Rc<RefCell<KvcObject>>) -> Rc<RefCell<KvcObject>> {
        if k.borrow().parent.is_none() {
            return k;
        }
        let order = k.borrow().order.clone();
        let display_names = k.borrow().display_names.clone();
        let mut cache = std::collections::HashMap::new();
        for key_l in order.iter() {
            let display = display_names
                .get(key_l)
                .cloned()
                .unwrap_or_else(|| key_l.clone());
            let v = self.kvc_get(Rc::clone(&k), key_l, &display);
            cache.insert(key_l.clone(), v);
        }
        Rc::new(RefCell::new(KvcObject {
            entries: std::collections::HashMap::new(),
            cache,
            evaluating: std::collections::HashSet::new(),
            parent: None,
            order,
            display_names,
        }))
    }


    fn is_numeric(v: &Value) -> bool {
        matches!(v, Value::Int(_) | Value::BigInt(_) | Value::Number(_))
    }

    fn bigint_to_value(n: BigInt) -> Value {
        match n.to_i64() {
            Some(i) => Value::Int(i),
            None => Value::BigInt(n),
        }
    }

    fn numeric_to_bigint(v: &Value) -> Option<BigInt> {
        match v {
            Value::Int(n) => Some(BigInt::from(*n)),
            Value::BigInt(n) => Some(n.clone()),
            _ => None,
        }
    }

    fn numeric_to_f64(v: &Value) -> Option<f64> {
        match v {
            Value::Number(n) => Some(*n),
            Value::Int(n) => Some(*n as f64),
            Value::BigInt(n) => n.to_f64(),
            _ => None,
        }
    }

    fn numeric_add(&self, a: Value, b: Value) -> Result<Value, InterpretResult> {
        match (a, b) {
            (Value::Int(a), Value::Int(b)) => match a.checked_add(b) {
                Some(v) => Ok(Value::Int(v)),
                None => Ok(VM::bigint_to_value(BigInt::from(a) + BigInt::from(b))),
            },
            (Value::BigInt(a), Value::BigInt(b)) => Ok(VM::bigint_to_value(a + b)),
            (Value::BigInt(a), Value::Int(b)) => Ok(VM::bigint_to_value(a + BigInt::from(b))),
            (Value::Int(a), Value::BigInt(b)) => Ok(VM::bigint_to_value(BigInt::from(a) + b)),
            (Value::Number(a), b) => {
                let bf = VM::numeric_to_f64(&b).ok_or_else(|| self.runtime_error())?;
                Ok(Value::Number(a + bf))
            }
            (a, Value::Number(b)) => {
                let af = VM::numeric_to_f64(&a).ok_or_else(|| self.runtime_error())?;
                Ok(Value::Number(af + b))
            }
            _ => Err(self.runtime_error()),
        }
    }

    fn numeric_subtract(&mut self) -> Result<(), InterpretResult> {
        let b = self.pop();
        let a = self.pop();
        let out = match (a, b) {
            (Value::Int(a), Value::Int(b)) => match a.checked_sub(b) {
                Some(v) => Value::Int(v),
                None => VM::bigint_to_value(BigInt::from(a) - BigInt::from(b)),
            },
            (Value::BigInt(a), Value::BigInt(b)) => VM::bigint_to_value(a - b),
            (Value::BigInt(a), Value::Int(b)) => VM::bigint_to_value(a - BigInt::from(b)),
            (Value::Int(a), Value::BigInt(b)) => VM::bigint_to_value(BigInt::from(a) - b),
            (Value::Number(a), b) => {
                let bf = VM::numeric_to_f64(&b).ok_or_else(|| self.runtime_error())?;
                Value::Number(a - bf)
            }
            (a, Value::Number(b)) => {
                let af = VM::numeric_to_f64(&a).ok_or_else(|| self.runtime_error())?;
                Value::Number(af - b)
            }
            _ => return Err(self.runtime_error()),
        };
        self.stack.push(out);
        Ok(())
    }

    fn numeric_multiply(&mut self) -> Result<(), InterpretResult> {
        let b = self.pop();
        let a = self.pop();
        let out = match (a, b) {
            (Value::Int(a), Value::Int(b)) => match a.checked_mul(b) {
                Some(v) => Value::Int(v),
                None => VM::bigint_to_value(BigInt::from(a) * BigInt::from(b)),
            },
            (Value::BigInt(a), Value::BigInt(b)) => VM::bigint_to_value(a * b),
            (Value::BigInt(a), Value::Int(b)) => VM::bigint_to_value(a * BigInt::from(b)),
            (Value::Int(a), Value::BigInt(b)) => VM::bigint_to_value(BigInt::from(a) * b),
            (Value::Number(a), b) => {
                let bf = VM::numeric_to_f64(&b).ok_or_else(|| self.runtime_error())?;
                Value::Number(a * bf)
            }
            (a, Value::Number(b)) => {
                let af = VM::numeric_to_f64(&a).ok_or_else(|| self.runtime_error())?;
                Value::Number(af * b)
            }
            _ => return Err(self.runtime_error()),
        };
        self.stack.push(out);
        Ok(())
    }

    fn numeric_divide(&mut self) -> Result<(), InterpretResult> {
        let b = self.pop();
        let a = self.pop();
        let out = match (a, b) {
            (Value::Int(a), Value::Int(b)) => {
                if b == 0 {
                    return Err(self.runtime_error_with(2009, "Division by zero"));
                }
                if a % b == 0 {
                    Value::Int(a / b)
                } else {
                    Value::Number(a as f64 / b as f64)
                }
            }
            (Value::BigInt(a), Value::BigInt(b)) => {
                if b == BigInt::from(0) {
                    return Err(self.runtime_error_with(2009, "Division by zero"));
                }
                let r = &a % &b;
                if r == BigInt::from(0) {
                    VM::bigint_to_value(a / b)
                } else {
                    let af = a.to_f64().ok_or_else(|| self.runtime_error_with(2010, "Division result not representable as float"))?;
                    let bf = b.to_f64().ok_or_else(|| self.runtime_error_with(2010, "Division result not representable as float"))?;
                    Value::Number(af / bf)
                }
            }
            (Value::BigInt(a), Value::Int(b)) => {
                if b == 0 {
                    return Err(self.runtime_error_with(2009, "Division by zero"));
                }
                let bb = BigInt::from(b);
                let r = &a % &bb;
                if r == BigInt::from(0) {
                    VM::bigint_to_value(a / bb)
                } else {
                    let af = a.to_f64().ok_or_else(|| self.runtime_error_with(2010, "Division result not representable as float"))?;
                    Value::Number(af / (b as f64))
                }
            }
            (Value::Int(a), Value::BigInt(b)) => {
                if b == BigInt::from(0) {
                    return Err(self.runtime_error_with(2009, "Division by zero"));
                }
                let aa = BigInt::from(a);
                let r = &aa % &b;
                if r == BigInt::from(0) {
                    VM::bigint_to_value(aa / b)
                } else {
                    let bf = b.to_f64().ok_or_else(|| self.runtime_error_with(2010, "Division result not representable as float"))?;
                    Value::Number((a as f64) / bf)
                }
            }
            (Value::Number(a), b) => {
                let bf = VM::numeric_to_f64(&b).ok_or_else(|| self.runtime_error())?;
                Value::Number(a / bf)
            }
            (a, Value::Number(b)) => {
                let af = VM::numeric_to_f64(&a).ok_or_else(|| self.runtime_error())?;
                Value::Number(af / b)
            }
            _ => return Err(self.runtime_error()),
        };
        self.stack.push(out);
        Ok(())
    }

    fn numeric_int_divide(&mut self) -> Result<(), InterpretResult> {
        let b = self.pop();
        let a = self.pop();
        let out = match (a, b) {
            (Value::Int(a), Value::Int(b)) => {
                if b == 0 {
                    return Err(self.runtime_error_with(2009, "Division by zero"));
                }
                Value::Int(a / b)
            }
            (Value::BigInt(a), Value::BigInt(b)) => {
                if b == BigInt::from(0) {
                    return Err(self.runtime_error_with(2009, "Division by zero"));
                }
                VM::bigint_to_value(a / b)
            }
            (Value::BigInt(a), Value::Int(b)) => {
                if b == 0 {
                    return Err(self.runtime_error_with(2009, "Division by zero"));
                }
                VM::bigint_to_value(a / BigInt::from(b))
            }
            (Value::Int(a), Value::BigInt(b)) => {
                if b == BigInt::from(0) {
                    return Err(self.runtime_error_with(2009, "Division by zero"));
                }
                VM::bigint_to_value(BigInt::from(a) / b)
            }
            (Value::Number(_), _) | (_, Value::Number(_)) => {
                return Err(self.runtime_error_with(2012, "div: integer parameters expected"));
            }
            _ => return Err(self.runtime_error_with(2012, "div: integer parameters expected")),
        };
        self.stack.push(out);
        Ok(())
    }

    fn numeric_modulo(&mut self) -> Result<(), InterpretResult> {
        let b = self.pop();
        let a = self.pop();
        let out = match (a, b) {
            (Value::Int(a), Value::Int(b)) => {
                if b == 0 { return Err(self.runtime_error_with(2013, "Modulo by zero")); }
                Value::Int(a % b)
            }
            (Value::BigInt(a), Value::BigInt(b)) => {
                if b == BigInt::from(0) { return Err(self.runtime_error_with(2013, "Modulo by zero")); }
                VM::bigint_to_value(a % b)
            }
            (Value::BigInt(a), Value::Int(b)) => {
                if b == 0 { return Err(self.runtime_error_with(2013, "Modulo by zero")); }
                VM::bigint_to_value(a % BigInt::from(b))
            }
            (Value::Int(a), Value::BigInt(b)) => {
                if b == BigInt::from(0) { return Err(self.runtime_error_with(2013, "Modulo by zero")); }
                VM::bigint_to_value(BigInt::from(a) % b)
            }
            (Value::Number(a), b) => {
                let bf = VM::numeric_to_f64(&b).ok_or_else(|| self.runtime_error())?;
                Value::Number(a % bf)
            }
            (a, Value::Number(b)) => {
                let af = VM::numeric_to_f64(&a).ok_or_else(|| self.runtime_error())?;
                Value::Number(af % b)
            }
            _ => return Err(self.runtime_error_with(2014, "%: number expected")),
        };
        self.stack.push(out);
        Ok(())
    }

    fn numeric_pow(&mut self) -> Result<(), InterpretResult> {
        let b = self.pop();
        let a = self.pop();
        let af = VM::numeric_to_f64(&a).ok_or_else(|| self.runtime_error_with(2021, "^: number expected"))?;
        let bf = VM::numeric_to_f64(&b).ok_or_else(|| self.runtime_error_with(2021, "^: number expected"))?;
        self.stack.push(Value::Number(af.powf(bf)));
        Ok(())
    }

    fn numeric_negate(&self, v: Value) -> Result<Value, InterpretResult> {
        match v {
            Value::Int(n) => match n.checked_neg() {
                Some(v) => Ok(Value::Int(v)),
                None => Ok(Value::BigInt(-BigInt::from(n))),
            },
            Value::BigInt(n) => Ok(Value::BigInt(-n)),
            Value::Number(n) => Ok(Value::Number(-n)),
            _ => Err(self.runtime_error()),
        }
    }

    fn numeric_compare_gt(&self, a: &Value, b: &Value) -> Result<bool, InterpretResult> {
        if let (Some(ai), Some(bi)) = (VM::numeric_to_bigint(a), VM::numeric_to_bigint(b)) {
            return Ok(ai > bi);
        }
        let af = VM::numeric_to_f64(a).ok_or_else(|| self.runtime_error())?;
        let bf = VM::numeric_to_f64(b).ok_or_else(|| self.runtime_error())?;
        Ok(af > bf)
    }

    fn numeric_compare_lt(&self, a: &Value, b: &Value) -> Result<bool, InterpretResult> {
        if let (Some(ai), Some(bi)) = (VM::numeric_to_bigint(a), VM::numeric_to_bigint(b)) {
            return Ok(ai < bi);
        }
        let af = VM::numeric_to_f64(a).ok_or_else(|| self.runtime_error())?;
        let bf = VM::numeric_to_f64(b).ok_or_else(|| self.runtime_error())?;
        Ok(af < bf)
    }

    fn call_value(&mut self, arg_count: usize) -> Result<(), InterpretResult> {
        let function_val_idx = self.stack.len() - 1 - arg_count;
        let function_val = self.stack[function_val_idx].clone();

        if let Value::Obj(obj) = function_val {
            match &*obj {
                crate::obj::Obj::NativeFn(native) => {
                    let start_idx = self.stack.len() - arg_count;
                    let args = &self.stack[start_idx..];
                    let result = native(args);
                    self.stack.truncate(function_val_idx); 
                    self.stack.push(result);
                    Ok(())
                },
                crate::obj::Obj::Function(func) => {
                    if self.frames.len() == FRAMES_MAX {
                        return Err(self.runtime_error()); 
                    }
                    if arg_count > func.arity {
                        return Err(self.runtime_error_with(
                            2004,
                            format!(
                                "Call arity mismatch for '{}': expected {} arguments but got {}",
                                func.name, func.arity, arg_count
                            ),
                        ));
                    }

                    // C# parity: allow calling with fewer args; missing parameters evaluate as nil/null.
                    // This is important for examples like `(name) => "Hello " + name` being invoked as `f()`.
                    if arg_count < func.arity {
                        for _ in arg_count..func.arity {
                            self.stack.push(Value::Nil);
                        }
                    }
                    
                    let slots = function_val_idx;
                    self.frames.push(CallFrame::new(Rc::clone(func), slots));
                    Ok(())
                },
                _ => {
                    Err(self.runtime_error_with(2005, "Can only call functions"))
                },
            }
        } else {
            Err(self.runtime_error_with(2005, "Can only call functions"))
        }
    }

    fn values_equal(&mut self, a: &Value, b: &Value) -> bool {
        match (a, b) {
             (Value::Int(a), Value::Int(b)) => a == b,
             (Value::BigInt(a), Value::BigInt(b)) => a == b,
             (Value::Int(a), Value::BigInt(b)) => BigInt::from(*a) == *b,
             (Value::BigInt(a), Value::Int(b)) => *a == BigInt::from(*b),
             (Value::Number(n1), Value::Number(n2)) => (n1 - n2).abs() < f64::EPSILON,
             (Value::Int(i), Value::Number(n)) | (Value::Number(n), Value::Int(i)) => {
                 if !n.is_finite() || n.fract() != 0.0 { return false; }
                 if *n < (i64::MIN as f64) || *n > (i64::MAX as f64) { return false; }
                 *i == (*n as i64)
             }
             (Value::BigInt(bi), Value::Number(n)) | (Value::Number(n), Value::BigInt(bi)) => {
                 if !n.is_finite() || n.fract() != 0.0 { return false; }
                 match bi.to_i64() {
                     Some(i) => {
                         if *n < (i64::MIN as f64) || *n > (i64::MAX as f64) { return false; }
                         i == (*n as i64)
                     }
                     None => false,
                 }
             }
             (Value::Bool(b1), Value::Bool(b2)) => b1 == b2,
             (Value::Nil, Value::Nil) => true,
             (Value::Error(e1), Value::Error(e2)) => e1 == e2,
             (Value::Obj(o1), Value::Obj(o2)) => match (&**o1, &**o2) {
                 (Obj::String(a), Obj::String(b)) => a == b,
                 (Obj::List(a), Obj::List(b)) => {
                     if a.len() != b.len() { return false; }
                     for (x, y) in a.iter().zip(b.iter()) {
                         if !self.values_equal(x, y) { return false; }
                     }
                     true
                 }
                 (Obj::Kvc(k1), Obj::Kvc(k2)) => self.kvc_values_equal(Rc::clone(k1), Rc::clone(k2)),
                 _ => o1 == o2,
             },
             _ => false,
        }
    }

    fn kvc_values_equal(&mut self, k1: Rc<RefCell<KvcObject>>, k2: Rc<RefCell<KvcObject>>) -> bool {
        let mut keys: std::collections::HashSet<String> = std::collections::HashSet::new();
        {
            let a = k1.borrow();
            for k in a.order.iter() { keys.insert(k.clone()); }
            for k in a.entries.keys() { keys.insert(k.clone()); }
            for k in a.cache.keys() { keys.insert(k.clone()); }
        }
        {
            let b = k2.borrow();
            for k in b.order.iter() { keys.insert(k.clone()); }
            for k in b.entries.keys() { keys.insert(k.clone()); }
            for k in b.cache.keys() { keys.insert(k.clone()); }
        }

        let k1_keys: std::collections::HashSet<String> = {
            let a = k1.borrow();
            a.entries.keys()
                .cloned()
                .chain(a.cache.keys().cloned())
                .collect()
        };
        let k2_keys: std::collections::HashSet<String> = {
            let b = k2.borrow();
            b.entries.keys()
                .cloned()
                .chain(b.cache.keys().cloned())
                .collect()
        };
        if k1_keys != k2_keys {
            return false;
        }

        for k in keys.into_iter() {
            let v1 = self.kvc_get(Rc::clone(&k1), &k, &k);
            let v2 = self.kvc_get(Rc::clone(&k2), &k, &k);
            if !self.values_equal(&v1, &v2) {
                return false;
            }
        }
        true
    }

    pub fn interpret(&mut self, source: &str) -> Result<Value, InterpretResult> {
        self.frames.clear();
        self.stack.clear();
        self.providers.clear();
        let mut compiler = Compiler::new(source);
        match compiler.compile() {
            Ok(function) => {
            let func = Rc::new(function);
            self.frames.push(CallFrame::new(func, 0));
            self.run()
            }
            Err(e) => Err(InterpretResult::CompileError(e)),
        }
    }

    pub fn eval_result_json(&mut self, source: &str) -> String {
        match self.interpret(source) {
            Ok(v) => format!(
                "{{\"ok\":true,\"value\":{},\"error\":null}}",
                self.value_to_json(&v)
            ),
            Err(InterpretResult::CompileError(e)) => format!(
                "{{\"ok\":false,\"value\":null,\"error\":{}}}",
                self.error_to_json(&e, "compile")
            ),
            Err(InterpretResult::RuntimeError(e)) => format!(
                "{{\"ok\":false,\"value\":null,\"error\":{}}}",
                self.error_to_json(&e, "runtime")
            ),
        }
    }

    fn json_escape(s: &str) -> String {
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

    fn value_to_json(&mut self, v: &Value) -> String {
        match v {
            Value::Nil => "null".to_string(),
            Value::Bool(b) => if *b { "true".to_string() } else { "false".to_string() },
            Value::Int(n) => n.to_string(),
            Value::BigInt(n) => n.to_string(),
            Value::Number(n) => {
                if n.is_finite() { n.to_string() } else { "null".to_string() }
            }
            Value::Error(e) => self.error_to_json(e, "value"),
            Value::Obj(o) => match &**o {
                Obj::String(s) => format!("\"{}\"", VM::json_escape(s)),
                Obj::List(items) => {
                    let parts: Vec<String> = items.iter().map(|x| self.value_to_json(x)).collect();
                    format!("[{}]", parts.join(","))
                }
                Obj::Range(r) => format!(
                    "{{\"type\":\"range\",\"start\":{},\"count\":{}}}",
                    r.start, r.count
                ),
                Obj::Bytes(b) => {
                    let s = general_purpose::STANDARD.encode(b);
                    format!("{{\"type\":\"bytes\",\"base64\":\"{}\"}}", VM::json_escape(&s))
                }
                Obj::Guid(g) => format!("{{\"type\":\"guid\",\"value\":\"{}\"}}", VM::json_escape(&g.to_string())),
                Obj::DateTimeTicks(ticks) => {
                    // Provide ticks always; iso is best-effort conversion (UTC) for convenience.
                    const UNIX_EPOCH_TICKS: i64 = 621_355_968_000_000_000;
                    const TICKS_PER_SEC: i64 = 10_000_000;
                    let iso = if *ticks >= UNIX_EPOCH_TICKS {
                        let dt_ticks = ticks - UNIX_EPOCH_TICKS;
                        let secs = dt_ticks / TICKS_PER_SEC;
                        let rem = dt_ticks % TICKS_PER_SEC;
                        let nanos = (rem * 100) as u32;
                        match time::OffsetDateTime::from_unix_timestamp(secs)
                            .and_then(|d| d.replace_nanosecond(nanos))
                        {
                            Ok(d) => d.format(&time::format_description::well_known::Rfc3339).ok(),
                            Err(_) => None,
                        }
                    } else {
                        None
                    };
                    if let Some(iso) = iso {
                        format!("{{\"type\":\"datetime\",\"ticks\":{},\"iso\":\"{}\"}}", ticks, VM::json_escape(&iso))
                    } else {
                        format!("{{\"type\":\"datetime\",\"ticks\":{}}}", ticks)
                    }
                }
                Obj::Kvc(k) => self.kvc_to_json(Rc::clone(k)),
                Obj::Provider(p) => {
                    self.value_to_json(&p.current)
                }
                Obj::Function(f) => {
                    format!("{{\"type\":\"function\",\"name\":\"{}\",\"arity\":{}}}",
                        VM::json_escape(&f.name),
                        f.arity)
                }
                Obj::NativeFn(_) => "{\"type\":\"native\"}".to_string(),
            }
        }
    }

    pub fn value_to_json_string(&mut self, v: &Value) -> String {
        self.value_to_json(v)
    }

    fn error_to_json(&self, e: &FsError, kind: &str) -> String {
        format!(
            "{{\"kind\":\"{}\",\"code\":{},\"message\":\"{}\",\"line\":{},\"column\":{}}}",
            VM::json_escape(kind),
            e.code,
            VM::json_escape(&e.message),
            e.line,
            e.column
        )
    }

    fn runtime_error(&self) -> InterpretResult {
        self.runtime_error_with(2000, "Runtime error")
    }

    fn runtime_error_with(&self, code: u32, message: impl Into<String>) -> InterpretResult {
        InterpretResult::RuntimeError(FsError {
            code,
            message: message.into(),
            line: -1,
            column: -1,
        })
    }

    fn kvc_to_json(&mut self, k: Rc<RefCell<KvcObject>>) -> String {
        let order = k.borrow().order.clone();
        let mut parts: Vec<String> = Vec::with_capacity(order.len());
        for key_l in order {
            let display = {
                let b = k.borrow();
                b.display_names.get(&key_l).cloned().unwrap_or_else(|| key_l.clone())
            };
            let val = self.kvc_get(Rc::clone(&k), &key_l, &display);
            parts.push(format!("\"{}\":{}", VM::json_escape(&display), self.value_to_json(&val)));
        }
        format!("{{{}}}", parts.join(","))
    }

    fn is_falsey(&self, value: &Value) -> bool {
        match value {
            Value::Nil => true,
            Value::Bool(b) => !*b,
            Value::Error(_) => true,
            _ => false,
        }
    }

    fn peek(&self, distance: usize) -> Value {
        self.stack[self.stack.len() - 1 - distance].clone()
    }

    fn pop(&mut self) -> Value {
        self.stack.pop().expect("Stack underflow")
    }
}
