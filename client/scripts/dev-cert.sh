#!/bin/sh
# Self-signed certificate for testing the local dev server from a phone.
# Browsers create journey keys only on secure pages, so a phone on the local
# network needs https. Kept in client/.dev-cert/ (gitignored, never commit it).
# Regenerated when this computer's local network address is not in it yet.
set -eu
dir="$(cd "$(dirname "$0")/.." && pwd)/.dev-cert"
mkdir -p "$dir"
ips="$(hostname -I 2>/dev/null || true)"
san="DNS:localhost,IP:127.0.0.1"
for ip in $ips; do
  case "$ip" in *:*) ;; *) san="$san,IP:$ip" ;; esac
done
if [ -f "$dir/cert.pem" ] && [ -f "$dir/san.txt" ] && [ "$(cat "$dir/san.txt")" = "$san" ]; then
  exit 0
fi
openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj "/CN=Morkahja local dev" \
  -addext "subjectAltName=$san" -keyout "$dir/key.pem" -out "$dir/cert.pem" >/dev/null 2>&1
chmod 600 "$dir/key.pem"
printf '%s' "$san" > "$dir/san.txt"
echo "Created a local certificate for: $san"
