import base64
import ctypes
import datetime as _dt
import json
import os
import uuid as _uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional


@dataclass(frozen=True)
class FsError(Exception):
    code: int
    message: str
    line: int = -1
    column: int = -1

    def __str__(self) -> str:
        loc = ""
        if self.line is not None and self.line >= 1:
            loc = f" (line {self.line}, col {self.column})"
        return f"FsError[{self.code}]{loc}: {self.message}"


class _FsErrorC(ctypes.Structure):
    _fields_ = [
        ("code", ctypes.c_uint32),
        ("line", ctypes.c_int32),
        ("column", ctypes.c_int32),
        ("message", ctypes.c_void_p),
    ]


class _FsValueC(ctypes.Structure):
    _fields_ = [("id", ctypes.c_uint64)]

_FsHostWriteFn = ctypes.CFUNCTYPE(None, ctypes.c_void_p, ctypes.POINTER(ctypes.c_uint8), ctypes.c_uint64)
_FsHostFileReadFn = ctypes.CFUNCTYPE(ctypes.c_int32, ctypes.c_void_p, ctypes.c_char_p, ctypes.c_void_p, _FsHostWriteFn, ctypes.POINTER(_FsErrorC))
_FsHostFileExistsFn = ctypes.CFUNCTYPE(ctypes.c_int32, ctypes.c_void_p, ctypes.c_char_p, ctypes.POINTER(ctypes.c_int32), ctypes.POINTER(_FsErrorC))
_FsHostIsFileFn = ctypes.CFUNCTYPE(ctypes.c_int32, ctypes.c_void_p, ctypes.c_char_p, ctypes.POINTER(ctypes.c_int32), ctypes.POINTER(_FsErrorC))
_FsHostDirListFn = ctypes.CFUNCTYPE(ctypes.c_int32, ctypes.c_void_p, ctypes.c_char_p, ctypes.c_void_p, _FsHostWriteFn, ctypes.POINTER(_FsErrorC))
_FsHostLogLineFn = ctypes.CFUNCTYPE(None, ctypes.c_void_p, ctypes.c_char_p)


class _FsHostCallbacksC(ctypes.Structure):
    _fields_ = [
        ("user_data", ctypes.c_void_p),
        ("file_read_text", _FsHostFileReadFn),
        ("file_exists", _FsHostFileExistsFn),
        ("is_file", _FsHostIsFileFn),
        ("dir_list", _FsHostDirListFn),
        ("log_line", _FsHostLogLineFn),
    ]


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _default_lib_candidates() -> list[Path]:
    root = _project_root()
    base = root / "funcscript-core" / "target" / "release"
    return [
        base / "libfuncscript_core.dylib",
        base / "libfuncscript_core.so",
        base / "funcscript_core.dll",
        base / "funcscript-core.dll",
    ]


def _load_lib() -> ctypes.CDLL:
    env = os.environ.get("FUNCSCRIPT_CORE_LIB")
    if env:
        return ctypes.CDLL(env)

    for p in _default_lib_candidates():
        if p.exists():
            return ctypes.CDLL(str(p))

    cand = "\n".join(str(p) for p in _default_lib_candidates())
    raise FileNotFoundError(
        "FuncScript core shared library not found.\n"
        "Build it first:\n"
        "  cd funcscript-core && cargo build --release\n"
        "Or set FUNCSCRIPT_CORE_LIB to the full path.\n"
        f"Tried:\n{cand}"
    )


_LIB = _load_lib()

# ABI
_LIB.fs_vm_new.restype = ctypes.c_void_p
_LIB.fs_vm_new.argtypes = []

_LIB.fs_vm_free.restype = None
_LIB.fs_vm_free.argtypes = [ctypes.c_void_p]

_LIB.fs_vm_set_host_callbacks.restype = ctypes.c_int32
_LIB.fs_vm_set_host_callbacks.argtypes = [ctypes.c_void_p, ctypes.POINTER(_FsHostCallbacksC)]

_LIB.fs_vm_eval.restype = ctypes.c_int32
_LIB.fs_vm_eval.argtypes = [
    ctypes.c_void_p,
    ctypes.c_char_p,
    ctypes.POINTER(ctypes.c_void_p),  # out_json (char*)
    ctypes.POINTER(_FsErrorC),        # out_error
]

_LIB.fs_vm_eval_value.restype = ctypes.c_int32
_LIB.fs_vm_eval_value.argtypes = [
    ctypes.c_void_p,
    ctypes.c_char_p,
    ctypes.POINTER(_FsValueC),
    ctypes.POINTER(_FsErrorC),
]

_LIB.fs_vm_value_free.restype = ctypes.c_int32
_LIB.fs_vm_value_free.argtypes = [ctypes.c_void_p, _FsValueC]

_LIB.fs_vm_value_type.restype = ctypes.c_uint32
_LIB.fs_vm_value_type.argtypes = [ctypes.c_void_p, _FsValueC]

_LIB.fs_vm_value_to_json.restype = ctypes.c_int32
_LIB.fs_vm_value_to_json.argtypes = [
    ctypes.c_void_p,
    _FsValueC,
    ctypes.POINTER(ctypes.c_void_p),
    ctypes.POINTER(_FsErrorC),
]

_LIB.fs_vm_value_range_info.restype = ctypes.c_int32
_LIB.fs_vm_value_range_info.argtypes = [
    ctypes.c_void_p,
    _FsValueC,
    ctypes.POINTER(ctypes.c_int64),
    ctypes.POINTER(ctypes.c_uint64),
    ctypes.POINTER(_FsErrorC),
]

_LIB.fs_vm_value_len.restype = ctypes.c_int32
_LIB.fs_vm_value_len.argtypes = [
    ctypes.c_void_p,
    _FsValueC,
    ctypes.POINTER(ctypes.c_uint64),
    ctypes.POINTER(_FsErrorC),
]

_LIB.fs_vm_value_index.restype = ctypes.c_int32
_LIB.fs_vm_value_index.argtypes = [
    ctypes.c_void_p,
    _FsValueC,
    ctypes.c_int64,
    ctypes.POINTER(_FsValueC),
    ctypes.POINTER(_FsErrorC),
]

_LIB.fs_vm_value_get_key.restype = ctypes.c_int32
_LIB.fs_vm_value_get_key.argtypes = [
    ctypes.c_void_p,
    _FsValueC,
    ctypes.c_char_p,
    ctypes.POINTER(_FsValueC),
    ctypes.POINTER(_FsErrorC),
]

_LIB.fs_vm_value_keys_json.restype = ctypes.c_int32
_LIB.fs_vm_value_keys_json.argtypes = [
    ctypes.c_void_p,
    _FsValueC,
    ctypes.POINTER(ctypes.c_void_p),
    ctypes.POINTER(_FsErrorC),
]

_LIB.fs_vm_value_call.restype = ctypes.c_int32
_LIB.fs_vm_value_call.argtypes = [
    ctypes.c_void_p,
    _FsValueC,
    ctypes.c_uint64,
    ctypes.POINTER(_FsValueC),
    ctypes.POINTER(_FsValueC),
    ctypes.POINTER(_FsErrorC),
]

_LIB.fs_free_string.restype = None
_LIB.fs_free_string.argtypes = [ctypes.c_void_p]

_LIB.fs_error_free.restype = None
_LIB.fs_error_free.argtypes = [ctypes.POINTER(_FsErrorC)]

FS_VALUE_NIL = ctypes.c_uint32.in_dll(_LIB, "FS_VALUE_NIL").value
FS_VALUE_BOOL = ctypes.c_uint32.in_dll(_LIB, "FS_VALUE_BOOL").value
FS_VALUE_NUMBER = ctypes.c_uint32.in_dll(_LIB, "FS_VALUE_NUMBER").value
FS_VALUE_INT = ctypes.c_uint32.in_dll(_LIB, "FS_VALUE_INT").value
FS_VALUE_BIGINT = ctypes.c_uint32.in_dll(_LIB, "FS_VALUE_BIGINT").value
FS_VALUE_BYTES = ctypes.c_uint32.in_dll(_LIB, "FS_VALUE_BYTES").value
FS_VALUE_GUID = ctypes.c_uint32.in_dll(_LIB, "FS_VALUE_GUID").value
FS_VALUE_DATETIME = ctypes.c_uint32.in_dll(_LIB, "FS_VALUE_DATETIME").value
FS_VALUE_STRING = ctypes.c_uint32.in_dll(_LIB, "FS_VALUE_STRING").value
FS_VALUE_LIST = ctypes.c_uint32.in_dll(_LIB, "FS_VALUE_LIST").value
FS_VALUE_KVC = ctypes.c_uint32.in_dll(_LIB, "FS_VALUE_KVC").value
FS_VALUE_RANGE = ctypes.c_uint32.in_dll(_LIB, "FS_VALUE_RANGE").value
FS_VALUE_FUNCTION = ctypes.c_uint32.in_dll(_LIB, "FS_VALUE_FUNCTION").value


def _take_c_string(ptr: int) -> str:
    if not ptr:
        return ""
    s = ctypes.cast(ptr, ctypes.c_char_p).value
    try:
        return s.decode("utf-8") if s is not None else ""
    finally:
        _LIB.fs_free_string(ctypes.c_void_p(ptr))

def _peek_c_string(ptr: int) -> str:
    if not ptr:
        return ""
    s = ctypes.cast(ptr, ctypes.c_char_p).value
    return s.decode("utf-8") if s is not None else ""


@dataclass(frozen=True)
class FsRange:
    start: int
    count: int

    def __len__(self) -> int:
        return int(self.count)

    def __iter__(self):
        return iter(range(self.start, self.start + self.count))

    def __getitem__(self, idx: int) -> int:
        if idx < 0:
            idx = self.count + idx
        if idx < 0 or idx >= self.count:
            raise IndexError(idx)
        return self.start + int(idx)


class FsFunction:
    def __init__(self, vm: "FsVm", handle: _FsValueC):
        self._vm = vm
        self._h = handle

    def close(self) -> None:
        if self._h.id != 0:
            _LIB.fs_vm_value_free(self._vm._vm, self._h)
            self._h = _FsValueC(0)

    def __del__(self) -> None:
        try:
            self.close()
        except Exception:
            pass

    def __call__(self, *args: Any) -> Any:
        return self._vm._call_handle(self._h, args)


class FsList:
    def __init__(self, vm: "FsVm", handle: _FsValueC):
        self._vm = vm
        self._h = handle

    def close(self) -> None:
        if self._h.id != 0:
            _LIB.fs_vm_value_free(self._vm._vm, self._h)
            self._h = _FsValueC(0)

    def __del__(self) -> None:
        try:
            self.close()
        except Exception:
            pass

    def __len__(self) -> int:
        return int(self._vm._value_len(self._h))

    def __getitem__(self, idx: int) -> Any:
        if isinstance(idx, slice):
            start, stop, step = idx.indices(len(self))
            return [self[i] for i in range(start, stop, step)]
        v = self._vm._value_index(self._h, int(idx))
        return self._vm._wrap_value(v)

    def __iter__(self):
        for i in range(len(self)):
            yield self[i]


class FsObject:
    def __init__(self, vm: "FsVm", handle: _FsValueC):
        self._vm = vm
        self._h = handle

    def close(self) -> None:
        if self._h.id != 0:
            _LIB.fs_vm_value_free(self._vm._vm, self._h)
            self._h = _FsValueC(0)

    def __del__(self) -> None:
        try:
            self.close()
        except Exception:
            pass

    def keys(self) -> list[str]:
        return self._vm._kvc_keys(self._h)

    def __getitem__(self, key: str) -> Any:
        v = self._vm._get_key(self._h, key)
        return self._vm._wrap_value(v)

    def get(self, key: str, default: Any = None) -> Any:
        try:
            return self[key]
        except FsError:
            return default

    def __iter__(self):
        return iter(self.keys())


def _escape_string(s: str) -> str:
    return (
        s.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t")
    )


def to_fs_literal(value: Any) -> str:
    if value is None:
        return "nil"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (bytes, bytearray)):
        b64 = base64.b64encode(bytes(value)).decode("ascii")
        return f"ChangeType(\"{b64}\",\"ByteArray\")"
    if isinstance(value, _uuid.UUID):
        return f"guid(\"{value}\")"
    if isinstance(value, _dt.datetime):
        s = value.isoformat()
        return f"Date(\"{_escape_string(s)}\")"
    if isinstance(value, str):
        return f"\"{_escape_string(value)}\""
    if isinstance(value, FsRange):
        return f"Range({value.start},{value.count})"
    if isinstance(value, list):
        return "[" + ",".join(to_fs_literal(v) for v in value) + "]"
    if isinstance(value, dict):
        parts = []
        for k, v in value.items():
            if isinstance(k, str) and k.replace("_", "").isalnum() and k[0].isalpha():
                key = k
            else:
                key = to_fs_literal(str(k))
            parts.append(f"{key}:{to_fs_literal(v)}")
        return "{" + ",".join(parts) + "}"
    raise TypeError(f"Unsupported literal type: {type(value)!r}")


def _convert_value(v: Any) -> Any:
    if isinstance(v, list):
        return [_convert_value(x) for x in v]
    if isinstance(v, dict):
        t = v.get("type")
        if t == "bytes" and isinstance(v.get("base64"), str):
            return base64.b64decode(v["base64"])
        if t == "guid" and isinstance(v.get("value"), str):
            return _uuid.UUID(v["value"])
        if t == "datetime":
            iso = v.get("iso")
            if isinstance(iso, str):
                s = iso.replace("Z", "+00:00")
                return _dt.datetime.fromisoformat(s)
            ticks = v.get("ticks")
            if isinstance(ticks, int):
                unix_epoch_ticks = 621_355_968_000_000_000
                ticks_per_sec = 10_000_000
                delta = ticks - unix_epoch_ticks
                sec = delta // ticks_per_sec
                sub = delta % ticks_per_sec
                return _dt.datetime.fromtimestamp(sec, tz=_dt.timezone.utc).replace(microsecond=(sub // 10))
        return {k: _convert_value(val) for k, val in v.items()}
    return v


class FsVm:
    def __init__(self) -> None:
        self._vm = _LIB.fs_vm_new()
        if not self._vm:
            raise RuntimeError("fs_vm_new returned NULL")

        self._host_file_read_fn = _FsHostFileReadFn(self._host_file_read_text)
        self._host_file_exists_fn = _FsHostFileExistsFn(self._host_file_exists)
        self._host_is_file_fn = _FsHostIsFileFn(self._host_is_file)
        self._host_dir_list_fn = _FsHostDirListFn(self._host_dir_list)
        self._host_log_line_fn = _FsHostLogLineFn(self._host_log_line)

        cb = _FsHostCallbacksC(
            ctypes.c_void_p(0),
            self._host_file_read_fn,
            self._host_file_exists_fn,
            self._host_is_file_fn,
            self._host_dir_list_fn,
            self._host_log_line_fn,
        )
        rc = _LIB.fs_vm_set_host_callbacks(self._vm, ctypes.byref(cb))
        if rc != 0:
            raise RuntimeError("fs_vm_set_host_callbacks failed")

    def close(self) -> None:
        if self._vm:
            _LIB.fs_vm_free(self._vm)
            self._vm = ctypes.c_void_p(0)

    def __del__(self) -> None:
        try:
            self.close()
        except Exception:
            pass

    @staticmethod
    def _host_file_read_text(user_data: int, path: Any, out_ctx: int, out_write: Any, out_err: Any) -> int:
        try:
            p = (path or b"").decode("utf-8")
            if not p:
                out_err.contents.code = 1
                return 1
            if not os.path.exists(p):
                out_err.contents.code = 1
                return 1
            if os.path.getsize(p) > 1_000_000:
                out_err.contents.code = 1
                return 1
            with open(p, "rb") as f:
                data = f.read()
            tmp = ctypes.create_string_buffer(data)
            out_write(out_ctx, ctypes.cast(tmp, ctypes.POINTER(ctypes.c_uint8)), ctypes.c_uint64(len(data)))
            return 0
        except Exception:
            out_err.contents.code = 1
            return 1

    @staticmethod
    def _host_file_exists(user_data: int, path: Any, out_exists: Any, out_err: Any) -> int:
        try:
            p = (path or b"").decode("utf-8")
            out_exists.contents.value = 1 if os.path.exists(p) else 0
            return 0
        except Exception:
            out_err.contents.code = 1
            return 1

    @staticmethod
    def _host_is_file(user_data: int, path: Any, out_is_file: Any, out_err: Any) -> int:
        try:
            p = (path or b"").decode("utf-8")
            out_is_file.contents.value = 1 if os.path.isfile(p) else 0
            return 0
        except Exception:
            out_err.contents.code = 1
            return 1

    @staticmethod
    def _host_dir_list(user_data: int, path: Any, out_ctx: int, out_write: Any, out_err: Any) -> int:
        try:
            p = (path or b"").decode("utf-8")
            if not os.path.isdir(p):
                out_err.contents.code = 1
                return 1
            entries: list[str] = []
            for name in os.listdir(p):
                entries.append(str(Path(p) / name))
            entries.sort()
            payload = ("\n".join(entries)).encode("utf-8")
            tmp = ctypes.create_string_buffer(payload)
            out_write(out_ctx, ctypes.cast(tmp, ctypes.POINTER(ctypes.c_uint8)), ctypes.c_uint64(len(payload)))
            return 0
        except Exception:
            out_err.contents.code = 1
            return 1

    @staticmethod
    def _host_log_line(user_data: int, text: Any) -> None:
        _ = user_data
        _ = text

    def _raise(self, out_err: _FsErrorC) -> None:
        try:
            msg = _peek_c_string(out_err.message) if out_err.message else ""
            raise FsError(int(out_err.code), msg or "error", int(out_err.line), int(out_err.column))
        finally:
            _LIB.fs_error_free(ctypes.byref(out_err))

    def _eval_handle(self, source: str) -> _FsValueC:
        out_val = _FsValueC(0)
        out_err = _FsErrorC(0, 0, 0, ctypes.c_void_p(0))
        rc = _LIB.fs_vm_eval_value(self._vm, source.encode("utf-8"), ctypes.byref(out_val), ctypes.byref(out_err))
        if rc == 0:
            return out_val
        self._raise(out_err)
        raise AssertionError("unreachable")

    def _value_to_json(self, h: _FsValueC) -> str:
        out_json = ctypes.c_void_p(0)
        out_err = _FsErrorC(0, 0, 0, ctypes.c_void_p(0))
        rc = _LIB.fs_vm_value_to_json(self._vm, h, ctypes.byref(out_json), ctypes.byref(out_err))
        if rc == 0:
            return _take_c_string(out_json.value)
        self._raise(out_err)
        raise AssertionError("unreachable")

    def _value_len(self, h: _FsValueC) -> int:
        out_len = ctypes.c_uint64(0)
        out_err = _FsErrorC(0, 0, 0, ctypes.c_void_p(0))
        rc = _LIB.fs_vm_value_len(self._vm, h, ctypes.byref(out_len), ctypes.byref(out_err))
        if rc == 0:
            return int(out_len.value)
        self._raise(out_err)
        raise AssertionError("unreachable")

    def _value_index(self, h: _FsValueC, idx: int) -> _FsValueC:
        out_val = _FsValueC(0)
        out_err = _FsErrorC(0, 0, 0, ctypes.c_void_p(0))
        rc = _LIB.fs_vm_value_index(self._vm, h, ctypes.c_int64(idx), ctypes.byref(out_val), ctypes.byref(out_err))
        if rc == 0:
            return out_val
        self._raise(out_err)
        raise AssertionError("unreachable")

    def _get_key(self, h: _FsValueC, key: str) -> _FsValueC:
        out_val = _FsValueC(0)
        out_err = _FsErrorC(0, 0, 0, ctypes.c_void_p(0))
        rc = _LIB.fs_vm_value_get_key(
            self._vm, h, key.encode("utf-8"), ctypes.byref(out_val), ctypes.byref(out_err)
        )
        if rc == 0:
            return out_val
        self._raise(out_err)
        raise AssertionError("unreachable")

    def _kvc_keys(self, h: _FsValueC) -> list[str]:
        out_json = ctypes.c_void_p(0)
        out_err = _FsErrorC(0, 0, 0, ctypes.c_void_p(0))
        rc = _LIB.fs_vm_value_keys_json(self._vm, h, ctypes.byref(out_json), ctypes.byref(out_err))
        if rc == 0:
            return json.loads(_take_c_string(out_json.value))
        self._raise(out_err)
        raise AssertionError("unreachable")

    def _range_info(self, h: _FsValueC) -> FsRange:
        out_start = ctypes.c_int64(0)
        out_count = ctypes.c_uint64(0)
        out_err = _FsErrorC(0, 0, 0, ctypes.c_void_p(0))
        rc = _LIB.fs_vm_value_range_info(
            self._vm, h, ctypes.byref(out_start), ctypes.byref(out_count), ctypes.byref(out_err)
        )
        if rc == 0:
            return FsRange(int(out_start.value), int(out_count.value))
        self._raise(out_err)
        raise AssertionError("unreachable")

    def _call_handle(self, callee: _FsValueC, args: tuple[Any, ...]) -> Any:
        tmp_handles: list[_FsValueC] = []
        argv: list[_FsValueC] = []
        try:
            for a in args:
                if isinstance(a, FsFunction):
                    argv.append(a._h)
                elif isinstance(a, FsList):
                    argv.append(a._h)
                elif isinstance(a, FsObject):
                    argv.append(a._h)
                else:
                    h = self._eval_handle(to_fs_literal(a))
                    tmp_handles.append(h)
                    argv.append(h)

            out_val = _FsValueC(0)
            out_err = _FsErrorC(0, 0, 0, ctypes.c_void_p(0))
            argv_arr = (_FsValueC * len(argv))(*argv) if argv else None
            rc = _LIB.fs_vm_value_call(
                self._vm,
                callee,
                ctypes.c_uint64(len(argv)),
                argv_arr,
                ctypes.byref(out_val),
                ctypes.byref(out_err),
            )
            if rc == 0:
                return self._wrap_value(out_val)
            self._raise(out_err)
            raise AssertionError("unreachable")
        finally:
            for h in tmp_handles:
                _LIB.fs_vm_value_free(self._vm, h)

    def _wrap_value(self, h: _FsValueC) -> Any:
        t = int(_LIB.fs_vm_value_type(self._vm, h))
        if t in (FS_VALUE_NIL, FS_VALUE_BOOL, FS_VALUE_NUMBER, FS_VALUE_INT, FS_VALUE_BIGINT, FS_VALUE_STRING, FS_VALUE_BYTES, FS_VALUE_GUID, FS_VALUE_DATETIME):
            s = self._value_to_json(h)
            _LIB.fs_vm_value_free(self._vm, h)
            return _convert_value(json.loads(s))
        if t == FS_VALUE_RANGE:
            r = self._range_info(h)
            _LIB.fs_vm_value_free(self._vm, h)
            return r
        if t == FS_VALUE_FUNCTION:
            return FsFunction(self, h)
        if t == FS_VALUE_LIST:
            return FsList(self, h)
        if t == FS_VALUE_KVC:
            return FsObject(self, h)

        s = self._value_to_json(h)
        _LIB.fs_vm_value_free(self._vm, h)
        return _convert_value(json.loads(s))

    def eval_json(self, source: str) -> str:
        h = self._eval_handle(source)
        try:
            return self._value_to_json(h)
        finally:
            _LIB.fs_vm_value_free(self._vm, h)

    def eval(self, source: str) -> Any:
        h = self._eval_handle(source)
        return self._wrap_value(h)

    def call(self, fn_expr: str, *args: Any) -> Any:
        callee = self._eval_handle(fn_expr)
        try:
            return self._call_handle(callee, args)
        finally:
            _LIB.fs_vm_value_free(self._vm, callee)

    def call(self, fn_expr: str, *args: Any) -> Any:
        arg_src = ",".join(to_fs_literal(a) for a in args)
        return self.eval(f"({fn_expr})({arg_src})")


_DEFAULT_VM: Optional[FsVm] = None


def _default_vm() -> FsVm:
    global _DEFAULT_VM
    if _DEFAULT_VM is None:
        _DEFAULT_VM = FsVm()
    return _DEFAULT_VM


def eval_json(source: str) -> str:
    return _default_vm().eval_json(source)


def eval(source: str) -> Any:
    return _default_vm().eval(source)

def call(fn_expr: str, *args: Any) -> Any:
    return _default_vm().call(fn_expr, *args)

