#!/bin/zsh
# Build the client and deploy it to Firebase Hosting (spotter-64c3b.web.app).
# Double-click in Finder, or run from a terminal.
source ~/.zprofile 2>/dev/null
source ~/.zshrc 2>/dev/null
export PATH="$HOME/.nvm/versions/node/$(ls ~/.nvm/versions/node 2>/dev/null | tail -1)/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$HOME/Desktop/Work/training/gym-tracker" || exit 1
echo "▶ Building client…"
npm run build -w client || { echo "✗ Build failed"; exit 1; }
echo "▶ Deploying hosting…"
if command -v firebase >/dev/null 2>&1; then
  firebase deploy --only hosting --project spotter-64c3b
else
  npx -y firebase-tools deploy --only hosting --project spotter-64c3b
fi
echo "✓ Deploy finished $(date '+%H:%M:%S')" | tee .deploy-last.log
