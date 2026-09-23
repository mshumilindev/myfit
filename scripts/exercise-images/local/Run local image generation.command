#!/bin/bash
# Double-click in Finder: one-time setup (ComfyUI + Qwen-Image-Edit-2511 + Ollama),
# starts the local ComfyUI server and generates Pullups (start, end, hero).
# Progress is logged to assets/exercise-images/local-run.log.
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
cd "$(dirname "$0")/../../.." || exit 1
mkdir -p assets/exercise-images
LOG=assets/exercise-images/local-run.log
exec > >(tee -a "$LOG") 2>&1
echo "=== $(date) ==="

bash scripts/exercise-images/local/setup-mac.sh "${COMFYUI_PRESET:-qwen-edit-2511}" || {
  echo "SETUP FAILED"
  read -r -p "Press Enter to close"
  exit 1
}

if ! curl -s http://127.0.0.1:8188/system_stats >/dev/null; then
  echo "▸ starting ComfyUI (log: assets/exercise-images/comfyui.log)"
  bash scripts/exercise-images/local/start-comfyui.sh >assets/exercise-images/comfyui.log 2>&1 &
  for _ in $(seq 1 120); do
    curl -s http://127.0.0.1:8188/system_stats >/dev/null && break
    sleep 5
  done
fi
curl -s http://127.0.0.1:8188/system_stats >/dev/null || {
  echo "COMFYUI DID NOT START — see assets/exercise-images/comfyui.log"
  read -r -p "Press Enter to close"
  exit 1
}

echo "▸ generating Pullups"
IMAGE_PROVIDER=comfyui npm run exercise-images -- generate --exercise "${EXERCISE:-Pullups}" --states start,end,hero
open assets/exercise-images/review/index.html
echo "=== FINISHED $(date) — ComfyUI keeps running in this window; close it to stop ==="
wait
