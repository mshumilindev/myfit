#!/usr/bin/env bash
# Builds the Spotter Android APK locally (no CI, no push) and puts it in ~/Downloads/Spotter.apk.
# Double-click in Finder or run: ./build-apk.command [--debug]
#   default : release APK signed with YOUR permanent key (created once in ~/.spotter-android/ — BACK IT UP)
#   --debug : debug-signed APK, only for a quick smoke test on your own phone (cannot update a release install)
# Needs: Node 22+, JDK 21, Android SDK (Android Studio → SDK Manager: Platform 36 + Build-Tools).
set -euo pipefail
cd "$(dirname "$0")"

MODE=release
[ "${1:-}" = "--debug" ] && MODE=debug

say() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

# --- Node ---------------------------------------------------------------------------------------
command -v node >/dev/null || die "Node.js not found (need 22+)."
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ] || die "Node $(node -v) is too old, need 22+."

# --- JDK 21 -------------------------------------------------------------------------------------
java_major() { case "$1" in *[Gg]raal*) echo 0; return;; esac; "$1/bin/java" -version 2>&1 | grep -qi graal && { echo 0; return; }; [ -x "$1/bin/jlink" ] && [ -d "$1/jmods" ] || { echo 0; return; }; "$1/bin/java" -version 2>&1 | head -1 | sed -E 's/.*"([0-9]+)[.".].*/\1/'; }
find_jdk21() {
  local c
  [ -n "${JAVA_HOME:-}" ] && [ "$(java_major "$JAVA_HOME" 2>/dev/null || echo 0)" = 21 ] && { echo "$JAVA_HOME"; return; }
  c=$(/usr/libexec/java_home -v 21 2>/dev/null || true); [ -n "$c" ] && [ "$(java_major "$c" 2>/dev/null || echo 0)" = 21 ] && { echo "$c"; return; }
  for c in "$HOME"/.spotter-android/jdk/*/Contents/Home "$HOME"/.sdkman/candidates/java/21*tem "$HOME"/.sdkman/candidates/java/21*-amzn "$HOME"/.sdkman/candidates/java/21*-zulu "$HOME"/.sdkman/candidates/java/21*-oracle "$HOME"/.sdkman/candidates/java/21*-open /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
           "/Applications/Android Studio.app/Contents/jbr/Contents/Home"; do
    [ -x "$c/bin/java" ] && [ "$(java_major "$c" 2>/dev/null || echo 0)" = 21 ] && { echo "$c"; return; }
  done
}
JDK=$(find_jdk21 || true)
if [ -z "$JDK" ]; then
  echo "No full JDK 21 with jlink/jmods (GraalVM does not work). Downloading Temurin 21 into ~/.spotter-android/jdk ..."
  case "$(uname -m)" in arm64) ARCH=aarch64;; *) ARCH=x64;; esac
  mkdir -p "$HOME/.spotter-android/jdk" && curl -fL "https://api.adoptium.net/v3/binary/latest/21/ga/mac/$ARCH/jdk/hotspot/normal/eclipse" | tar -xz -C "$HOME/.spotter-android/jdk" || die "Temurin download failed"
  JDK=$(find_jdk21 || true)
fi
[ -n "$JDK" ] || die "JDK 21 not found. Install it (brew install --cask temurin@21) or use Android Studio's bundled JDK 21."
export JAVA_HOME="$JDK"; export PATH="$JAVA_HOME/bin:$PATH"
echo "JDK: $JAVA_HOME"

# --- Android SDK --------------------------------------------------------------------------------
find_sdk() {
  local c
  for c in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" "$HOME/Library/Android/sdk" "$HOME/Android/Sdk" "$HOME/Android/sdk" \
           /opt/homebrew/share/android-commandlinetools /usr/local/share/android-commandlinetools; do
    if [ -n "$c" ] && { [ -d "$c/platforms" ] || [ -d "$c/build-tools" ]; }; then echo "$c"; return; fi
  done
}
SDK=$(find_sdk || true)
if [ -z "$SDK" ]; then
  SDK="$HOME/Library/Android/sdk"
  printf '\nAndroid SDK not found. Install the command-line SDK (Platform 36 + Build-Tools 36.0.0, ~1 GB) into %s from dl.google.com? [Y/n] ' "$SDK"
  read -r ANSWER || ANSWER=n
  case "${ANSWER:-Y}" in n|N) die "Install Android Studio (SDK Manager: Platform 36 + Build-Tools) or set ANDROID_HOME, then run again." ;; esac
  TMPZ=$(mktemp -d)
  curl -fL -o "$TMPZ/cmdline.zip" "https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip"
  mkdir -p "$SDK/cmdline-tools"
  unzip -q "$TMPZ/cmdline.zip" -d "$TMPZ"
  rm -rf "$SDK/cmdline-tools/latest"; mv "$TMPZ/cmdline-tools" "$SDK/cmdline-tools/latest"
  yes | "$SDK/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK" --licenses >/dev/null 2>&1 || true
  "$SDK/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK" "platform-tools" "platforms;android-36" "build-tools;36.0.0"
fi
export ANDROID_HOME="$SDK"; export ANDROID_SDK_ROOT="$SDK"
echo "Android SDK: $ANDROID_HOME"
SDKMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
if [ -x "$SDKMANAGER" ]; then
  say "Accepting SDK licenses (needed once so Gradle can fetch missing SDK parts)"
  yes | "$SDKMANAGER" --licenses >/dev/null 2>&1 || true
fi

# --- Web shell deps -----------------------------------------------------------------------------
say "npm ci + cap sync"
npm ci --no-audit --no-fund
npx cap sync android

# --- Signing ------------------------------------------------------------------------------------
if [ "$MODE" = release ]; then
  KEYDIR="$HOME/.spotter-android"; KS="$KEYDIR/spotter-release.jks"; ENVF="$KEYDIR/keystore.env"
  if [ ! -f "$KS" ]; then
    say "Creating your permanent release key in $KEYDIR"
    mkdir -p "$KEYDIR"; chmod 700 "$KEYDIR"
    PASS=$(openssl rand -hex 16)
    keytool -genkeypair -noprompt -keystore "$KS" -alias spotter -keyalg RSA -keysize 4096 -validity 10000 \
      -storepass "$PASS" -keypass "$PASS" -dname "CN=Spotter, O=Spotter"
    printf 'SPOTTER_KEYSTORE_PASSWORD=%s\nSPOTTER_KEY_ALIAS=spotter\nSPOTTER_KEY_PASSWORD=%s\n' "$PASS" "$PASS" > "$ENVF"
    chmod 600 "$KS" "$ENVF"
    printf '\n!!! BACK UP %s (both files) somewhere safe. An APK can update an installed Spotter only if it is signed\n!!! with this same key. If you lose it, users must uninstall and reinstall.\n' "$KEYDIR"
  fi
  set -a; . "$ENVF"; set +a
  export SPOTTER_KEYSTORE_PATH="$KS"
fi

# --- Build --------------------------------------------------------------------------------------
say "Gradle build ($MODE)"
START=$(date +%s)
mkdir -p apk-out
LOG="$PWD/apk-out/build.log"
TASK=assembleRelease; SRC=android/app/build/outputs/apk/release/app-release.apk
if [ "$MODE" = debug ]; then TASK=assembleDebug; SRC=android/app/build/outputs/apk/debug/app-debug.apk; fi
set +e
(cd android && ./gradlew --stop >/dev/null 2>&1; ./gradlew "$TASK" --console=plain -Dorg.gradle.java.home="$JAVA_HOME" 2>&1 | tee "$LOG"; exit "${PIPESTATUS[0]}")
RC=$?
set -e
[ "$RC" -eq 0 ] || die "Gradle build failed. Full log: $LOG"
SECS=$(( $(date +%s) - START ))

VERSION=$(node -p "require('./package.json').version")
mkdir -p apk-out
SUFFIX=""; if [ "$MODE" = debug ]; then SUFFIX="-debug"; fi
OUT="apk-out/Spotter-$VERSION$SUFFIX.apk"
cp "$SRC" "$OUT"

APKSIGNER="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)/apksigner"
say "Signature"
"$APKSIGNER" verify --print-certs "$OUT" | grep -E "Signer #1 certificate (DN|SHA-256)"

say "Done in ${SECS}s"
echo "File:   $PWD/$OUT"
echo "Size:   $(stat -f %z "$OUT") bytes"
echo "SHA256: $(shasum -a 256 "$OUT" | cut -d' ' -f1)"
DL="$HOME/Downloads/Spotter.apk"
cp -f "$OUT" "$DL"
echo "Copied: $DL"
command -v open >/dev/null && open -R "$DL" || true
