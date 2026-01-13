from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

from setuptools import setup
from setuptools.command.build_py import build_py as _build_py


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


class build_py(_build_py):
    def run(self) -> None:
        repo = _repo_root()
        core = repo / "funcscript-core"
        target = core / "target" / "release"

        subprocess.check_call(["cargo", "build", "--release"], cwd=str(core))

        py_root = Path(__file__).resolve().parent
        native_dirs = [
            py_root / "funcscript" / "native",
            py_root / "funcscript_core" / "native",
        ]
        for d in native_dirs:
            d.mkdir(parents=True, exist_ok=True)

        copied = False
        names = []
        if os.name == "nt":
            names = ["funcscript.dll"]
        elif sys.platform == "darwin":
            names = ["libfuncscript.dylib"]
        else:
            names = ["libfuncscript.so"]

        for n in names:
            src = target / n
            if src.exists():
                for d in native_dirs:
                    shutil.copy2(src, d / n)
                copied = True

        if not copied:
            tried = "\n".join(str(target / n) for n in names)
            raise RuntimeError(f"Built Rust core but could not find shared library. Tried:\n{tried}")

        super().run()


setup(cmdclass={"build_py": build_py})

