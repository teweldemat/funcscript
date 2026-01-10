//! Bytecode opcodes and `Chunk` container used by the VM.

use crate::value::Value;

#[derive(Debug, Clone, Copy)]
pub enum OpCode {
    OpConstant(usize),
    OpAdd,
    OpSubtract,
    OpMultiply,
    OpDivide,
    OpIntDiv,
    OpModulo,
    OpPow,
    OpNegate,
    OpReturn,
    OpBuildList(usize),
    OpCall(usize),
    OpGetGlobal(usize),
    OpGetParent(usize),
    OpJump(usize),
    OpJumpIfFalse(usize),
    OpJumpIfNil(usize),
    OpPop,
    OpDup,
    OpSwap,
    OpEqual,
    OpGreater,
    OpLess,
    OpNot,
    OpBuildKvc(usize),
    OpGetProp(usize),
    OpClosure(usize),
    OpGetLocal(usize),
    OpIndex,
    OpMakeProvider,
    OpPushProvider,
    OpPopProvider,
    OpSelect(usize),
    OpMap,
    OpFilter,
    OpAny,
    OpFirstWhere,
    OpSort,
    OpReduce(bool),
}

#[derive(Debug, Clone)]
pub struct Chunk {
    pub code: Vec<OpCode>,
    pub constants: Vec<Value>,
}

impl Chunk {
    pub fn new() -> Self {
        Chunk {
            code: Vec::new(),
            constants: Vec::new(),
        }
    }

    pub fn write(&mut self, op: OpCode) {
        self.code.push(op);
    }

    pub fn add_constant(&mut self, value: Value) -> usize {
        self.constants.push(value);
        self.constants.len() - 1
    }
}
