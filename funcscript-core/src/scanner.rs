
//! Lexer/tokenizer for FuncScript core.
//!
//! Notes:
//! - Input is UTF-8. We advance by `char` boundaries (Unicode scalar values).
//! - Supports comments (`//`, `/* */`), single/double/triple-quoted strings, and `f"..."` templates.

#[derive(Debug, PartialEq, Clone, Copy)]
pub enum TokenType {
    Plus, Minus, Star, Slash,
    LeftBracket, RightBracket, Comma,
    LeftParen, RightParen,
    LeftBrace, RightBrace, Colon, Dot,
    Semicolon,
    SafeDot,
    Tilde,
    
    Bang, BangEqual,
    Equal, EqualEqual,
    Greater, GreaterEqual,
    Less, LessEqual,
    Arrow,

    Number, String, Identifier,
    TemplateStart,
    TemplateText,
    TemplateEnd,

    Error, Eof,
}

#[derive(Debug, Clone, Copy)]
pub struct Token<'a> {
    pub kind: TokenType,
    pub start: &'a str,
    pub length: usize,
    pub line: usize,
}

#[derive(Clone)]
pub struct Scanner<'a> {
    source: &'a str,
    start: usize,
    current: usize,
    line: usize,
    template: Option<TemplateState>,
    template_expr_depth: usize,
}

#[derive(Clone, Copy)]
struct TemplateState {
    quote: char,
    triple: bool,
}

impl<'a> Scanner<'a> {
    pub fn new(source: &'a str) -> Self {
        Scanner {
            source,
            start: 0,
            current: 0,
            line: 1,
            template: None,
            template_expr_depth: 0,
        }
    }

    pub fn scan_token(&mut self) -> Token<'a> {
     
        if let Some(state) = self.template {
            if self.template_expr_depth > 0 {
            
                self.skip_whitespace();
                self.start = self.current;
                if self.is_at_end() {
                    self.template = None;
                    self.template_expr_depth = 0;
                    return self.error_token("Unterminated template expression.");
                }
                let c = self.advance();
                match c {
                    '{' => {
                        self.template_expr_depth += 1;
                        return self.make_token(TokenType::LeftBrace);
                    }
                    '}' => {
                        self.template_expr_depth -= 1;
                        return self.make_token(TokenType::RightBrace);
                    }
                    _ => {
                        self.current -= c.len_utf8();
                        self.start = self.current;
                        let saved = self.template;
                        self.template = None;
                        let tok = self.scan_token();
                        self.template = saved;
                        return tok;
                    }
                }
            }

            self.start = self.current;

            if self.is_at_end() {
                self.template = None;
                return self.error_token("Unterminated template.");
            }

            if state.triple {
                if self.match_literal("\"\"\"") {
                    self.template = None;
                    return self.make_token(TokenType::TemplateEnd);
                }
            } else {
                if self.peek() == state.quote {
                    self.advance();
                    self.template = None;
                    return self.make_token(TokenType::TemplateEnd);
                }
            }

            if self.peek() == '{' {
                self.advance();
                self.template_expr_depth = 1;
                return self.make_token(TokenType::LeftBrace);
            }

            while !self.is_at_end() {
                if self.peek() == '\n' {
                    self.line += 1;
                }

                if self.peek() == '{' {
                    break;
                }
                if state.triple {
                    if self.check_literal_ahead("\"\"\"") {
                        break;
                    }
                } else if self.peek() == state.quote {
                    break;
                }

                self.advance();
            }

            return self.make_token(TokenType::TemplateText);
        }

        self.skip_whitespace();
        self.start = self.current;

        if self.is_at_end() {
            return self.make_token(TokenType::Eof);
        }

        let c = self.advance();

        match c {
            '(' => self.make_token(TokenType::LeftParen),
            ')' => self.make_token(TokenType::RightParen),
            '{' => self.make_token(TokenType::LeftBrace),
            '}' => self.make_token(TokenType::RightBrace),
            '[' => self.make_token(TokenType::LeftBracket),
            ']' => self.make_token(TokenType::RightBracket),
            ',' => self.make_token(TokenType::Comma),
            ';' => self.make_token(TokenType::Semicolon),
            '~' => self.make_token(TokenType::Tilde),
            '.' => self.make_token(TokenType::Dot),
            ':' => self.make_token(TokenType::Colon),
            '+' => self.make_token(TokenType::Plus),
            '-' => self.make_token(TokenType::Minus),
            '*' => self.make_token(TokenType::Star),
            '/' => self.make_token(TokenType::Slash),
            '?' => {
                if self.match_char('.') {
                    self.make_token(TokenType::SafeDot)
                } else {
                    self.error_token("Unexpected character.")
                }
            }
            '!' => {
                let token = if self.match_char('=') { TokenType::BangEqual } else { TokenType::Bang };
                self.make_token(token)
            },
            '=' => {
                let token = if self.match_char('=') { 
                    TokenType::EqualEqual 
                } else if self.match_char('>') {
                    TokenType::Arrow
                } else { 
                    TokenType::Equal 
                };
                self.make_token(token)
            },
            '<' => {
                let token = if self.match_char('=') { TokenType::LessEqual } else { TokenType::Less };
                self.make_token(token)
            },
            '>' => {
                let token = if self.match_char('=') { TokenType::GreaterEqual } else { TokenType::Greater };
                self.make_token(token)
            },
            '"' => {
                if self.match_literal("\"\"") {
                    self.triple_string()
                } else {
                    self.string('"')
                }
            }
            '\'' => self.string('\''),
            _ => {
                if c.is_ascii_alphabetic() || c == '_' {
                    if c == 'f' {
                        if self.peek() == '"' {
                            if self.check_literal_ahead("\"\"\"") {
                                self.advance();
                                self.advance();
                                self.advance();
                                self.template = Some(TemplateState { quote: '"', triple: true });
                                return self.make_token(TokenType::TemplateStart);
                            }
                            self.advance();
                            self.template = Some(TemplateState { quote: '"', triple: false });
                            return self.make_token(TokenType::TemplateStart);
                        } else if self.peek() == '\'' {
                            self.advance();
                            self.template = Some(TemplateState { quote: '\'', triple: false });
                            return self.make_token(TokenType::TemplateStart);
                        }
                    }

                    return self.identifier();
                }
                if c.is_digit(10) {
                     return self.number();
                }
                self.error_token("Unexpected character.")
            }
        }
    }

    fn identifier(&mut self) -> Token<'a> {
        while self.peek().is_ascii_alphanumeric() || self.peek() == '_' {
            self.advance();
        }
        self.make_token(TokenType::Identifier)
    }

    fn string(&mut self, quote: char) -> Token<'a> {
        while self.peek() != quote && !self.is_at_end() {
            if self.peek() == '\n' { self.line += 1; }
            self.advance();
        }

        if self.is_at_end() {
            return self.error_token("Unterminated string.");
        }

        self.advance();
        self.make_token(TokenType::String)
    }

    fn triple_string(&mut self) -> Token<'a> {
        while !self.is_at_end() {
            if self.peek() == '\n' { self.line += 1; }
            if self.check_literal_ahead("\"\"\"") {
                self.advance(); self.advance(); self.advance();
                return self.make_token(TokenType::String);
            }
            self.advance();
        }
        self.error_token("Unterminated string.")
    }

    fn is_at_end(&self) -> bool {
        self.current >= self.source.len()
    }

    fn advance(&mut self) -> char {
        let c = self.source[self.current..].chars().next().unwrap();
        self.current += c.len_utf8();
        c
    }

    fn match_char(&mut self, expected: char) -> bool {
         if self.is_at_end() { return false; }
         if self.peek() != expected { return false; }
         self.advance();
         true
    }

    fn check_literal_ahead(&self, lit: &str) -> bool {
        self.source[self.current..].starts_with(lit)
    }

    fn match_literal(&mut self, lit: &str) -> bool {
        if self.source[self.current..].starts_with(lit) {
            self.current += lit.len();
            true
        } else {
            false
        }
    }

    pub fn peek(&self) -> char {
        if self.is_at_end() {
            return '\0';
        }
        self.source[self.current..].chars().next().unwrap()
    }

    pub fn peek_next(&self) -> char {
        if self.current + 1 >= self.source.len() {
             return '\0';
        }
        let mut iter = self.source[self.current..].chars();
        iter.next();
        iter.next().unwrap_or('\0')
    }

    fn skip_whitespace(&mut self) {
        loop {
            if self.is_at_end() { return; }
            let c = self.peek();
            match c {
                ' ' | '\r' | '\t' => {
                    self.advance();
                }
                '\n' => {
                    self.line += 1;
                    self.advance();
                }
                '/' => {
                    let n = self.peek_next();
                    if n == '/' {
                        self.advance();
                        self.advance();
                        while self.peek() != '\n' && !self.is_at_end() {
                            self.advance();
                        }
                    } else if n == '*' {
                        self.advance();
                        self.advance();
                        while !self.is_at_end() {
                            if self.peek() == '\n' {
                                self.line += 1;
                            }
                            if self.peek() == '*' && self.peek_next() == '/' {
                                self.advance();
                                self.advance();
                                break;
                            }
                            self.advance();
                        }
                    } else {
                        return;
                    }
                }
                _ => return,
            }
        }
    }

    fn number(&mut self) -> Token<'a> {
        while self.peek().is_digit(10) {
            self.advance();
        }

        if self.peek() == '.' && self.peek_next().is_digit(10) {
            self.advance(); 

            while self.peek().is_digit(10) {
                self.advance();
            }
        }

        self.make_token(TokenType::Number)
    }

    fn make_token(&self, kind: TokenType) -> Token<'a> {
        Token {
            kind,
            start: &self.source[self.start..self.current],
            length: self.current - self.start,
            line: self.line,
        }
    }

    fn error_token(&self, message: &'static str) -> Token<'a> {
        Token {
            kind: TokenType::Error,
            start: message,
            length: message.len(),
            line: self.line,
        }
    }
}
