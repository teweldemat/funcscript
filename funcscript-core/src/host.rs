//! Host callback context for embedding.
//!
//! The core runtime avoids direct IO/logging. Embedders can provide callbacks
//! (via the C ABI or other bindings) to enable filesystem operations and logging.

use std::cell::RefCell;
use std::sync::Arc;

use crate::value::FsError;

#[derive(Clone, Default)]
pub struct HostCallbacks {
    pub file_read_text: Option<Arc<dyn Fn(&str) -> Result<String, FsError> + Send + Sync>>,
    pub file_exists: Option<Arc<dyn Fn(&str) -> Result<bool, FsError> + Send + Sync>>,
    pub is_file: Option<Arc<dyn Fn(&str) -> Result<bool, FsError> + Send + Sync>>,
    pub dir_list: Option<Arc<dyn Fn(&str) -> Result<Vec<String>, FsError> + Send + Sync>>,
    pub log_line: Option<Arc<dyn Fn(&str) + Send + Sync>>,
}

thread_local! {
    static STACK: RefCell<Vec<HostCallbacks>> = const { RefCell::new(Vec::new()) };
}

pub struct HostGuard;

impl Drop for HostGuard {
    fn drop(&mut self) {
        STACK.with(|s| {
            let mut s = s.borrow_mut();
            let _ = s.pop();
        });
    }
}

pub fn push(callbacks: HostCallbacks) -> HostGuard {
    STACK.with(|s| s.borrow_mut().push(callbacks));
    HostGuard
}

fn current() -> Option<HostCallbacks> {
    STACK.with(|s| s.borrow().last().cloned())
}

pub fn file_read_text(path: &str) -> Result<String, FsError> {
    if let Some(cb) = current().and_then(|c| c.file_read_text) {
        cb(path)
    } else {
        Err(FsError { code: 2601, message: "file: host callback not set".to_string(), line: -1, column: -1 })
    }
}

pub fn file_exists(path: &str) -> Result<bool, FsError> {
    if let Some(cb) = current().and_then(|c| c.file_exists) {
        cb(path)
    } else {
        Err(FsError { code: 2602, message: "fileexists: host callback not set".to_string(), line: -1, column: -1 })
    }
}

pub fn is_file(path: &str) -> Result<bool, FsError> {
    if let Some(cb) = current().and_then(|c| c.is_file) {
        cb(path)
    } else {
        Err(FsError { code: 2603, message: "isfile: host callback not set".to_string(), line: -1, column: -1 })
    }
}

pub fn dir_list(path: &str) -> Result<Vec<String>, FsError> {
    if let Some(cb) = current().and_then(|c| c.dir_list) {
        cb(path)
    } else {
        Err(FsError { code: 2604, message: "dirlist: host callback not set".to_string(), line: -1, column: -1 })
    }
}

pub fn log_line(text: &str) {
    if let Some(cb) = current().and_then(|c| c.log_line) {
        cb(text);
    }
}

pub fn std_fs_callbacks() -> HostCallbacks {
    HostCallbacks {
        file_read_text: Some(Arc::new(|path| {
            let meta = std::fs::metadata(path).map_err(|_| FsError {
                code: 1,
                message: format!("file: File '{path}' doesn't exist"),
                line: -1,
                column: -1,
            })?;
            if meta.len() > 1_000_000 {
                return Err(FsError { code: 1, message: format!("file: File '{path}' is too big"), line: -1, column: -1 });
            }
            std::fs::read_to_string(path).map_err(|e| FsError { code: 1, message: format!("file: Error reading '{path}': {e}"), line: -1, column: -1 })
        })),
        file_exists: Some(Arc::new(|path| Ok(std::path::Path::new(path).exists()))),
        is_file: Some(Arc::new(|path| Ok(std::path::Path::new(path).is_file()))),
        dir_list: Some(Arc::new(|path| {
            let p = std::path::Path::new(path);
            if !p.is_dir() {
                return Err(FsError { code: 1, message: format!("dirlist: Directory '{path}' does not exist"), line: -1, column: -1 });
            }
            let mut out: Vec<String> = Vec::new();
            for ent in std::fs::read_dir(p).map_err(|e| FsError { code: 1, message: format!("dirlist: Error retrieving files from '{path}': {e}"), line: -1, column: -1 })? {
                if let Ok(e) = ent {
                    if let Ok(s) = e.path().into_os_string().into_string() {
                        out.push(s);
                    }
                }
            }
            out.sort();
            Ok(out)
        })),
        log_line: None,
    }
}

