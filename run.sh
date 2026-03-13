#!/usr/bin/env bash
# ──────────────────────────────────────────────────────
# CampaignX — Start Script
# Installs dependencies and launches the application
# Works on Linux/macOS (python3/pip3) and Windows Git Bash (py/pip)
# ──────────────────────────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Colors ──
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

# ── Detect Python ──
detect_python() {
  if command -v python3 &>/dev/null; then
    echo "python3"
  elif command -v python &>/dev/null; then
    echo "python"
  elif command -v py &>/dev/null; then
    echo "py"
  else
    echo ""
  fi
}

PYTHON_BIN=$(detect_python)
if [ -z "$PYTHON_BIN" ]; then
  echo -e "${RED}Error: Python not found. Install Python 3.10+ and ensure it's on your PATH.${NC}"
  exit 1
fi

echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       CampaignX — Starting Up        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo -e "       Using Python: ${GREEN}$PYTHON_BIN${NC}"

# ── 1. Install Python backend dependencies ──
echo -e "\n${GREEN}[1/3] Installing Python backend dependencies...${NC}"
$PYTHON_BIN -m pip install -r "$ROOT_DIR/backend/requirements.txt" --quiet

# ── 2. Install Node.js frontend dependencies ──
echo -e "\n${GREEN}[2/3] Installing frontend Node.js dependencies...${NC}"
(cd "$ROOT_DIR/frontend" && npm install --silent)

# ── 3. Start the frontend dev server ──
# The backend (Python) is spawned automatically by the frontend API routes
# when a campaign is started through the UI.
echo -e "\n${GREEN}[3/3] Starting CampaignX frontend dev server...${NC}"
echo -e "       ${CYAN}Backend will be launched automatically when needed.${NC}\n"
(cd "$ROOT_DIR/frontend" && npm run dev)
