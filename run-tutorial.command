#!/bin/zsh
# Launches the mobile tutorial recorder against the local dev server.
source ~/.zprofile 2>/dev/null
source ~/.zshrc 2>/dev/null
export PATH="$HOME/.nvm/versions/node/$(ls ~/.nvm/versions/node 2>/dev/null | tail -1)/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$HOME/Desktop/Work/training/gym-tracker" || exit 1
echo "node: $(command -v node)  npm: $(command -v npm)"
npm run tutorial:mobile:first-workout
echo "----------------------------------------"
echo "Done. You can close this window."
