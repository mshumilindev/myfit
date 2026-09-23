#!/bin/bash
# Double-click to stop local generation: the CLI run, ComfyUI (and its queued jobs) and the Ollama QA model.
pkill -f "exercise-images/cli.ts" && echo "stopped the generation run"
pkill -f "ComfyUI/main.py" || pkill -f "main.py --listen 127.0.0.1 --port 8188"
sleep 2
pgrep -f "main.py --listen" >/dev/null && pkill -9 -f "main.py --listen"
echo "stopped ComfyUI"
ollama stop "${IMAGE_QA_MODEL:-qwen2.5vl:7b}" 2>/dev/null
echo "Done — memory is free again."
