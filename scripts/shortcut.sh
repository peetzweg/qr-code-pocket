#!/bin/sh
# Builds the "Add to Kippu" iOS Shortcut for this deployment and signs it (macOS only, needs iCloud).
#   scripts/shortcut.sh https://<host>.ts.net:8445
# Writes public/Add-to-Kippu.shortcut (gitignored); the next build ships it, and Settings links to it.
set -e
origin="${1:?usage: scripts/shortcut.sh https://host[:port]}"
dir="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
python3 "$dir/scripts/shortcut.py" "${origin%/}/api/inbox" "$tmp/unsigned.shortcut"
shortcuts sign --mode anyone --input "$tmp/unsigned.shortcut" --output "$dir/public/Add-to-Kippu.shortcut"
rm -rf "$tmp"
echo "signed: public/Add-to-Kippu.shortcut -> ${origin%/}/api/inbox"
