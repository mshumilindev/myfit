#!/usr/bin/env bash
# PreToolUse(Bash): блокує небезпечні команди детерміновано (CLAUDE.md і rules — лише контекст).
# Вхід — JSON у stdin. exit 2 + повідомлення в stderr = блок, Claude бачить причину.
input=$(cat)
cmd=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).tool_input.command||"")}catch{console.log("")}})')
# SPO-639: кожне блокування лишає запис у журналі (лише id правила, без команди); збій запису не змінює рішення
block() { printf '%s' "$input" | JOURNAL_CAT="$2" node "${CLAUDE_PROJECT_DIR:-.}/scripts/journal-hook.mjs" GuardBlock >/dev/null 2>&1 || true; echo "Заблоковано hook'ом guard-bash: $1" >&2; exit 2; }
case "$cmd" in
  *--no-verify*) block "--no-verify обходить гейт (дозволяє лише людина явно)." no-verify ;;
  *"git push"*" --force"*|*"git push"*" -f"*) block "force-push заборонений." force-push ;;
  *"pkill -f"*|*"killall "*) block "pkill -f/killall вбиває власну оболонку; зупиняй за PID." pkill ;;
  *"git reset --hard"*|*"git clean -f"*|*"git checkout -- ."*|*"git restore ."*) block "знищує незакомічену роботу (у т.ч. з іншого чату); застосуй точкову команду." destructive-git ;;
  *"rm -rf /"*|*"rm -rf ~"*) block "небезпечне видалення." rm-root ;;
esac
# секрети: не читати .env* (крім .env.example) і ключі сервіс-акаунтів через shell
if printf '%s' "$cmd" | grep -Eq '(serviceAccountKey|\.pem\b|functions/\.env|(^|[ /])\.env(\.[A-Za-z0-9_-]+)?($| ))' && ! printf '%s' "$cmd" | grep -Eq '\.env\.example'; then
  block "читання секретів (.env*, serviceAccountKey, *.pem) через shell заборонене." secrets
fi
exit 0
