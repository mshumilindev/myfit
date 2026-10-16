#!/usr/bin/env bash
# Stop: якщо чіпали client/src чи tests, не дає закінчити, поки швидкі guard-тести не зелені
# (kit-guard, hygiene-ratchet, i18n-length). Один раз: повторний Stop (stop_hook_active) пропускаємо, щоб не зациклитись.
input=$(cat)
active=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).stop_hook_active?"1":"0")}catch{console.log("0")}})')
[ "$active" = "1" ] && exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
[ -f node_modules/.bin/vitest ] || exit 0
git status --porcelain 2>/dev/null | grep -qE '^( M|M |A |\?\?|AM) +(client/src/|tests/)' || exit 0
out=$(node_modules/.bin/vitest run tests/kit-guard.test.ts tests/hygiene-ratchet.guard.test.ts tests/i18n-length.test.ts 2>&1)
if [ $? -ne 0 ]; then
  echo "Guard-тести червоні — виправ перед завершенням (не послаблюй тести і baseline):" >&2
  printf '%s\n' "$out" | tail -40 >&2
  exit 2
fi
exit 0
