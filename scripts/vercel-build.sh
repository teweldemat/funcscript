#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() {
  echo "[vercel-build] $*"
}

log "Prebuilding FuncScript editor package"
pushd "${ROOT_DIR}/js-port/funcscript-editor" >/dev/null
npm ci
npm run build
popd >/dev/null

log "Building interactive docs widget"
pushd "${ROOT_DIR}/tools/live-examples-widget" >/dev/null
npm ci
npm run build
popd >/dev/null

log "Installing MkDocs dependencies"
MKDOCS_VENV_DIR="$(mktemp -d)"
trap 'rm -rf "$MKDOCS_VENV_DIR"' EXIT
python3 -m venv "$MKDOCS_VENV_DIR"
"$MKDOCS_VENV_DIR/bin/python" -m pip install --upgrade pip
"$MKDOCS_VENV_DIR/bin/python" -m pip install -r docs/requirements.txt

log "Building MkDocs site into ./public"
"$MKDOCS_VENV_DIR/bin/python" -m mkdocs build --strict --clean --site-dir public

log "Hydrating FuncScript Studio into ./public/fsstudio"
FSTUDIO_OUTPUT_DIR="${ROOT_DIR}/public/fsstudio" \
  bash js-port/funcscript-vscode/scripts/vercel-build.sh

log "Build complete"
