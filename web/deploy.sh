#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
HOST="${DEPLOY_HOST:-root@82.25.112.116}"
DEST="${DEPLOY_DEST:-/opt/on-mars}"

rsync -avz --delete \
  --exclude 'docs/' \
  --exclude 'client/node_modules/' \
  --exclude 'client/dist/' \
  --exclude 'server/target/' \
  --exclude 'server/.git/' \
  --exclude '.git/' \
  --exclude '.env' \
  --exclude '.env.*' \
  "$ROOT/" "$HOST:$DEST/"

ssh "$HOST" "cd $DEST && docker compose up -d --build"
