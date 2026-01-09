//! Stack-based bytecode VM for FuncScript core.
//!
//! Key points:
//! - `providers` implements the FuncScript scoping/provider chain (for KVC + selectors).
//! - `Obj::Range` is lazy to avoid allocating huge lists for `Range(start,count)`.
//! - Many operations return `Value::Error` instead of panicking to keep scripts safe.

use crate::chunk::OpCode;
use crate::value::Value;

#[derive(Debug)]
pub enum InterpretResult {
    CompileError,
    RuntimeError,
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
        }
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
                        (Value::Number(a), Value::Number(b)) => self.stack.push(Value::Number(a + b)),
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
                                _ => return Err(InterpretResult::RuntimeError),
                            }
                        },
                        _ => return Err(InterpretResult::RuntimeError),
                    }
                }
                OpCode::OpSubtract => self.binary_op(|a, b| a - b)?,
                OpCode::OpMultiply => self.binary_op(|a, b| a * b)?,
                OpCode::OpDivide => self.binary_op(|a, b| a / b)?,
                OpCode::OpNegate => {
                     match self.pop() {
                        Value::Number(n) => self.stack.push(Value::Number(-n)),
                         _ => return Err(InterpretResult::RuntimeError),
                    }
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
                OpCode::OpPop => {
                    self.pop();
                }
            OpCode::OpDup => {
                let v = self.peek(0);
                self.stack.push(v);
            }
            OpCode::OpSwap => {
                if self.stack.len() < 2 {
                    return Err(InterpretResult::RuntimeError);
                }
                let len = self.stack.len();
                self.stack.swap(len - 1, len - 2);
            }
                OpCode::OpNot => {
                    let value = self.pop();
                    self.stack.push(Value::Bool(self.is_falsey(&value)));
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
                    match (a, b) {
                        (Value::Number(n1), Value::Number(n2)) => self.stack.push(Value::Bool(n1 > n2)),
                        _ => return Err(InterpretResult::RuntimeError),
                    }
                }
                OpCode::OpLess => {
                    let b = self.pop();
                    let a = self.pop();
                    match (a, b) {
                        (Value::Number(n1), Value::Number(n2)) => self.stack.push(Value::Bool(n1 < n2)),
                        _ => return Err(InterpretResult::RuntimeError),
                    }
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
                                _ => return Err(InterpretResult::RuntimeError),
                            },
                            _ => return Err(InterpretResult::RuntimeError),
                        };

                        let thunk = match thunk {
                            Value::Obj(o) => match &*o {
                                Obj::Function(f) => Rc::clone(f),
                                _ => return Err(InterpretResult::RuntimeError),
                            },
                            _ => return Err(InterpretResult::RuntimeError),
                        };

                        let k = key.to_lowercase();
                        entries.insert(k.clone(), thunk);
                        display_names.insert(k.clone(), key);
                        order.push(k);
                    }

                    let parent = self.current_provider();
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
                         if let crate::obj::Obj::String(s) = &*o { s.clone() } else { return Err(InterpretResult::RuntimeError); }
                     } else { return Err(InterpretResult::RuntimeError); };

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

                    let mut out: Vec<Value> = Vec::new();
                    match &list_val {
                        Value::Obj(o) => match &**o {
                            Obj::List(items) => {
                                out.reserve(items.len());
                                for item in items.iter().cloned() {
                                    let before = self.frames.len();
                                    self.stack.push(fn_val.clone());
                                    self.stack.push(item);
                                    self.call_value(1)?;
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
                                    let item = Value::Number((r.start + i as i64) as f64);
                                    let before = self.frames.len();
                                    self.stack.push(fn_val.clone());
                                    self.stack.push(item);
                                    self.call_value(1)?;
                                    let v = if self.frames.len() > before {
                                        self.run_nested(before)?
                                    } else {
                                        self.pop()
                                    };
                                    out.push(v);
                                }
                            }
                            _ => return Err(InterpretResult::RuntimeError),
                        },
                        _ => return Err(InterpretResult::RuntimeError),
                    }
                    self.stack.push(Value::Obj(Rc::new(Obj::List(out))));
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
                            Obj::NativeFn(_) => 2, // not expected
                            _ => return Err(InterpretResult::RuntimeError),
                        },
                        _ => return Err(InterpretResult::RuntimeError),
                    };
                    if arity != 2 && arity != 3 {
                        return Err(InterpretResult::RuntimeError);
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
                                        self.stack.push(Value::Number(i as f64));
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
                                    let item = Value::Number((r.start + i as i64) as f64);
                                    let before = self.frames.len();
                                    self.stack.push(fn_val.clone());
                                    self.stack.push(total);
                                    self.stack.push(item);
                                    if arity == 3 {
                                        self.stack.push(Value::Number(i as f64));
                                    }
                                    self.call_value(arity)?;
                                    total = if self.frames.len() > before {
                                        self.run_nested(before)?
                                    } else {
                                        self.pop()
                                    };
                                }
                            }
                            _ => return Err(InterpretResult::RuntimeError),
                        },
                        _ => return Err(InterpretResult::RuntimeError),
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
                         if let crate::obj::Obj::String(s) = &*o { s.clone() } else { return Err(InterpretResult::RuntimeError); }
                     } else { return Err(InterpretResult::RuntimeError); };

                     if let Some(p) = self.current_provider() {
                        if self.provider_is_defined(&p, &name) {
                            let v = self.provider_get(&p, &name);
                            self.stack.push(v);
                            return Ok(None);
                        }
                     }
                     
                     if let Some(val) = self.globals.get(&name) {
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
                        if let crate::obj::Obj::String(s) = &*o { s.clone() } else { return Err(InterpretResult::RuntimeError); }
                    } else { return Err(InterpretResult::RuntimeError); };

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
                        (Value::Obj(o), Value::Number(n)) => match &*o {
                            Obj::List(items) => {
                                let i = n as isize;
                                if i < 0 || i as usize >= items.len() {
                                    self.stack.push(Value::Nil);
                                } else {
                                    self.stack.push(items[i as usize].clone());
                                }
                            }
                            Obj::Range(r) => {
                                let i = n as isize;
                                if i < 0 || i as usize >= r.count {
                                    self.stack.push(Value::Nil);
                                } else {
                                    let v = r.start + i as i64;
                                    self.stack.push(Value::Number(v as f64));
                                }
                            }
                            _ => self.stack.push(Value::Nil),
                        },
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
                            _ => return Err(InterpretResult::RuntimeError),
                        },
                        _ => return Err(InterpretResult::RuntimeError),
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
                    k.entries.contains_key(&key_l) || k.cache.contains_key(&key_l)
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


    fn binary_op<F>(&mut self, op: F) -> Result<(), InterpretResult>
    where
        F: Fn(f64, f64) -> f64,
    {
        let b = self.pop();
        let a = self.pop();
        match (a, b) {
            (Value::Number(a), Value::Number(b)) => {
                self.stack.push(Value::Number(op(a, b)));
                Ok(())
            }
            _ => Err(InterpretResult::RuntimeError),
        }
    }

    fn call_value(&mut self, arg_count: usize) -> Result<(), InterpretResult> {
        let function_val_idx = self.stack.len() - 1 - arg_count;
        let function_val = self.stack[function_val_idx].clone();

        if let Value::Obj(obj) = function_val {
            match &*obj {
                crate::obj::Obj::NativeFn(native) => {
                    if std::env::var("FS_TRACE_CALL").is_ok() {
                        eprintln!("[call] native arg_count={}", arg_count);
                    }
                    let start_idx = self.stack.len() - arg_count;
                    let args = &self.stack[start_idx..];
                    let result = native(args);
                    self.stack.truncate(function_val_idx); 
                    self.stack.push(result);
                    Ok(())
                },
                crate::obj::Obj::Function(func) => {
                    if std::env::var("FS_TRACE_CALL").is_ok() {
                        eprintln!(
                            "[call] fn='{}' arity={} arg_count={}",
                            func.name, func.arity, arg_count
                        );
                    }
                    if self.frames.len() == FRAMES_MAX {
                        return Err(InterpretResult::RuntimeError); 
                    }
                    if arg_count != func.arity {
                        println!(
                            "Call arity mismatch for '{}': expected {} arguments but got {}.",
                            func.name, func.arity, arg_count
                        );
                        return Err(InterpretResult::RuntimeError);
                    }
                    
                    let slots = function_val_idx;
                    self.frames.push(CallFrame::new(Rc::clone(func), slots));
                    Ok(())
                },
                _ => {
                    println!("Can only call functions and classes.");
                    Err(InterpretResult::RuntimeError)
                },
            }
        } else {
            println!("Can only call functions and classes.");
            Err(InterpretResult::RuntimeError)
        }
    }

    fn values_equal(&mut self, a: &Value, b: &Value) -> bool {
        match (a, b) {
             (Value::Number(n1), Value::Number(n2)) => (n1 - n2).abs() < f64::EPSILON,
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
        let mut compiler = Compiler::new(source);
        if let Some(function) = compiler.compile() {
            let func = Rc::new(function);
            self.frames.push(CallFrame::new(func, 0));
            self.run()
        } else {
            Err(InterpretResult::CompileError)
        }
    }

    pub fn eval_result_json(&mut self, source: &str) -> String {
        match self.interpret(source) {
            Ok(v) => format!(
                "{{\"ok\":true,\"value\":{},\"error\":null}}",
                self.value_to_json(&v)
            ),
            Err(InterpretResult::CompileError) => {
                "{\"ok\":false,\"value\":null,\"error\":\"CompileError\"}".to_string()
            }
            Err(InterpretResult::RuntimeError) => {
                "{\"ok\":false,\"value\":null,\"error\":\"RuntimeError\"}".to_string()
            }
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
            Value::Number(n) => {
                if n.is_finite() { n.to_string() } else { "null".to_string() }
            }
            Value::Error(e) => format!(
                "{{\"type\":\"error\",\"code\":{},\"message\":\"{}\"}}",
                e.code,
                VM::json_escape(&e.message)
            ),
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
