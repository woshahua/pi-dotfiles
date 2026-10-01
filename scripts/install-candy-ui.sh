#!/usr/bin/env bash
set -euo pipefail
script_dir=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
pi_config_dir=${PI_CODING_AGENT_DIR:-"${HOME}/.pi/agent"}
state_root=${XDG_STATE_HOME:-"${HOME}/.local/state"}
mkdir -p -- "$pi_config_dir/extensions" "$state_root/pi-dotfiles/backups"
backup_dir=$(mktemp -d "$state_root/pi-dotfiles/backups/candy-ui-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
target="$pi_config_dir/extensions/candy-ui"
if [[ -e "$target" ]]; then cp -a -- "$target" "$backup_dir/candy-ui"; fi
mkdir -p -- "$target"
for name in index.ts ui.ts state.ts editor.ts motion.ts model-panel.ts panel-motion.ts; do
  install -m 600 -- "$repo_root/pi/extensions/candy-ui/$name" "$target/$name"
done
printf 'Installed Candy UI into %s\nBackup: %s\n' "$target" "$backup_dir"
printf 'Restart Pi. Use /model or Ctrl+L for animated models, and Alt+M or /candy for controls. /candy off restores the previous UI.\n'
