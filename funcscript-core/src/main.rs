//! FuncScript CLI / REPL for the Rust core VM.
//!
//! - `fs 'code'` evaluates one expression and exits
//! - `fs` starts an interactive REPL

use funcscript::host;
use funcscript::scanner::{Scanner, TokenType};
use funcscript::vm::{InterpretResult, VM};
use std::io::{self, IsTerminal, Read, Write};
use std::sync::Arc;

fn main() {

    let mut callbacks = host::std_fs_callbacks();
    callbacks.log_line = Some(Arc::new(|line| eprintln!("{line}")));
    let _guard = host::push(callbacks);

    let args = std::env::args().skip(1).collect::<Vec<_>>();
    let mut vm = VM::new();

    if args.len() == 1 && (args[0] == "--repl" || args[0] == "-i") {
        repl(&mut vm);
        return;
    }

    if args.len() >= 2 && (args[0] == "--eval" || args[0] == "-e") {
        let source = args[1..].join(" ");
        run_once(&mut vm, &source);
        return;
    }

    if !args.is_empty() {
        let source = args.join(" ");
        run_once(&mut vm, &source);
        return;
    }

    if !io::stdin().is_terminal() {
        let mut buf = String::new();
        if io::stdin().read_to_string(&mut buf).is_ok() && !buf.trim().is_empty() {
            run_once(&mut vm, &buf);
        }
        return;
    }

    repl(&mut vm);
}

fn run_once(vm: &mut VM, source: &str) {
    match vm.interpret(source) {
        Ok(value) => println!("Result: {}", value),
        Err(InterpretResult::CompileError(e)) => eprintln!(
            "CompileError[{}] (line {}, col {}): {}",
            e.code, e.line, e.column, e.message
        ),
        Err(InterpretResult::RuntimeError(e)) => eprintln!(
            "RuntimeError[{}] (line {}, col {}): {}",
            e.code, e.line, e.column, e.message
        ),
    }
}

fn repl(vm: &mut VM) {
    let stdin = io::stdin();
    let mut out = io::stdout();
    let mut buf = String::new();

    println!("FuncScript REPL");
    println!("  - Enter an expression to evaluate");
    println!("  - Use :q / :quit / exit to quit");
    println!("  - Multiline input is supported for unbalanced (), [], {{}} and unterminated strings/templates");
    let _ = out.flush();

    loop {
        if buf.trim().is_empty() {
            print!("fs> ");
        } else {
            print!("... ");
        }
        let _ = out.flush();

        let mut line = String::new();
        let read = stdin.read_line(&mut line).unwrap_or(0);
        if read == 0 {
            break;
        }

        let line_trimmed = line.trim_end_matches(['\n', '\r']);

        if buf.trim().is_empty() {
            let cmd = line_trimmed.trim();
            if cmd == ":q" || cmd == ":quit" || cmd == "exit" {
                break;
            }
            if cmd == ":help" {
                eprintln!(":q / :quit / exit  Quit");
                eprintln!(":help              Show this help");
                continue;
            }
        }

        buf.push_str(line_trimmed);
        buf.push('\n');

        if needs_more_input(&buf) {
            continue;
        }

        let src = buf.trim();
        if src.is_empty() {
            buf.clear();
            continue;
        }

        match vm.interpret(src) {
            Ok(value) => println!("=> {}", value),
            Err(InterpretResult::CompileError(e)) => eprintln!(
                "CompileError[{}] (line {}, col {}): {}",
                e.code, e.line, e.column, e.message
            ),
            Err(InterpretResult::RuntimeError(e)) => eprintln!(
                "RuntimeError[{}] (line {}, col {}): {}",
                e.code, e.line, e.column, e.message
            ),
        }

        buf.clear();
    }
}

fn needs_more_input(source: &str) -> bool {
    let mut scanner = Scanner::new(source);
    let mut braces: i32 = 0;
    let mut parens: i32 = 0;
    let mut brackets: i32 = 0;
    loop {
        let t = scanner.scan_token();
        match t.kind {
            TokenType::LeftBrace => braces += 1,
            TokenType::RightBrace => braces -= 1,
            TokenType::LeftParen => parens += 1,
            TokenType::RightParen => parens -= 1,
            TokenType::LeftBracket => brackets += 1,
            TokenType::RightBracket => brackets -= 1,
            TokenType::Error => {
                if t.start.starts_with("Unterminated") {
                    return true;
                }
            }
            TokenType::Eof => break,
            _ => {}
        }
    }
    braces > 0 || parens > 0 || brackets > 0
}
