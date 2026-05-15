#!/usr/bin/env bash
# ============================================================
# Fortress v3 — Deploy Script
# Always deploys dist/public/ (the Vite frontend build output)
# to /var/www/fortress-v2 on the VPS via SSH.
#
# Usage:
#   pnpm deploy          (from project root)
#   ./deploy.sh          (direct)
#   ./deploy.sh --skip-build   (deploy last build without rebuilding)
# ============================================================

set -euo pipefail

VPS_HOST="76.13.138.194"
VPS_USER="ubuntu"
SSH_KEY="$HOME/.ssh/fortress_vps"
REMOTE_WEB_ROOT="/var/www/fortress-v2"
DIST_DIR="$(cd "$(dirname "$0")" && pwd)/dist/public"
ARCHIVE="/tmp/fortress-v2-dist.tar.gz"

# ── Colour helpers ──────────────────────────────────────────
GREEN='\033[0;32m'; CYAN='\033[0;36m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${CYAN}[deploy]${NC} $*"; }
ok()    { echo -e "${GREEN}[deploy]${NC} $*"; }
err()   { echo -e "${RED}[deploy] ERROR:${NC} $*" >&2; exit 1; }

# ── 1. Build (unless --skip-build) ─────────────────────────
if [[ "${1:-}" != "--skip-build" ]]; then
  info "Building project..."
  pnpm build
  ok "Build complete."
else
  info "Skipping build (--skip-build flag set)."
fi

# ── 2. Verify dist/public exists and contains index.html ───
[[ -d "$DIST_DIR" ]]          || err "dist/public/ not found — run pnpm build first."
[[ -f "$DIST_DIR/index.html" ]] || err "dist/public/index.html missing — build may have failed."

# ── 3. Package ─────────────────────────────────────────────
info "Packaging dist/public/ → $ARCHIVE"
tar -czf "$ARCHIVE" -C "$DIST_DIR" .
ok "Archive created: $(du -sh "$ARCHIVE" | cut -f1)"

# ── 4. Upload ──────────────────────────────────────────────
info "Uploading to $VPS_USER@$VPS_HOST..."
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=30 -o ServerAliveInterval=10 "$ARCHIVE" "$VPS_USER@$VPS_HOST:/tmp/"

# ── 5. Deploy on VPS ───────────────────────────────────────
info "Deploying on VPS..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=30 -o ServerAliveInterval=10 "$VPS_USER@$VPS_HOST" \
  "sudo rm -rf ${REMOTE_WEB_ROOT}/* && \
   sudo tar -xzf /tmp/fortress-v2-dist.tar.gz -C ${REMOTE_WEB_ROOT}/ && \
   [[ -f ${REMOTE_WEB_ROOT}/index.html ]] || { echo 'index.html missing after extract!'; exit 1; } && \
   echo 'VPS deploy OK — files: '\$(ls ${REMOTE_WEB_ROOT} | tr '\n' ' ')"

ok "Deploy complete → http://${VPS_HOST}:3000"
