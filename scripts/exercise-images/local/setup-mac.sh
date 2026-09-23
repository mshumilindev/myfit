#!/usr/bin/env bash
# One-time local setup for free exercise-image generation on Apple Silicon.
#   bash scripts/exercise-images/local/setup-mac.sh [qwen-edit-2511|flux2-klein-4b|all]
# Installs (idempotent, resumable downloads):
#   • ComfyUI in $COMFYUI_DIR (default ~/ComfyUI) with its own Python via uv
#   • city96/ComfyUI-GGUF (loads the quantised Qwen models)
#   • model files for the preset (Qwen-Image-Edit-2511 ≈ 20 GB, FLUX.2 klein 4B ≈ 16 GB)
#   • Ollama + qwen2.5vl:7b for local QA (≈ 6 GB)
# Nothing here touches the repo except `npm install` (sharp for WebP output).
set -euo pipefail

PRESET="${1:-qwen-edit-2511}"
COMFYUI_DIR="${COMFYUI_DIR:-$HOME/ComfyUI}"
QA_MODEL="${IMAGE_QA_MODEL:-qwen2.5vl:7b}"
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
HF="https://huggingface.co"

say() { printf '\n\033[1;33m▸ %s\033[0m\n' "$*"; }

[[ "$(uname -s)" == "Darwin" && "$(uname -m)" == "arm64" ]] || {
  echo "This script is for Apple Silicon macOS." >&2
  exit 1
}

need_gb=30
[[ "$PRESET" == "flux2-klein-4b" ]] && need_gb=24
[[ "$PRESET" == "all" ]] && need_gb=45
free_gb=$(df -g "$HOME" | awk 'NR==2 {print $4}')
if ((free_gb < need_gb)); then
  echo "Need ~${need_gb} GB free in $HOME, have ${free_gb} GB." >&2
  exit 1
fi

say "uv (Python manager)"
if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

say "ComfyUI → $COMFYUI_DIR"
if [[ ! -d "$COMFYUI_DIR/.git" ]]; then
  git clone --depth 1 https://github.com/comfyanonymous/ComfyUI.git "$COMFYUI_DIR"
else
  git -C "$COMFYUI_DIR" pull --ff-only || echo "(could not update ComfyUI — continuing with the current version)"
fi
cd "$COMFYUI_DIR"
[[ -d .venv ]] || uv venv --python 3.12 .venv
# Stable PyTorch wheels ship the Metal (MPS) backend for Apple Silicon.
uv pip install --python .venv/bin/python torch torchvision torchaudio
uv pip install --python .venv/bin/python -r requirements.txt

say "ComfyUI-GGUF"
if [[ ! -d custom_nodes/ComfyUI-GGUF/.git ]]; then
  git clone --depth 1 https://github.com/city96/ComfyUI-GGUF.git custom_nodes/ComfyUI-GGUF
else
  git -C custom_nodes/ComfyUI-GGUF pull --ff-only || true
fi
uv pip install --python .venv/bin/python -r custom_nodes/ComfyUI-GGUF/requirements.txt

remote_size() { # final Content-Length after redirects ("" if unknown)
  curl -sIL --retry 3 "$1" | tr -d '\r' | awk 'tolower($1)=="content-length:" {n=$2} END {print n}'
}

fetch() { # fetch <models subdir> <file name> <url>
  local dir="models/$1" dest="models/$1/$2" url="$3" want have
  mkdir -p "$dir"
  # Another downloader (e.g. an earlier run) may still be writing this file — wait for it.
  while pgrep -f -- "$2" | grep -vq "^$$\$"; do
    echo "  … $2 is being downloaded by another process, waiting"
    sleep 30
  done
  want="$(remote_size "$url")"
  if [[ -f "$dest" ]]; then
    have=$(stat -f %z "$dest")
    if [[ -z "$want" || "$have" == "$want" ]]; then
      echo "  ✓ $2"
      return
    fi
    # Complete-looking name but short: continue it as a partial download.
    [[ -e "$dest.part" ]] || mv "$dest" "$dest.part"
  fi
  if [[ -n "$want" && -f "$dest.part" && "$(stat -f %z "$dest.part")" == "$want" ]]; then
    mv "$dest.part" "$dest"
    echo "  ✓ $2"
    return
  fi
  echo "  ↓ $2 ($((${want:-0} / 1024 / 1024)) MB)"
  curl -fL --retry 10 --retry-delay 5 --retry-all-errors -C - -# -o "$dest.part" "$url"
  have=$(stat -f %z "$dest.part")
  if [[ -n "$want" && "$have" != "$want" ]]; then
    echo "  ✗ $2: got $have of $want bytes — rerun the script to resume" >&2
    exit 1
  fi
  mv "$dest.part" "$dest"
}

if [[ "$PRESET" == "qwen-edit-2511" || "$PRESET" == "all" ]]; then
  say "Qwen-Image-Edit-2511 (Apache-2.0) — GGUF Q4_K_M + Lightning 4-step LoRA"
  fetch unet qwen-image-edit-2511-Q4_K_M.gguf \
    "$HF/unsloth/Qwen-Image-Edit-2511-GGUF/resolve/main/qwen-image-edit-2511-Q4_K_M.gguf"
  fetch text_encoders Qwen2.5-VL-7B-Instruct-UD-Q4_K_XL.gguf \
    "$HF/unsloth/Qwen2.5-VL-7B-Instruct-GGUF/resolve/main/Qwen2.5-VL-7B-Instruct-UD-Q4_K_XL.gguf"
  # The vision tower must share the text encoder's name prefix to be picked up.
  fetch text_encoders Qwen2.5-VL-7B-Instruct-mmproj-BF16.gguf \
    "$HF/unsloth/Qwen2.5-VL-7B-Instruct-GGUF/resolve/main/mmproj-BF16.gguf"
  fetch vae qwen_image_vae.safetensors \
    "$HF/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors"
  fetch loras Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors \
    "$HF/lightx2v/Qwen-Image-Edit-2511-Lightning/resolve/main/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors"
fi

if [[ "$PRESET" == "flux2-klein-4b" || "$PRESET" == "all" ]]; then
  say "FLUX.2 [klein] 4B (Apache-2.0) — bf16 (fp8 files don't run on Metal)"
  fetch diffusion_models flux-2-klein-4b.safetensors \
    "$HF/black-forest-labs/FLUX.2-klein-4B/resolve/main/flux-2-klein-4b.safetensors"
  fetch text_encoders qwen_3_4b.safetensors \
    "$HF/Comfy-Org/flux2-klein-4B/resolve/main/split_files/text_encoders/qwen_3_4b.safetensors"
  fetch vae flux2-vae.safetensors \
    "$HF/Comfy-Org/flux2-dev/resolve/main/split_files/vae/flux2-vae.safetensors"
fi

say "Ollama + $QA_MODEL (local QA)"
if ! command -v ollama >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    brew install ollama
  else
    echo "Install Ollama from https://ollama.com/download, then rerun this script." >&2
    exit 1
  fi
fi
if ! curl -s http://127.0.0.1:11434/api/version >/dev/null; then
  (ollama serve >/tmp/ollama.log 2>&1 &)
  sleep 3
fi
ollama pull "$QA_MODEL"

say "Repo dependencies (sharp for WebP)"
(cd "$REPO_ROOT" && npm install)

say "Done."
cat <<EOF
Next:
  1) bash scripts/exercise-images/local/start-comfyui.sh      # keep this terminal open
  2) in .env:  IMAGE_PROVIDER=comfyui
  3) npm run exercise-images -- generate --exercise Pullups --states start,end,hero
EOF
