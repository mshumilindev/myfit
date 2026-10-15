#!/usr/bin/env bash
# PreToolUse(Bash): блокує небезпечні команди детерміновано (CLAUDE.md і rules — лише контекст).
# Вхід — JSON у stdin. exit 2 + повідомлення в stderr = блок, Claude бачить причину.
cmd=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).tool_input.command||"")}catch{console.log("")}})')
block() { echo "Заблоковано hook'ом guard-bash: $1" >&2; exit 2; }
case "$cmd" in
  *--no-verify*) block "--no-verify обходить гейт (дозволяє лише людина явно)." ;;
  *"git push"*" --force"*|*"git push"*" -f"*) block "force-push заборонений." ;;
  *"pkill -f"*|*"killall "*) block "pkill -f/killall вбиває власну оболонку; зупиняй за PID." ;;
  *"git reset --hard"*|*"git clean -f"*|*"git checkout -- ."*|*"git restore ."*) block "знищує незакомічену роботу (у т.ч. з іншого чату); застосуй точкову команду." ;;
  *"rm -rf /"*|*"rm -rf ~"*) block "небезпечне видалення." ;;
esac
# секрети: не читати .env* (крім .env.example) і ключі сервіс-акаунтів через shell
if printf '%s' "$cmd" | grep -Eq '(serviceAccountKey|\.pem\b|functions/\.env|(^|[ /])\.env(\.[A-Za-z0-9_-]+)?($| ))' && ! printf '%s' "$cmd" | grep -Eq '\.env\.example'; then
  block "читання секретів (.env*, serviceAccountKey, *.pem) через shell заборонене."
fi
exit 0
