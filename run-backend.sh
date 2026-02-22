#!/usr/bin/env bash
# Helper to run the FastAPI backend from repository root.
# Usage: ./run-backend.sh

set -euo pipefail

# If you want to run from repo root, this script will cd into backend and run uvicorn
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/backend"

echo "Running backend from: $(pwd)"
echo "If you see 'ModuleNotFoundError: No module named app' please run this script from repo root or set PYTHONPATH to include backend/"

# Activate virtualenv if present at ./blook
if [ -f "$SCRIPT_DIR/blook/bin/activate" ]; then
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/blook/bin/activate"
fi

# Default command
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
