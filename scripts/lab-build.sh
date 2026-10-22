#!/bin/bash
# usage: bash scripts/lab-build.sh <outname> [variants e.g. v03 or v03,v04]  (default: all)   -> client/design-lab/out/<outname>.tgz (dist + only the public assets it references)
set -e
set +o pipefail
cd "$(dirname "$0")/../client"
OUT=${1:-all}; export LAB_ONLY=${2:-}
LAB_ONLY=${2:-} LAB_OUT=$PWD/design-lab/out/$OUT npx vite build -c design-lab/vite.config.ts >/tmp/lab-build-$OUT.log 2>&1 || { tail -40 /tmp/lab-build-$OUT.log; exit 1; }
D=design-lab/out/$OUT
# copy referenced public files: bundle scan (without the huge exercise-img table) + variant sources scan (all kinds)
{ grep -rhoE "/(anatomy|equipment|brand|atlas|favicon|icons|physique|muscle)[A-Za-z0-9_./%() -]*\.(webp|png|jpg|jpeg|svg|gif)" "$D" 2>/dev/null || true
  grep -rhoE "/(exercise-img|anatomy|equipment|brand|atlas|physique|muscle|gym)[A-Za-z0-9_./%() -]*\.(webp|png|jpg|jpeg|svg|gif)" design-lab/variants design-lab/labkit design-lab/fixtures.ts 2>/dev/null || true; } | sort -u | while read -r f; do
  [ -f "public$f" ] && mkdir -p "$D$(dirname "$f")" && cp "public$f" "$D$f"
done
mkdir -p "$D/icons" && cp public/icons/spotter-*sidebar* "$D/icons/" 2>/dev/null; cp -r public/icons/. "$D/icons/" 2>/dev/null; true
tar -czf design-lab/out/$OUT.tgz -C design-lab/out $OUT
ls -la design-lab/out/$OUT.tgz
