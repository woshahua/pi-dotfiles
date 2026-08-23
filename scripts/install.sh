#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
pi_config_dir=${PI_CODING_AGENT_DIR:-"${HOME}/.pi/agent"}
state_root=${XDG_STATE_HOME:-"${HOME}/.local/state"}
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_dir="$state_root/pi-dotfiles/backups/$timestamp"
temp_file=""

cleanup() {
	if [[ -n "$temp_file" && -f "$temp_file" ]]; then
		rm -f -- "$temp_file"
	fi
}
trap cleanup EXIT

if ! command -v jq >/dev/null 2>&1; then
	printf 'error: jq is required\n' >&2
	exit 1
fi

mkdir -p -- "$pi_config_dir/extensions" "$pi_config_dir/themes" "$backup_dir"

backup_file() {
	local target=$1
	if [[ -f "$target" ]]; then
		cp --archive -- "$target" "$backup_dir/$(basename -- "$target")"
	fi
}

install_file() {
	local source=$1
	local target=$2
	backup_file "$target"
	install -m 600 -- "$source" "$target"
}

settings_target="$pi_config_dir/settings.json"
backup_file "$settings_target"
temp_file=$(mktemp "${TMPDIR:-/tmp}/pi-dotfiles-settings.XXXXXX")

if [[ -f "$settings_target" ]]; then
	jq -s '.[0] * .[1]' "$settings_target" "$repo_root/pi/settings.json" > "$temp_file"
else
	jq . "$repo_root/pi/settings.json" > "$temp_file"
fi
install -m 600 -- "$temp_file" "$settings_target"
rm -f -- "$temp_file"
temp_file=""

install_file "$repo_root/pi/pi-startup-header.json" "$pi_config_dir/pi-startup-header.json"
install_file "$repo_root/pi/themes/omarchy-system.json" "$pi_config_dir/themes/omarchy-system.json"
install_file "$repo_root/pi/extensions/omarchy-system-theme.ts" "$pi_config_dir/extensions/omarchy-system-theme.ts"

printf 'Installed the public Pi configuration into %s\n' "$pi_config_dir"
printf 'Backup: %s\n' "$backup_dir"
printf 'Run `pi update` to resolve or update declared packages.\n'
