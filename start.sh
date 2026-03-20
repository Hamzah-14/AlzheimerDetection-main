#!/usr/bin/env bash
# start.sh
# Launches both the Python FastAPI backend and the Next.js frontend.
# Run from the repo root (the folder containing ThePipelineComplete/ and UI/).
#
# Usage:
#   chmod +x start.sh
#   ./start.sh
#
# Requirements:
#   - Python 3.10+ with packages from ThePipelineComplete/requirements.txt
#   - Node 18+ with `npm install` already run inside UI/frontend/
#
# Stop both servers: Ctrl+C once — the trap below handles cleanup.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPELINE_DIR="$ROOT_DIR/ThePipelineComplete"
FRONTEND_DIR="$ROOT_DIR/UI/frontend"

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${CYAN}[start.sh]${NC} $*"; }
ok()   { echo -e "${GREEN}[start.sh]${NC} $*"; }
fail() { echo -e "${RED}[start.sh]${NC} $*"; exit 1; }

# ── Preflight checks ──────────────────────────────────────────────────────────
command -v python3  >/dev/null 2>&1 || fail "python3 not found"
command -v uvicorn  >/dev/null 2>&1 || fail "uvicorn not found — run: pip install -r ThePipelineComplete/requirements.txt"
command -v npm      >/dev/null 2>&1 || fail "npm not found"

[[ -d "$FRONTEND_DIR/node_modules" ]] || fail "node_modules missing — run: cd UI/frontend && npm install"

# ── Cleanup on exit ───────────────────────────────────────────────────────────
PIDS=()
cleanup() {
    log "Shutting down…"
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null || true
    ok "All processes stopped."
}
trap cleanup EXIT INT TERM

# ── Start backend ─────────────────────────────────────────────────────────────
log "Starting FastAPI backend on http://localhost:8000"
(
  cd "$PIPELINE_DIR"
  uvicorn server:app --host 0.0.0.0 --port 8000 2>&1 | sed 's/^/[backend] /'
) &
PIDS+=($!)

# Give uvicorn a moment to bind before Next.js starts
sleep 2

# ── Start frontend ────────────────────────────────────────────────────────────
log "Starting Next.js frontend on http://localhost:3000"
(
  cd "$FRONTEND_DIR"
  npm run dev 2>&1 | sed 's/^/[frontend] /'
) &
PIDS+=($!)

ok "Both servers running."
ok "  Backend  → http://localhost:8000"
ok "  Frontend → http://localhost:3000"
echo ""
log "Press Ctrl+C to stop."

# Wait for either process to exit
wait -n 2>/dev/null || wait
