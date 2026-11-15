#!/usr/bin/env bash
# Start the local Morkahja database, API and client, then open the game.
# Safe to run again: anything already listening is left alone.

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE="${XDG_STATE_HOME:-$HOME/.local/state}/morkahja-local"
URL="http://localhost:5173/"

mkdir -p "$STATE"

listening() {
  ss -ltnH "sport = :$1" 2>/dev/null | grep -q .
}

notify() {
  if command -v notify-send >/dev/null 2>&1; then
    notify-send -a "Morkahja" "Morkahja" "$1" || true
  fi
}

if ! listening 4242; then
  if command -v podman >/dev/null 2>&1 && podman container exists morkahja-db >/dev/null 2>&1; then
    podman start morkahja-db >>"$STATE/database.log" 2>&1 || true
  fi
fi

cd "$ROOT"

if ! listening 3000; then
  nohup npm run dev:backend >>"$STATE/backend.log" 2>&1 &
  echo $! >"$STATE/backend.pid"
fi

if ! listening 5173; then
  nohup npm run dev:client >>"$STATE/client.log" 2>&1 &
  echo $! >"$STATE/client.pid"
fi

ready=0
for _ in $(seq 1 80); do
  if listening 5173 && curl -sf -o /dev/null --max-time 1 "http://127.0.0.1:3000/health"; then
    ready=1
    break
  fi
  sleep 0.5
done

if [[ "$ready" -ne 1 ]]; then
  notify "The local game did not start. See $STATE"
  exit 1
fi

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 &
else
  notify "Open $URL"
fi
