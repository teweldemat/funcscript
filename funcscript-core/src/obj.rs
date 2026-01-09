//! Heap-allocated object types used by the FuncScript VM.

use crate::value::Value;
use std::collections::HashMap;
use std::cell::RefCell;
use std::collections::HashSet;
use std::rc::Rc;

use crate::chunk::Chunk;

#[derive(Debug, Clone)]
pub struct FsFunction {
    pub arity: usize,
    pub chunk: Chunk,
    pub name: String,
}

impl PartialEq for FsFunction {
    fn eq(&self, _other: &Self) -> bool {
        false 
    }
}

#[derive(Debug, Clone)]
pub enum Obj {
    String(String),
    List(Vec<Value>),
    Range(RangeObject),

    Kvc(Rc<RefCell<KvcObject>>),
   
    Provider(Rc<ProviderObject>),
    Function(std::rc::Rc<FsFunction>),

    NativeFn(fn(&[Value]) -> Value),
}

#[derive(Debug, Clone, PartialEq)]
pub struct RangeObject {
    pub start: i64,
    pub count: usize,
}

#[derive(Debug)]
pub struct ProviderObject {
    pub current: Value,
    pub parent: Option<Value>,
}

#[derive(Debug)]
pub struct KvcObject {
    pub entries: HashMap<String, Rc<FsFunction>>, 
    pub cache: HashMap<String, Value>,           
    pub evaluating: HashSet<String>,           
    pub parent: Option<Value>,                    
    pub order: Vec<String>,                       
    pub display_names: HashMap<String, String>,   
}

impl PartialEq for Obj {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (Obj::String(a), Obj::String(b)) => a == b,
            (Obj::List(a), Obj::List(b)) => a == b,
            (Obj::Range(a), Obj::Range(b)) => a == b,
            (Obj::Kvc(_), Obj::Kvc(_)) => false,
            (Obj::Provider(_), Obj::Provider(_)) => false,
            (Obj::NativeFn(a), Obj::NativeFn(b)) => {
                std::ptr::eq(*a as *const (), *b as *const ())
            }
            _ => false,
        }
    }
}

impl std::fmt::Display for Obj {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            Obj::String(s) => write!(f, "{}", s),
            Obj::List(l) => {
                let s: Vec<String> = l.iter().map(|v| v.to_string()).collect();
                write!(f, "[{}]", s.join(", "))
            },
            Obj::Range(r) => write!(f, "<range start={} count={}>", r.start, r.count),
            Obj::Kvc(kvc) => {
                let kvc = kvc.borrow();
                write!(f, "{{ ")?;
                let mut first = true;
                for k in kvc.order.iter() {
                    if !first { write!(f, ", ")?; }
                    first = false;
                    let display = kvc.display_names.get(k).map(|s| s.as_str()).unwrap_or(k.as_str());
                    if let Some(v) = kvc.cache.get(k) {
                        write!(f, "{}: {}", display, v)?;
                    } else {
                        write!(f, "{}: <lazy>", display)?;
                    }
                }
                write!(f, " }}")
            }
            Obj::Provider(_) => write!(f, "<provider>"),
            Obj::Function(func) => write!(f, "<fn {}>", func.name),
            Obj::NativeFn(_) => write!(f, "<native fn>"),
        }
    }
}
