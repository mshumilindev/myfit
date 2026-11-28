#!/bin/bash
# Builds the native Progress Widget, installs it as an app and starts it at login.
# Usage: install-widget.sh [swift-source] [owner/repo]   (idempotent)
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="${1:-$HERE/ProgressWidget.swift}"
REPO="${2:-$(sed -n 's/.*"repo": *"\([^"]*\)".*/\1/p' "$HERE/../devflow.config.json" | head -1)}"
APP="$HOME/Applications/Progress Widget.app"
STATE="$HOME/.devflow/wf-state"
mkdir -p "$APP/Contents/MacOS" "$HOME/.devflow"
if [ ! -d "$STATE/.git" ]; then
  git clone --quiet --depth 1 --single-branch --branch wf-state "https://github.com/$REPO" "$STATE" || echo "warning: clone of wf-state failed (no GitHub access yet?)"
fi
swiftc -O "$SRC" -o "$APP/Contents/MacOS/ProgressWidget"
[ -n "${CLAUDE_PROJECT_DIR:-}" ] && echo "$CLAUDE_PROJECT_DIR" > "$HOME/.devflow/project-dir"
mkdir -p "$HOME/.devflow/widget"
shasum -a 256 "$SRC" | cut -d' ' -f1 > "$HOME/.devflow/widget/installed-version"
cat > "$APP/Contents/Info.plist" <<'PL'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Progress Widget</string>
<key>CFBundleIdentifier</key><string>dev.devflow.progresswidget</string>
<key>CFBundleExecutable</key><string>ProgressWidget</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>LSUIElement</key><true/>
</dict></plist>
PL
LA="$HOME/Library/LaunchAgents/dev.devflow.progresswidget.plist"
cat > "$LA" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>dev.devflow.progresswidget</string>
<key>ProgramArguments</key><array><string>$APP/Contents/MacOS/ProgressWidget</string></array>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
</dict></plist>
PL
launchctl unload "$LA" 2>/dev/null || true
launchctl load "$LA"
echo "Progress Widget installed and running."
