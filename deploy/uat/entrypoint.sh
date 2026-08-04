#!/bin/sh
set -eu

: "${BACKEND_ORIGIN:?BACKEND_ORIGIN is required for Backend-only /api/v1 proxying}"

for name in BACKEND_ORIGIN; do
  case "$name" in
    BACKEND_ORIGIN) value="$BACKEND_ORIGIN" ;;
    *) echo "unexpected origin variable" >&2; exit 1 ;;
  esac
  if [ "$(printf '%s' "$value" | wc -l | tr -d ' ')" -ne 0 ]; then
    echo "$name must not contain line breaks" >&2
    exit 1
  fi
  if ! printf '%s' "$value" | grep -Eq '^https?://[A-Za-z0-9._-]+(:[0-9]{1,5})?$'; then
    echo "$name must be an HTTP(S) origin without credentials, path, query, or fragment" >&2
    exit 1
  fi
  authority="${value#*://}"
  case "$authority" in
    *:*)
      port="${authority##*:}"
      if [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
        echo "$name port must be between 1 and 65535" >&2
        exit 1
      fi
      ;;
  esac
done

echo "FUNCTIONAL UAT / BUILT ASSETS / STRICT CSP / TEXT ONLY / NO DEPLOYMENT" >&2
