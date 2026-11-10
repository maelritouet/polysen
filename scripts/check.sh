#!/usr/bin/env bash
# Runs `pnpm typecheck && pnpm test`. Used by the Claude Code Stop hook
# (.claude/settings.json): a failure blocks Claude from ending its turn.
#
# Works on a normal machine and inside a Flatpak-sandboxed editor (where
# pnpm lives on the host and is reached through flatpak-spawn).
set -uo pipefail

# Stop-hook input arrives on stdin. If Claude is already continuing because
# of this hook, let it stop to avoid an endless loop; the failure was reported.
input="$(cat 2>/dev/null || true)"
if command -v jq >/dev/null 2>&1 && [ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false' 2>/dev/null)" = "true" ]; then
  exit 0
fi

root="$(cd "$(dirname "$0")/.." && pwd)"
cmd="cd '$root' && NO_COLOR=1 pnpm typecheck && NO_COLOR=1 pnpm test"

if command -v pnpm >/dev/null 2>&1; then
  out="$(bash -c "$cmd" 2>&1)"; status=$?
elif command -v flatpak-spawn >/dev/null 2>&1; then
  out="$(flatpak-spawn --host bash -ic "$cmd" 2>&1 | grep -v 'no job control\|cannot set terminal process group')"; status=${PIPESTATUS[0]}
else
  echo "check.sh: pnpm not found" >&2; exit 2
fi

if [ "$status" -ne 0 ]; then
  { echo "Typecheck or tests failed. Fix them before finishing:"; printf '%s\n' "$out" | tail -40; } >&2
  exit 2
fi
exit 0
