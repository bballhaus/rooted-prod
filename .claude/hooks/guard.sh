#!/bin/sh
# PreToolUse hook (see .claude/settings.json). Blocks the git and file actions
# AGENTS.md forbids, so the rule holds even when the agent forgets it:
# pushes to main, force-pushes, --no-verify, hosted Supabase changes, .env edits.
# Exit 2 blocks the tool call and shows the message to the agent.

command -v jq >/dev/null 2>&1 || exit 0
input=$(cat)
tool=$(printf '%s' "$input" | jq -r '.tool_name // empty')

block() {
  echo "Blocked by .claude/hooks/guard.sh: $1" >&2
  exit 2
}

case "$tool" in
  Bash)
    cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
    case "$cmd" in
      *"git push"*)
        printf '%s' "$cmd" | grep -Eq -- '(^|[[:space:]])(-f|--force|--force-with-lease)([[:space:]=]|$)' &&
          block "no force-pushes. Push a new commit instead."
        printf '%s' "$cmd" | grep -Eq -- '[[:space:]:](main|master)([[:space:]]|$)' &&
          block "don't push to main. Push your branch and open a PR."
        ;;
    esac
    printf '%s' "$cmd" | grep -Eq -- 'supabase[[:space:]]+(db[[:space:]]+push|migration[[:space:]]+repair)|supabase[[:space:]]+db[[:space:]]+reset[^;&|]*--linked' &&
      block "don't change the hosted Supabase project. A person applies migrations after merge."
    printf '%s' "$cmd" | grep -Eq -- '--no-verify' &&
      block "don't skip git hooks with --no-verify. Fix what the hook reports."
    ;;
  Edit|Write|MultiEdit)
    path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
    case "$(basename "$path")" in
      .env.example) ;;
      .env|.env.*) block "don't edit .env files. Ask a teammate to set the value." ;;
    esac
    ;;
esac
exit 0
