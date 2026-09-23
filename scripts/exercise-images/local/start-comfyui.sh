#!/usr/bin/env bash
# Start the local ComfyUI server used by IMAGE_PROVIDER=comfyui (localhost only).
#   bash scripts/exercise-images/local/start-comfyui.sh
set -euo pipefail
COMFYUI_DIR="${COMFYUI_DIR:-$HOME/ComfyUI}"
[[ -x "$COMFYUI_DIR/.venv/bin/python" ]] || {
  echo "ComfyUI is not installed — run scripts/exercise-images/local/setup-mac.sh first." >&2
  exit 1
}
if ! curl -s http://127.0.0.1:11434/api/version >/dev/null 2>&1 && command -v ollama >/dev/null; then
  (ollama serve >/tmp/ollama.log 2>&1 &)
fi
cd "$COMFYUI_DIR"
# Let PyTorch fall back to CPU for the few ops Metal lacks instead of crashing.
export PYTORCH_ENABLE_MPS_FALLBACK=1
exec .venv/bin/python main.py --listen 127.0.0.1 --port "${COMFYUI_PORT:-8188}" "$@"
