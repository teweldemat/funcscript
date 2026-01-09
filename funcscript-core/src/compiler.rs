//! Bytecode compiler for FuncScript core.
//!
//! Produces a `FsFunction` (top-level "script") containing a `Chunk` of opcodes.
//! The VM is stack-based; control flow uses `OpJump*` patching.

use crate::chunk::{Chunk, OpCode};
use crate::scanner::{Scanner, Token, TokenType};
use crate::value::Value;
use crate::obj::FsFunction;
use std::rc::Rc;

pub struct Parser<'a> {
    pub current: Token<'a>,
    pub previous: Token<'a>,
    pub had_error: bool,
    pub panic_mode: bool,
}

pub struct Compiler<'a> {
    parser: Parser<'a>,
    scanner: Scanner<'a>,

    compilers: Vec<FunctionCompiler>,
}

pub struct FunctionCompiler {
    pub function: FsFunction,
    pub chunk: Chunk,
    pub locals: Vec<Local>,
}

pub struct Local {
    pub name: String,
    pub depth: i32,
}

impl FunctionCompiler {
    fn new(name: String) -> Self {
        Self {
            function: FsFunction {
                arity: 0,
                chunk: Chunk::new(),
                name,
            },
            chunk: Chunk::new(),
            locals: Vec::new(),
        }
    }
}

impl<'a> Compiler<'a> {
    pub fn new(source: &'a str) -> Self {
        let scanner = Scanner::new(source);
        let main_compiler = FunctionCompiler::new("script".to_string());
        
        Compiler {
            parser: Parser {
                current: Token { kind: TokenType::Error, start: "", length: 0, line: 0 },
                previous: Token { kind: TokenType::Error, start: "", length: 0, line: 0 },
                had_error: false,
                panic_mode: false,
            },
            scanner,
            compilers: vec![main_compiler],
        }
    }

    pub fn compile(&mut self) -> Option<FsFunction> {
        self.advance();
        if self.is_naked_kvc_start() {
            self.kvc_naked_root();
            self.match_token(TokenType::Eof);
        } else {
            while !self.match_token(TokenType::Eof) {
                self.expression(); 
            }
        }
        let function = self.end_compiler();
        if self.parser.had_error {
            None
        } else {
            Some(function)
        }
    }

    fn is_naked_kvc_start(&self) -> bool {
        if self.parser.current.kind == TokenType::Identifier {
            let cur = self.parser.current.start;
            if cur == "eval" || cur == "return" {
                return true;
            }

            let mut s = self.scanner.clone();
            let next = s.scan_token();
            match next.kind {
                TokenType::Colon => true,
                TokenType::LeftBrace => true,
                TokenType::Comma | TokenType::Semicolon => true,
                TokenType::LeftParen => {
                    let mut depth = 1i32;
                    while depth > 0 {
                        let t = s.scan_token();
                        match t.kind {
                            TokenType::LeftParen => depth += 1,
                            TokenType::RightParen => depth -= 1,
                            TokenType::Eof => return false,
                            _ => {}
                        }
                    }
                    let after = s.scan_token();
                    after.kind == TokenType::Arrow
                }
                _ => false,
            }
        } else if self.parser.current.kind == TokenType::String {
            let mut s = self.scanner.clone();
            s.scan_token().kind == TokenType::Colon
        } else {
            false
        }
    }

    fn kvc_naked_root(&mut self) {
        self.kvc_body(TokenType::Eof, false);
    }
    
    fn current_chunk(&mut self) -> &mut Chunk {
        &mut self.compilers.last_mut().unwrap().function.chunk
    }
    
    pub fn end_compiler(&mut self) -> FsFunction {
        self.emit_byte(OpCode::OpReturn);
        let compiler = self.compilers.pop().unwrap();
        
        #[cfg(feature = "debug_print_code")]
        if !self.parser.had_error {
        }
        
        compiler.function
    }

    fn check_is_lambda(&self) -> bool {
        let mut scanner = self.scanner.clone();
        
        if self.parser.current.kind == TokenType::LeftParen {
             let mut token = scanner.scan_token();
             if token.kind == TokenType::RightParen {
                 return scanner.scan_token().kind == TokenType::Arrow;
             }
             
             if token.kind == TokenType::Identifier {
                 loop {
                     token = scanner.scan_token();
                     if token.kind == TokenType::RightParen {
                         return scanner.scan_token().kind == TokenType::Arrow;
                     }
                     if token.kind == TokenType::Comma {
                         token = scanner.scan_token();
                         if token.kind != TokenType::Identifier { return false; }
                     } else {
                         return false;
                     }
                 }
             }
             return false;
        } else if self.parser.current.kind == TokenType::Identifier {
             return scanner.scan_token().kind == TokenType::Arrow;
        }
        false
    }

    fn advance(&mut self) {
        self.parser.previous = self.parser.current;
        loop {
            self.parser.current = self.scanner.scan_token();
            if self.parser.current.kind != TokenType::Error { break; }
            self.error_at_current(self.parser.current.start); 
        }
    }

    fn consume(&mut self, kind: TokenType, message: &str) {
        if self.parser.current.kind == kind {
            self.advance();
            return;
        }
        self.error_at_current(message);
    }

    fn error_at_current(&mut self, message: &str) {
        self.error_at(self.parser.current, message);
    }

    fn error_at(&mut self, token: Token, message: &str) {
        if self.parser.had_error { return; } 
        self.parser.had_error = true;

        eprint!("[line {}] Error", token.line);

        if token.kind == TokenType::Eof {
            eprint!(" at end");
        } else if token.kind == TokenType::Error {
        } else {
            eprint!(" at '{}'", token.start);
        }

        eprintln!(": {}", message);
    }

    fn expression(&mut self) {
        self.logical_or();
    }

    fn logical_or(&mut self) {
        self.logical_and();
        while self.check(TokenType::Identifier) && self.parser.current.start == "or" {
            self.advance(); 
            let name_obj = crate::obj::Obj::String("Or".to_string());
            let name_val = Value::Obj(std::rc::Rc::new(name_obj));
            let idx = self.current_chunk().add_constant(name_val);
            self.emit_byte(OpCode::OpGetGlobal(idx));
            self.emit_byte(OpCode::OpSwap);
            self.logical_and(); 
            self.emit_byte(OpCode::OpCall(2));
        }
    }

    fn logical_and(&mut self) {
        self.in_expression();
        while self.check(TokenType::Identifier) && self.parser.current.start == "and" {
            self.advance(); 
            let name_obj = crate::obj::Obj::String("And".to_string());
            let name_val = Value::Obj(std::rc::Rc::new(name_obj));
            let idx = self.current_chunk().add_constant(name_val);
            self.emit_byte(OpCode::OpGetGlobal(idx)); 
            self.emit_byte(OpCode::OpSwap);
            self.in_expression(); 
            self.emit_byte(OpCode::OpCall(2));
        }
    }

    fn in_expression(&mut self) {
        self.map_expression();
        while self.check(TokenType::Identifier) && self.parser.current.start == "in" {
            self.advance(); 
            let name_obj = crate::obj::Obj::String("In".to_string());
            let name_val = Value::Obj(std::rc::Rc::new(name_obj));
            let idx = self.current_chunk().add_constant(name_val);
            self.emit_byte(OpCode::OpGetGlobal(idx)); 
            self.emit_byte(OpCode::OpSwap); 
            self.map_expression();
            self.emit_byte(OpCode::OpCall(2));
        }
    }

    fn map_expression(&mut self) {
        self.reduce_expression();
        while self.check(TokenType::Identifier) && self.parser.current.start == "map" {
            self.advance();
            self.reduce_expression(); 
            self.emit_byte(OpCode::OpMap);
        }
    }

    fn reduce_expression(&mut self) {
        self.equality();
        while self.check(TokenType::Identifier) && self.parser.current.start.eq_ignore_ascii_case("reduce") {
            self.advance(); 

            
            self.equality();

            
            if self.match_token(TokenType::Tilde) {
                self.equality();
                self.emit_byte(OpCode::OpReduce(true));
            } else {
                self.emit_byte(OpCode::OpReduce(false));
            }
        }
    }

    fn equality(&mut self) {
        self.comparison();
        while self.match_token(TokenType::BangEqual)
            || self.match_token(TokenType::EqualEqual)
            || self.match_token(TokenType::Equal)
        {
            let operator_type = self.parser.previous.kind;
            self.comparison();
            match operator_type {
                 TokenType::BangEqual => {
                     self.emit_byte(OpCode::OpEqual);
                     self.emit_byte(OpCode::OpNot);
                 },
                 TokenType::EqualEqual | TokenType::Equal => self.emit_byte(OpCode::OpEqual),
                 _ => {}
            }
        }
    }

    fn comparison(&mut self) {
        self.term();
        while self.match_token(TokenType::Greater) || self.match_token(TokenType::GreaterEqual) ||
              self.match_token(TokenType::Less) || self.match_token(TokenType::LessEqual) {
            let operator_type = self.parser.previous.kind;
            self.term();
            match operator_type {
                TokenType::Greater => self.emit_byte(OpCode::OpGreater),
                TokenType::GreaterEqual => {
                    self.emit_byte(OpCode::OpLess);
                    self.emit_byte(OpCode::OpNot);
                },
                TokenType::Less => self.emit_byte(OpCode::OpLess),
                TokenType::LessEqual => {
                    self.emit_byte(OpCode::OpGreater);
                    self.emit_byte(OpCode::OpNot);
                },
                _ => {}
            }
        }
    }

    fn term(&mut self) {
        self.factor();
        while self.match_token(TokenType::Plus) || self.match_token(TokenType::Minus) {
            let operator_type = self.parser.previous.kind;
             self.factor();
            match operator_type {
                TokenType::Plus => self.emit_byte(OpCode::OpAdd),
                TokenType::Minus => self.emit_byte(OpCode::OpSubtract),
                _ => {}
            }
        }
    }
    
    fn factor(&mut self) {
        self.unary();
        while self.match_token(TokenType::Star) || self.match_token(TokenType::Slash) {
            let operator_type = self.parser.previous.kind;
            self.unary();
            match operator_type {
                TokenType::Star => self.emit_byte(OpCode::OpMultiply),
                TokenType::Slash => self.emit_byte(OpCode::OpDivide),
                _ => {}
            }
        }
    }

    fn unary(&mut self) {
         if self.match_token(TokenType::Bang) {
             self.unary();
             self.emit_byte(OpCode::OpNot);
         } else if self.match_token(TokenType::Minus) {
             self.unary();
             self.emit_byte(OpCode::OpNegate);
         } else {
             self.call();
         }
    }

    fn call(&mut self) {
        self.primary();
        loop {
            if self.match_token(TokenType::LeftParen) {
                let mut arg_count = 0;
                if !self.check(TokenType::RightParen) {
                    loop {
                        self.expression();
                        arg_count += 1;
                        if !self.match_token(TokenType::Comma) { break; }
                    }
                }
                self.consume(TokenType::RightParen, "Expect ')' after arguments.");
                self.emit_byte(OpCode::OpCall(arg_count));
            } else if self.match_token(TokenType::Dot) {
                self.consume(TokenType::Identifier, "Expect property name after '.'.");
                let name = self.parser.previous.start;
                let obj = crate::obj::Obj::String(name.to_string());
                let val = Value::Obj(std::rc::Rc::new(obj));
                let idx = self.current_chunk().add_constant(val);
                self.emit_byte(OpCode::OpGetProp(idx));
            } else if self.match_token(TokenType::SafeDot) {
                self.consume(TokenType::Identifier, "Expect property name after '?.'.");
                let name = self.parser.previous.start;
                let obj = crate::obj::Obj::String(name.to_string());
                let val = Value::Obj(std::rc::Rc::new(obj));
                let idx = self.current_chunk().add_constant(val);
                self.emit_byte(OpCode::OpGetProp(idx));
            } else if self.match_token(TokenType::LeftBracket) {
                self.expression();
                self.consume(TokenType::RightBracket, "Expect ']' after index.");
                self.emit_byte(OpCode::OpIndex);
            } else if self.match_token(TokenType::LeftBrace) {
                let selector_val = self.compile_selector_function_value();
                let selector_idx = self.current_chunk().add_constant(selector_val);
                self.emit_byte(OpCode::OpSelect(selector_idx));
            } else {
                break;
            }
        }
    }

    fn lambda_expression(&mut self) {
        let name = "lambda".to_string();
        let compiler = FunctionCompiler::new(name);
        self.compilers.push(compiler);

        let mut arity = 0;
        
        self.compilers.last_mut().unwrap().locals.push(Local { name: "".to_string(), depth: 0 }); // Slot 0: Function

        if self.match_token(TokenType::LeftParen) {
            if !self.check(TokenType::RightParen) {
                loop {
                    self.consume(TokenType::Identifier, "Expect parameter name.");
                    let name = self.parser.previous.start.to_string();
                    self.compilers.last_mut().unwrap().locals.push(Local { name, depth: 1 });
                    arity += 1;
                    if !self.match_token(TokenType::Comma) { break; }
                }
            }
            self.consume(TokenType::RightParen, "Expect ')' after parameters.");
        } else {
             self.consume(TokenType::Identifier, "Expect parameter name.");
             let name = self.parser.previous.start.to_string();
             self.compilers.last_mut().unwrap().locals.push(Local { name, depth: 1 });
             arity += 1;
        }
        
        self.compilers.last_mut().unwrap().function.arity = arity;
        
        self.consume(TokenType::Arrow, "Expect '=>' after parameters.");
        
        self.expression();
        
        let function = self.end_compiler();
        
        let val = Value::Obj(Rc::new(crate::obj::Obj::Function(Rc::new(function))));
        let idx = self.current_chunk().add_constant(val);
        self.emit_byte(OpCode::OpClosure(idx));
    }

    fn primary(&mut self) {
        if self.match_token(TokenType::Number) {
            let lexeme = self.parser.previous.start;
            if let Ok(value) = lexeme.parse::<f64>() {
                self.emit_constant(Value::Number(value));
            } else {
                self.error_at(self.parser.previous, "Invalid number format.");
            }
        } else if self.match_token(TokenType::String) {
            let s = self.parser.previous.start;
            let content = if s.starts_with("\"\"\"") && s.ends_with("\"\"\"") && s.len() >= 6 {
                let inner = &s[3..s.len()-3];
                inner.trim_matches('\n').to_string()
            } else {
               
                let q = s.chars().next().unwrap_or('"');
                let inner = &s[1..s.len()-1];
                if q == '\'' || q == '"' { inner.to_string() } else { inner.to_string() }
            };
            let obj = crate::obj::Obj::String(content);
            let value = Value::Obj(std::rc::Rc::new(obj));
            self.emit_constant(value);
        } else if self.match_token(TokenType::TemplateStart) {
            self.template_string_expression();
        } else if self.check(TokenType::Identifier) {
             
             if self.check_is_lambda() {
                 self.lambda_expression();
             } else {
                 
                 let name_token = self.parser.current.clone(); 
                 let name = name_token.start;
                 
                
                 if name == "if" {
                     self.advance();
                     self.if_then_else_expression();
                     return;
                 }

                 if name == "case" {
                     self.advance(); 
                     self.case_expression();
                     return;
                 }

                 if name == "switch" {
                     self.advance();
                     self.switch_expression();
                     return;
                 }

                 
                 if name.eq_ignore_ascii_case("reduce") {
                   
                     let mut look = self.scanner.clone();
                     if look.scan_token().kind == TokenType::LeftParen {
                         self.advance(); 
                         self.consume(TokenType::LeftParen, "Expect '(' after reduce.");
                         
                         self.expression();
                         self.consume(TokenType::Comma, "Expect ',' after list.");
                        
                         self.expression();
                         let has_seed = if self.match_token(TokenType::Comma) {
                             self.expression();
                             true
                         } else {
                             false
                         };
                         self.consume(TokenType::RightParen, "Expect ')' after reduce call.");
                         self.emit_byte(OpCode::OpReduce(has_seed));
                         return;
                     }
                 }
                 
            
                 if name == "If" {
                     self.advance();
                     self.if_expression();
                     return;
                 }
                 
                 self.advance();
                 let name_str = name.to_string();
                 
                 
                 let mut arg_idx = None;
                 {
                     let compiler = self.compilers.last().unwrap();
                     for (i, local) in compiler.locals.iter().enumerate().rev() {
                         if local.name == name_str {
                             arg_idx = Some(i);
                             break;
                         }
                     }
                 }
                 
                 if let Some(idx) = arg_idx {
                     self.emit_byte(OpCode::OpGetLocal(idx));
                 } else {
                     
                     let val = Value::Obj(std::rc::Rc::new(crate::obj::Obj::String(name_str)));
                     let idx = self.current_chunk().add_constant(val); 
                     self.emit_byte(OpCode::OpGetGlobal(idx));
                 }
             }
        } else if self.check(TokenType::LeftParen) {
             if self.check_is_lambda() {
                 self.lambda_expression();
             } else {
                 self.advance(); 
                 self.expression();
                 self.consume(TokenType::RightParen, "Expect ')' after expression.");
             }
        } else if self.match_token(TokenType::LeftBracket) {
             let mut count = 0;
             if !self.check(TokenType::RightBracket) {
                 loop {
                     self.expression();
                     count += 1;
                     if !self.match_token(TokenType::Comma) { break; }
                 }
             }
             self.consume(TokenType::RightBracket, "Expect ']' after list.");
             self.emit_byte(OpCode::OpBuildList(count));
        } else if self.match_token(TokenType::LeftBrace) {
             self.kvc_literal();
        } else {
            self.error_at(self.parser.current, "Expect expression.");
            self.advance();
        }
    }

    fn template_string_expression(&mut self) {
        let mut part_count = 0usize;

       
        let name_obj = crate::obj::Obj::String("TemplateMerge".to_string());
        let name_val = Value::Obj(std::rc::Rc::new(name_obj));
        let idx = self.current_chunk().add_constant(name_val);
        self.emit_byte(OpCode::OpGetGlobal(idx));

        loop {
            if self.match_token(TokenType::TemplateEnd) {
                break;
            }
            if self.match_token(TokenType::TemplateText) {
                let raw = self.parser.previous.start;
                let s = Self::unescape_template_text(raw);
                let obj = crate::obj::Obj::String(s);
                let value = Value::Obj(std::rc::Rc::new(obj));
                self.emit_constant(value);
                part_count += 1;
                continue;
            }
            if self.match_token(TokenType::LeftBrace) {
                self.expression();
                part_count += 1;
                self.consume(TokenType::RightBrace, "Expect '}' to close template expression.");
                continue;
            }
            self.advance();
        }

        self.emit_byte(OpCode::OpCall(part_count));
    }

    fn unescape_template_text(raw: &str) -> String {
        let mut out = String::new();
        let mut it = raw.chars().peekable();
        while let Some(c) = it.next() {
            if c == '\\' {
                match it.peek().copied() {
                    Some('n') => { it.next(); out.push('\n'); }
                    Some('t') => { it.next(); out.push('\t'); }
                    Some('\\') => { it.next(); out.push('\\'); }
                    Some('{') => { it.next(); out.push('{'); }
                    Some('}') => { it.next(); out.push('}'); }
                    Some('"') => { it.next(); out.push('"'); }
                    Some('\'') => { it.next(); out.push('\''); }
                    Some(other) => { out.push(other); it.next(); }
                    None => {}
                }
            } else {
                out.push(c);
            }
        }
        out
    }

    fn consume_identifier(&mut self, expected: &str, message: &str) {
        if self.parser.current.kind == TokenType::Identifier && self.parser.current.start == expected {
            self.advance();
            return;
        }
        self.error_at_current(message);
    }

    fn if_then_else_expression(&mut self) {
        self.expression();
        self.consume_identifier("then", "Expect 'then' after if condition.");

        let jump_if_false = self.emit_jump(OpCode::OpJumpIfFalse);
        self.emit_byte(OpCode::OpPop); 

        self.expression();
        let jump_end = self.emit_jump(OpCode::OpJump);

        self.patch_jump(jump_if_false);
        self.emit_byte(OpCode::OpPop);

        self.consume_identifier("else", "Expect 'else' after then-branch.");
        self.expression();

        self.patch_jump(jump_end);
    }

    fn consume_kvc_separator(&mut self) {
        if self.match_token(TokenType::Comma) || self.match_token(TokenType::Semicolon) {
            return;
        }
    }

    fn kvc_literal(&mut self) {
        self.kvc_body(TokenType::RightBrace, true);
    }

    fn kvc_body(&mut self, terminator: TokenType, consume_terminator: bool) {
        let mut count = 0usize;
        let mut eval_thunk_const: Option<usize> = None;

        while !self.check(terminator) {
            if self.check(TokenType::Eof) && terminator != TokenType::Eof {
                break;
            }

            if self.check(TokenType::Identifier) {
                let kw = self.parser.current.start;
                if kw == "eval" || kw == "return" {
                    self.advance();
                    let idx = self.compile_thunk_const("kvc_eval".to_string(), 0, |c| {
                        c.expression();
                    });
                    eval_thunk_const = Some(idx);
                    self.consume_kvc_separator();
                    continue;
                }
            }

            let key = if self.match_token(TokenType::String) {
                let s = self.parser.previous.start;
                s[1..s.len() - 1].to_string()
            } else if self.match_token(TokenType::Identifier) {
                self.parser.previous.start.to_string()
            } else {
                if self.match_token(TokenType::Comma) || self.match_token(TokenType::Semicolon) {
                    continue;
                }
                break;
            };

            
            if self.check(TokenType::LeftParen) && self.check_is_lambda() {
                let key_obj = crate::obj::Obj::String(key.clone());
                let key_val = Value::Obj(std::rc::Rc::new(key_obj));
                self.emit_constant(key_val);
                self.lambda_expression();
                count += 1;
                self.consume_kvc_separator();
                continue;
            }

            if self.check(TokenType::LeftBrace) {
                let key_obj = crate::obj::Obj::String(key.clone());
                let key_val = Value::Obj(std::rc::Rc::new(key_obj));
                self.emit_constant(key_val);

                self.advance(); 
                let selector_val = self.compile_selector_function_value();
                let name_for_parent = key.clone();
                let thunk_idx = self.compile_thunk_const(format!("kvc_sel_{}", key), 0, |c| {
                    let name_obj = crate::obj::Obj::String(name_for_parent.clone());
                    let name_val = Value::Obj(std::rc::Rc::new(name_obj));
                    let name_idx = c.current_chunk().add_constant(name_val);
                    c.emit_byte(OpCode::OpGetParent(name_idx));
                    let selector_idx = c.current_chunk().add_constant(selector_val.clone());
                    c.emit_byte(OpCode::OpSelect(selector_idx));
                });

                self.emit_byte(OpCode::OpClosure(thunk_idx));
                count += 1;
                self.consume_kvc_separator();
                continue;
            }
            if self.match_token(TokenType::Colon) {
                
                let key_obj = crate::obj::Obj::String(key.clone());
                let key_val = Value::Obj(std::rc::Rc::new(key_obj));
                self.emit_constant(key_val);

                let is_simple_self_ref = self.check(TokenType::Identifier)
                    && self.parser.current.start.eq_ignore_ascii_case(key.as_str());

                if is_simple_self_ref {
                    self.advance();
                    let thunk_idx = self.compile_parent_get_thunk_const(format!("kvc_get_{}", key), &key);
                    self.emit_byte(OpCode::OpClosure(thunk_idx));
                } else {
                    let thunk_idx = self.compile_thunk_const(format!("kvc_val_{}", key), 0, |c| {
                        c.expression();
                    });
                    self.emit_byte(OpCode::OpClosure(thunk_idx));
                }

                count += 1;
                self.consume_kvc_separator();
            } else {
                let key_obj = crate::obj::Obj::String(key.clone());
                let key_val = Value::Obj(std::rc::Rc::new(key_obj));
                self.emit_constant(key_val);

                let thunk_idx = self.compile_parent_get_thunk_const(format!("kvc_proj_{}", key), &key);
                self.emit_byte(OpCode::OpClosure(thunk_idx));

                count += 1;
                self.consume_kvc_separator();
            }
        }

        if consume_terminator {
            self.consume(terminator, "Terminator expected.");
        }
        self.emit_byte(OpCode::OpBuildKvc(count));

        if let Some(eval_idx) = eval_thunk_const {
            self.emit_byte(OpCode::OpPushProvider);
            self.emit_byte(OpCode::OpClosure(eval_idx));
            self.emit_byte(OpCode::OpCall(0));
            self.emit_byte(OpCode::OpPopProvider);
        }
    }

    fn case_expression(&mut self) {
        let mut end_jumps: Vec<usize> = Vec::new();
        loop {
            self.expression();
            if self.match_token(TokenType::Colon) {
                let jump_if_false = self.emit_jump(OpCode::OpJumpIfFalse);
                self.emit_byte(OpCode::OpPop);
                self.expression();
                
                end_jumps.push(self.emit_jump(OpCode::OpJump));
                self.patch_jump(jump_if_false);
                self.emit_byte(OpCode::OpPop);

                self.consume_kvc_separator();
                if self.check(TokenType::Eof) || self.check(TokenType::RightBrace) || self.check(TokenType::RightParen) {
                    break;
                }
                continue;
            } else {
                break;
            }
        }

        for j in end_jumps {
            self.patch_jump(j);
        }
    }

    fn switch_expression(&mut self) {
        self.expression(); // selector (kept on stack)
        self.consume(TokenType::Comma, "Expect ',' after switch selector.");

        let mut end_jumps: Vec<usize> = Vec::new();
        loop {
            self.emit_byte(OpCode::OpDup); // duplicate selector for comparison
            self.expression(); // match
            if self.match_token(TokenType::Colon) {
                self.emit_byte(OpCode::OpEqual);
                let jump_if_false = self.emit_jump(OpCode::OpJumpIfFalse);
                self.emit_byte(OpCode::OpPop); // pop condition

                self.expression(); // value; stack: selector, value
                self.emit_byte(OpCode::OpSwap);
                self.emit_byte(OpCode::OpPop); // pop selector, leave value
                end_jumps.push(self.emit_jump(OpCode::OpJump));

                self.patch_jump(jump_if_false);
                self.emit_byte(OpCode::OpPop); // pop condition

                self.consume_kvc_separator();
                if self.check(TokenType::Eof) || self.check(TokenType::RightBrace) || self.check(TokenType::RightParen) {
                    break;
                }
                continue;
            } else {
                self.emit_byte(OpCode::OpSwap); // selector, defaultValue, selectorDup
                self.emit_byte(OpCode::OpPop);  // selector, defaultValue
                self.emit_byte(OpCode::OpSwap); // defaultValue, selector
                self.emit_byte(OpCode::OpPop);  // defaultValue
                break;
            }
        }

        for j in end_jumps {
            self.patch_jump(j);
        }
    }

    fn compile_parent_get_thunk_const(&mut self, name: String, key: &str) -> usize {
        self.compile_thunk_const(name, 0, |c| {
            let name_obj = crate::obj::Obj::String(key.to_string());
            let name_val = Value::Obj(std::rc::Rc::new(name_obj));
            let name_idx = c.current_chunk().add_constant(name_val);
            c.emit_byte(OpCode::OpGetParent(name_idx));
        })
    }

    fn compile_thunk_const<F>(&mut self, name: String, arity: usize, build: F) -> usize
    where
        F: FnOnce(&mut Compiler),
    {
        let compiler = FunctionCompiler::new(name);
        self.compilers.push(compiler);

        self.compilers.last_mut().unwrap().locals.push(Local { name: "".to_string(), depth: 0 });
        self.compilers.last_mut().unwrap().function.arity = arity;

        build(self);

        let function = self.end_compiler();
        let val = Value::Obj(Rc::new(crate::obj::Obj::Function(Rc::new(function))));
        self.current_chunk().add_constant(val)
    }

    fn compile_selector_function_value(&mut self) -> Value {
        let compiler = FunctionCompiler::new("selector".to_string());
        self.compilers.push(compiler);

        self.compilers.last_mut().unwrap().locals.push(Local { name: "".to_string(), depth: 0 });
        self.compilers.last_mut().unwrap().locals.push(Local { name: "it".to_string(), depth: 1 });
        self.compilers.last_mut().unwrap().function.arity = 1;

        self.emit_byte(OpCode::OpGetLocal(1));
        self.emit_byte(OpCode::OpMakeProvider);
        self.emit_byte(OpCode::OpPushProvider);

        self.kvc_literal();

        self.emit_byte(OpCode::OpPopProvider);

        let function = self.end_compiler();
        Value::Obj(Rc::new(crate::obj::Obj::Function(Rc::new(function))))
    }

    fn match_token(&mut self, kind: TokenType) -> bool {
        if self.parser.current.kind != kind { return false; }
        self.advance();
        true
    }

    fn check(&self, kind: TokenType) -> bool {
        self.parser.current.kind == kind
    }

    fn emit_byte(&mut self, op: OpCode) {
        self.current_chunk().write(op);
    }
    
    fn emit_constant(&mut self, value: Value) {
        let idx = self.current_chunk().add_constant(value);
        self.current_chunk().write(OpCode::OpConstant(idx));
    }

    fn emit_jump(&mut self, op: fn(usize) -> OpCode) -> usize {
        self.emit_byte(op(0xFFFF));
        self.current_chunk().code.len() - 1
    }

    fn patch_jump(&mut self, offset: usize) {
        let jump = self.current_chunk().code.len() - 1 - offset;

        match self.current_chunk().code[offset] {
            OpCode::OpJumpIfFalse(_) => {
                self.current_chunk().code[offset] = OpCode::OpJumpIfFalse(jump);
            }
            OpCode::OpJump(_) => {
                self.current_chunk().code[offset] = OpCode::OpJump(jump);
            }
            _ => { 
                panic!("Attempted to patch a non-jump instruction."); 
            }
        }
    }

    fn if_expression(&mut self) {
        self.consume(TokenType::LeftParen, "Expect '(' after 'If'.");
        
        self.expression();
        self.consume(TokenType::Comma, "Expect ',' after condition.");

        let jump_if_false = self.emit_jump(OpCode::OpJumpIfFalse);
        self.emit_byte(OpCode::OpPop);

        self.expression(); 
        self.consume(TokenType::Comma, "Expect ',' after true branch.");

        let jump_end = self.emit_jump(OpCode::OpJump);

        self.patch_jump(jump_if_false);
        self.emit_byte(OpCode::OpPop);
        
        self.expression();

        self.patch_jump(jump_end);
        self.consume(TokenType::RightParen, "Expect ')' after else.");
    }
}
