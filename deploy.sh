#!/usr/bin/env bash
# ============================================================
# Fortress v3 — Deploy Script
# Always deploys dist/public/ (the Vite frontend build output)
# to /var/www/fortress-v2 on the VPS via SSH.
#
# ⚠️  SSH user MUST be root — the key does NOT work for ubuntu@
# ⚠️  Deploy target is /var/www/fortress-v2 (nginx static root)
#
# Usage:
#   pnpm deploy          (from project root)
#   ./deploy.sh          (direct)
#   ./deploy.sh --skip-build   (deploy last build without rebuilding)
# ============================================================

set -euo pipefail

VPS_HOST="76.13.138.194"
VPS_USER="root"   # ⚠️  Key only works for root, NOT ubuntu
SSH_KEY="$HOME/.ssh/fortress_vps"
REMOTE_WEB_ROOT="/var/www/fortress-v2"   # ⚠️  nginx static root — DO NOT change
DIST_DIR="$(cd "$(dirname "$0")" && pwd)/dist/public"
ARCHIVE="/tmp/fortress-v2-dist.tar.gz"
SSH_OPTS="-i $SSH_KEY -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=30 -o ServerAliveInterval=10"

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
[[ -d "$DIST_DIR" ]]            || err "dist/public/ not found — run pnpm build first."
[[ -f "$DIST_DIR/index.html" ]] || err "dist/public/index.html missing — build may have failed."

# ── 3. Package ─────────────────────────────────────────────
info "Packaging dist/public/ → $ARCHIVE"
tar -czf "$ARCHIVE" -C "$DIST_DIR" .
ok "Archive created: $(du -sh "$ARCHIVE" | cut -f1)"

# ── 4. Upload ──────────────────────────────────────────────
info "Uploading to $VPS_USER@$VPS_HOST..."
scp $SSH_OPTS "$ARCHIVE" "$VPS_USER@$VPS_HOST:/tmp/"

# ── 5. Deploy on VPS ───────────────────────────────────────
info "Deploying on VPS..."
ssh $SSH_OPTS "$VPS_USER@$VPS_HOST" \
  "rm -rf ${REMOTE_WEB_ROOT}/* && \
   tar -xzf /tmp/fortress-v2-dist.tar.gz -C ${REMOTE_WEB_ROOT}/ && \
   [[ -f ${REMOTE_WEB_ROOT}/index.html ]] || { echo 'index.html missing after extract!'; exit 1; } && \
   echo 'VPS deploy OK — files: '\$(ls ${REMOTE_WEB_ROOT} | tr '\n' ' ')"

# ── 6. Verify ──────────────────────────────────────────────
DEPLOYED_JS=$(curl -s "http://${VPS_HOST}:3000/" | grep -o 'index-[a-zA-Z0-9_]*\.js' | head -1)
LOCAL_JS=$(ls "$DIST_DIR/assets/" | grep -o 'index-[a-zA-Z0-9_]*\.js' | head -1)
if [[ "$DEPLOYED_JS" == "$LOCAL_JS" ]]; then
  ok "Bundle verified: $DEPLOYED_JS matches local build."
else
  err "Bundle mismatch! VPS has '$DEPLOYED_JS' but local build has '$LOCAL_JS'"
fi

ok "Deploy complete → http://${VPS_HOST}:3000"
