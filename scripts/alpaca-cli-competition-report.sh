#!/usr/bin/env bash
set -euo pipefail

REPORT_DIR="${REPORT_DIR:-runs/alpaca-cli-competition-report}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${REPORT_DIR}/${STAMP}"

if ! command -v alpaca >/dev/null 2>&1; then
  cat >&2 <<'MSG'
The Alpaca CLI is not installed or not on PATH.

Install it, then rerun:
  brew install alpacahq/tap/cli
  alpaca profile login --api-key
  npm run alpaca:competition-report
MSG
  exit 127
fi

export ALPACA_LIVE_TRADE="${ALPACA_LIVE_TRADE:-false}"
export ALPACA_OUTPUT="${ALPACA_OUTPUT:-json}"
export ALPACA_QUIET="${ALPACA_QUIET:-true}"

mkdir -p "${OUT_DIR}"

alpaca version > "${OUT_DIR}/alpaca-version.txt"
alpaca doctor > "${OUT_DIR}/alpaca-doctor.txt"
alpaca account get --quiet > "${OUT_DIR}/account.json"
alpaca account portfolio --quiet > "${OUT_DIR}/portfolio.json"
alpaca position list --quiet > "${OUT_DIR}/positions.json"
alpaca order list --status all --limit 500 --quiet > "${OUT_DIR}/orders.json"

cat > "${OUT_DIR}/README.md" <<MSG
# Alpaca CLI Competition Report

Generated: ${STAMP}

This folder was generated with Alpaca's official CLI against the configured paper trading account.

Files:
- account.json
- portfolio.json
- positions.json
- orders.json
- alpaca-doctor.txt
- alpaca-version.txt
MSG

echo "Alpaca CLI competition report written to ${OUT_DIR}"
