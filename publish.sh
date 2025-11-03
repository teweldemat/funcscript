#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '==> %s\n' "$*"
}

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
NUGET_SOURCE=${NUGET_SOURCE:-"https://api.nuget.org/v3/index.json"}
NUGET_API_KEY=${NUGET_API_KEY:-}
NPM_TOKEN=${NPM_TOKEN:-}
VSCE_TOKEN=${VSCE_TOKEN:-}

if [[ -z "${NUGET_API_KEY}" ]]; then
  log "NUGET_API_KEY environment variable is required" >&2
  exit 1
fi
if [[ -z "${NPM_TOKEN}" ]]; then
  log "NPM_TOKEN environment variable is required" >&2
  exit 1
fi
if [[ -z "${VSCE_TOKEN}" ]]; then
  log "VSCE_TOKEN environment variable is required" >&2
  exit 1
fi

publish_nuget() {
  local project="$1"
  log "Packing NuGet project ${project}"
  dotnet pack "${project}" -c Release -o "${ROOT}/artifacts/NuGet"
}

push_nuget_packages() {
  shopt -s nullglob
  local packages=("${ROOT}"/artifacts/NuGet/*.nupkg)
  if (( ${#packages[@]} == 0 )); then
    log "No NuGet packages found in artifacts/NuGet"
    return
  fi
  for pkg in "${packages[@]}"; do
    log "Publishing $(basename "${pkg}")"
    dotnet nuget push "${pkg}" \
      --api-key "${NUGET_API_KEY}" \
      --source "${NUGET_SOURCE}" \
      --skip-duplicate
  done
  shopt -u nullglob
}

setup_npm_rc() {
  local npmrc
  npmrc=$(mktemp)
  printf '//registry.npmjs.org/:_authToken=%s\n' "${NPM_TOKEN}" > "${npmrc}"
  echo "${npmrc}"
}

publish_npm() {
  local dir="$1"
  local npmrc="$2"
  log "Publishing npm package $(basename "${dir}")"
  ( cd "${dir}" && \
    npm install --no-audit --no-fund >/dev/null && \
    npm run build --if-present >/dev/null && \
    npm publish --userconfig "${npmrc}" --access public )
}

publish_vsce() {
  log "Publishing VS Code extension"
  ( cd "${ROOT}/js-port/funcscript-vscode" && \
    npm install --no-audit --no-fund >/dev/null && \
    npm run compile >/dev/null && \
    npx vsce publish --pat "${VSCE_TOKEN}" --no-dependencies )
}

main() {
  mkdir -p "${ROOT}/artifacts/NuGet"

  publish_nuget "${ROOT}/FuncScript/FuncScript.csproj"
  publish_nuget "${ROOT}/FuncScript.Sql/FuncScript.Sql.csproj"
  push_nuget_packages

  local npmrc
  npmrc=$(setup_npm_rc)
  trap 'rm -f "${npmrc}"' EXIT

  publish_npm "${ROOT}/js-port/funcscript-js" "${npmrc}"
  publish_npm "${ROOT}/js-port/funcscript-editor" "${npmrc}"

  publish_vsce

  log "Publish workflow completed successfully"
}

main "$@"
