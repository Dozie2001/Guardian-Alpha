#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Dozie2001/guardian-mcp.git}"
APP_DIR="${APP_DIR:-$HOME/guardian-mcp}"

sudo apt-get update
sudo apt-get install -y curl git ca-certificates

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

sudo npm install -g pm2

if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
npm install
npm run build

if [[ ! -f .env.local ]]; then
  cp .env.example .env.local
  echo "Created .env.local from .env.example."
  echo "Edit .env.local with Alpaca, Groq, Auth.js, and Telegram values before starting PM2."
  exit 0
fi

pm2 start ecosystem.config.cjs
pm2 save
pm2 status
