#!/usr/bin/env bash
# PostToolUse(Edit|Write): форматує змінений файл Prettier'ом (тихо, не ламає потік).
f=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const i=JSON.parse(s).tool_input;console.log(i.file_path||"")}catch{console.log("")}})')
[ -z "$f" ] && exit 0
case "$f" in
  *.ts|*.tsx|*.js|*.mjs|*.cjs|*.css|*.json|*.md) ;;
  *) exit 0 ;;
esac
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
[ -f node_modules/.bin/prettier ] || exit 0
node_modules/.bin/prettier --log-level=silent --write "$f" >/dev/null 2>&1 || true
exit 0
