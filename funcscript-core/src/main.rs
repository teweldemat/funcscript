//! Minimal CLI wrapper around the Rust core VM.
//! Prints `Result: ...` or `Error: ...`.

use funcscript_core::vm::VM;
fn main() {
    let source = std::env::args().skip(1).collect::<Vec<_>>().join(" ");
    let source = if !source.trim().is_empty() {
        source
    } else {
        use std::io::Read;
        let mut buf = String::new();
        if std::io::stdin().read_to_string(&mut buf).is_ok() && !buf.trim().is_empty() {
            buf
        } else {
            "If(true, 10, 20)".to_string()
        }
    };
    let mut vm = VM::new();
    match vm.interpret(&source) {
        Ok(value) => println!("Result: {}", value),
        Err(e) => println!("Error: {:?}", e),
    }
}
