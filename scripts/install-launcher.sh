#!/usr/bin/env bash
set -euo pipefail
umask 077

script_dir=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
config_dir=${XDG_CONFIG_HOME:-"$HOME/.config"}
state_dir=${XDG_STATE_HOME:-"$HOME/.local/state"}
command -v mise >/dev/null || { printf 'error: mise is required\n' >&2; exit 1; }
mkdir -p "$HOME/.local/bin" "$config_dir/bash" "$state_dir/pi-dotfiles/backups"
backup_dir=$(mktemp -d "$state_dir/pi-dotfiles/backups/pi-launcher-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
for file in "$HOME/.local/bin/pi" "$config_dir/bash/pi.bash" "$HOME/.bashrc"; do
  if [[ -f "$file" ]]; then
    cp -p -- "$file" "$backup_dir/$(basename -- "$file")"
  fi
done

install -m 755 "$repo_root/bin/pi" "$HOME/.local/bin/pi"
install -m 600 "$repo_root/shell/pi.bash" "$config_dir/bash/pi.bash"
source_line='[[ -r "${XDG_CONFIG_HOME:-$HOME/.config}/bash/pi.bash" ]] && source "${XDG_CONFIG_HOME:-$HOME/.config}/bash/pi.bash"'
if ! grep -Fqx "$source_line" "$HOME/.bashrc"; then
  printf '\n# Pi launcher: route standalone updates through mise.\n%s\n' "$source_line" >> "$HOME/.bashrc"
fi
printf 'Installed Pi launcher. Backup: %s\n' "$backup_dir"
printf 'Open a new terminal, or run: source "%s/bash/pi.bash"\n' "$config_dir"
