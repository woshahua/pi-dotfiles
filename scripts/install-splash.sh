#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
pi_config_dir=${PI_CODING_AGENT_DIR:-"${HOME}/.pi/agent"}
state_root=${XDG_STATE_HOME:-"${HOME}/.local/state"}
command -v jq >/dev/null || { printf 'error: jq is required\n' >&2; exit 1; }
mkdir -p -- "$pi_config_dir/extensions" "$state_root/pi-dotfiles/backups"
backup_dir=$(mktemp -d "$state_root/pi-dotfiles/backups/splash-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
settings="$pi_config_dir/settings.json"
target="$pi_config_dir/extensions/pi-splash"
temp_file=$(mktemp "$pi_config_dir/.splash-settings.XXXXXX")
trap 'rm -f -- "$temp_file"' EXIT

if [[ -f "$settings" ]]; then
  cp -p -- "$settings" "$backup_dir/settings.json"
else
  printf '{}\n' > "$temp_file"
fi
if [[ -e "$target" ]]; then
  cp -a -- "$target" "$backup_dir/pi-splash"
fi

# Disable only the old header extension. Keep its package and color settings.
if [[ -f "$settings" ]]; then
  jq 'if .packages then .packages |= map(
    if . == "npm:pi-startup-header" then {source: ., extensions: []}
    elif type == "object" and .source == "npm:pi-startup-header" then .extensions = []
    else . end
  ) else . end' "$settings" > "$temp_file"
fi
mkdir -p -- "$target"
install -m 600 -- "$repo_root/pi/extensions/pi-splash/header.ts" "$target/header.ts"
install -m 600 -- "$repo_root/pi/extensions/pi-splash/index.ts" "$target/index.ts"
install -m 600 -- "$repo_root/pi/extensions/pi-splash/sprite.generated.ts" "$target/sprite.generated.ts"
chmod 600 "$temp_file"
mv -- "$temp_file" "$settings"
printf 'Installed Pi splash into %s\nBackup: %s\n' "$target" "$backup_dir"
printf 'Restart Pi to see the animation. Use PI_SPLASH_ANIMATION=0 for a static header.\n'
