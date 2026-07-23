#!/bin/sh
set -eu

: "${BACKEND_ORIGIN:?BACKEND_ORIGIN is required for Backend-only /api/v1 proxying}"
: "${OIDC_BACKEND_ORIGIN:?OIDC_BACKEND_ORIGIN is required for same-origin /oidc proxying}"

for name in BACKEND_ORIGIN OIDC_BACKEND_ORIGIN; do
  value="$(printenv "$name")"
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

echo "LOCAL USER UAT / BUILT ASSETS / STRICT CSP / TEXT ONLY / NOT PRODUCTION" >&2
