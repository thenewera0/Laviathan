#!/usr/bin/env bash
# Leviathan — connect this computer (macOS / Linux).
# Nothing technical required: run it once and leave it.
set -u

INSTALL_DIR="$HOME/.leviathan"
COMPANION="$INSTALL_DIR/leviathan_companion.py"
RAW_URL="https://raw.githubusercontent.com/thenewera0/Laviathan/main/companion/leviathan_companion.py"

echo
echo "=============================================================="
echo "  LEVIATHAN  -  connecting this computer"
echo "=============================================================="
echo

mkdir -p "$INSTALL_DIR"

# ------------------------------------------------------------------ Python
echo "[1/4] Checking for Python..."
PY=""
command -v python3 >/dev/null 2>&1 && PY=python3
[ -z "$PY" ] && command -v python >/dev/null 2>&1 && PY=python
if [ -z "$PY" ]; then
  echo "      Python not found. Install it, then run this again:"
  echo "        macOS:  brew install python"
  echo "        Ubuntu: sudo apt install python3 python3-pip"
  exit 1
fi
echo "      Python is ready."

# --------------------------------------------------------------- companion
echo "[2/4] Getting the latest Leviathan companion..."
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SELF_DIR/leviathan_companion.py" ]; then
  cp -f "$SELF_DIR/leviathan_companion.py" "$COMPANION"
elif command -v curl >/dev/null 2>&1; then
  curl -fsSL "$RAW_URL" -o "$COMPANION"
else
  wget -qO "$COMPANION" "$RAW_URL"
fi
[ -f "$COMPANION" ] || { echo "      Download failed. Check your internet."; exit 1; }
echo "      Companion ready."

# ------------------------------------------------------------ dependencies
echo "[3/4] Installing what it needs..."
"$PY" -m pip install --quiet --disable-pip-version-check --user \
      websockets psutil >/dev/null 2>&1 || \
  "$PY" -m pip install --quiet --break-system-packages --user \
      websockets psutil >/dev/null 2>&1
echo "      Done."

# --------------------------------------------------------------- autostart
echo "[4/4] Making it start automatically..."
if [ "$(uname)" = "Darwin" ]; then
  PLIST="$HOME/Library/LaunchAgents/ai.leviathan.companion.plist"
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>ai.leviathan.companion</string>
  <key>ProgramArguments</key>
  <array><string>$(command -v "$PY")</string><string>$COMPANION</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>
PLIST_EOF
  launchctl unload "$PLIST" 2>/dev/null || true
  launchctl load "$PLIST" 2>/dev/null || true
else
  UNIT_DIR="$HOME/.config/systemd/user"
  mkdir -p "$UNIT_DIR"
  cat > "$UNIT_DIR/leviathan-companion.service" <<UNIT_EOF
[Unit]
Description=Leviathan Companion
After=network-online.target

[Service]
ExecStart=$(command -v "$PY") $COMPANION
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
UNIT_EOF
  systemctl --user daemon-reload 2>/dev/null || true
  systemctl --user enable leviathan-companion.service 2>/dev/null || true
fi
echo "      It will now start by itself whenever you log in."

echo
echo "=============================================================="
echo "  SETUP COMPLETE"
echo "=============================================================="
echo
echo "  A 6-digit PAIRING CODE will appear below in a moment."
echo
echo '  Say to Leviathan:  "pair with my computer, the code is ______"'
echo
echo "  You only ever do this ONCE. After that this computer is"
echo "  remembered and reconnects on its own."
echo
echo "=============================================================="
echo

exec "$PY" "$COMPANION"
