//! Runtime value representation and structured error type.

use std::rc::Rc;
use crate::obj::Obj;

#[derive(Debug, Clone, PartialEq)]
pub struct FsError {
    pub code: u32,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Bool(bool),
    Nil,
    Number(f64),
    Obj(Rc<Obj>),
    Error(FsError),
}

impl std::fmt::Display for Value {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            Value::Bool(b) => write!(f, "{}", b),
            Value::Nil => write!(f, "nil"),
            Value::Number(n) => write!(f, "{}", n),
            Value::Obj(o) => write!(f, "{}", o),
            Value::Error(e) => write!(f, "Error({}): {}", e.code, e.message),
        }
    }
}

