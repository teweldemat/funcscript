"""
Backward-compatible shim.

Prefer importing `funcscript`:
  from funcscript import eval, FsVm
"""

from funcscript import FsError, FsFunction, FsObject, FsList, FsRange, FsVm, call, eval, eval_json, to_fs_literal

__all__ = [
    "FsError",
    "FsFunction",
    "FsList",
    "FsObject",
    "FsRange",
    "FsVm",
    "call",
    "eval",
    "eval_json",
    "to_fs_literal",
]

