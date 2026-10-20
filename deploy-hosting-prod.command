#!/bin/zsh
# Build the client for PRODUCTION (https://myspotter.fit) and deploy it to the Hosting site "myspotter-fit".
# The test site (spotter-64c3b.web.app) is deployed by deploy-hosting.command. Double-click or run from a terminal.
source ~/.zprofile 2>/dev/null
source ~/.zshrc 2>/dev/null
export PATH="$HOME/.nvm/versions/node/$(ls ~/.nvm/versions/node 2>/dev/null | tail -1)/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$HOME/Desktop/Work/training/gym-tracker" || exit 1
echo "▶ Building client for prod…"
VITE_APP_ORIGIN=https://myspotter.fit npm run build -w client || { echo "✗ Build failed"; exit 1; }
# Same firebase.json, only the site differs.
node -e 'const c=require("./firebase.json");c.hosting.site="myspotter-fit";require("fs").writeFileSync("firebase.prod.tmp.json",JSON.stringify(c,null,2))'
echo "▶ Deploying hosting to myspotter-fit…"
if command -v firebase >/dev/null 2>&1; then
  firebase deploy --only hosting --config firebase.prod.tmp.json --project spotter-64c3b
else
  npx -y firebase-tools deploy --only hosting --config firebase.prod.tmp.json --project spotter-64c3b
fi
rm -f firebase.prod.tmp.json
echo "✓ Prod deploy finished $(date '+%H:%M:%S')" | tee .deploy-last-prod.log
