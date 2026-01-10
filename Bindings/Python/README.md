### FuncScript core Python binding (ctypes)

### Build the Rust shared library

```bash
cd funcscript-core
cargo build --release
```

On macOS this produces `funcscript-core/target/release/libfuncscript_core.dylib`.

### Run Python tests

```bash
cd Bindings/Python
PYTHONPATH=. python3 -m unittest discover -s tests -p 'test_*.py' -q
```

### Usage

```python
from funcscript_core import eval, FsVm, FsError

print(eval("1+2"))

vm = FsVm()
try:
    print(vm.eval('"a"+"b"'))
    r = vm.eval("Range(3,4)")
    print(list(r))
    f = vm.eval("(x)=>x+1")
    print(f(2))
except FsError as e:
    print(e.code, e.message, e.line, e.column)
finally:
    vm.close()
```

### Custom library path

If you want to load a library from a custom path:

```bash
export FUNCSCRIPT_CORE_LIB="/absolute/path/to/libfuncscript_core.dylib"
```
