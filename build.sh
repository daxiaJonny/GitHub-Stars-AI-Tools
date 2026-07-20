#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

NODE_VERSION=24

info() {
  printf '[build] %s\n' "$*"
}

die() {
  printf '[build] ERROR: %s\n' "$*" >&2
  exit 1
}

load_nvm() {
  if command -v nvm >/dev/null 2>&1; then
    return 0
  fi

  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
    return 0
  fi

  for nvm_script in \
    "/opt/homebrew/opt/nvm/nvm.sh" \
    "/usr/local/opt/nvm/nvm.sh"
  do
    if [ -s "$nvm_script" ]; then
      # shellcheck source=/dev/null
      . "$nvm_script"
      return 0
    fi
  done

  return 1
}

use_node() {
  if load_nvm; then
    info "Running nvm use 24"
    nvm use 24 || die "Node 24 is not installed for nvm. Run: nvm install 24"
  fi

  command -v node >/dev/null 2>&1 || die "Node.js is not available. Install Node 24 or run: nvm install 24"

  local node_major
  node_major="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null)" \
    || die "Unable to read Node.js version."

  if [ "$node_major" -lt "$NODE_VERSION" ]; then
    die "Node.js 24+ is required. Current: $(node --version). Run: nvm install 24 && nvm use 24"
  fi
}

ensure_pnpm() {
  if command -v corepack >/dev/null 2>&1; then
    info "Enabling Corepack"
    corepack enable
  fi

  command -v pnpm >/dev/null 2>&1 || die "pnpm is not available. Enable Corepack or install pnpm 11+."

  local pnpm_version pnpm_major
  pnpm_version="$(pnpm --version)"
  pnpm_major="$(printf '%s' "$pnpm_version" | awk -F. '{print $1}')"
  if [ "$pnpm_major" -lt 11 ]; then
    die "pnpm 11+ is required. Current: $pnpm_version"
  fi
}

ensure_rust() {
  command -v cargo >/dev/null 2>&1 || die "Rust Cargo is not available. Install Rust before building the Tauri desktop app."
}

use_node
ensure_pnpm
ensure_rust

info "Installing dependencies"
pnpm install --frozen-lockfile

info "Building desktop app package"
exec pnpm package:desktop
