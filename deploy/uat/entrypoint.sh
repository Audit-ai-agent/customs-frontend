#!/bin/sh
set -eu

: "${BACKEND_ORIGIN:?BACKEND_ORIGIN is required for Backend-only /api/v1 proxying}"
: "${OIDC_BACKEND_ORIGIN:?OIDC_BACKEND_ORIGIN is required for same-origin /oidc proxying}"

node - <<'NODE'
for (const name of ["BACKEND_ORIGIN", "OIDC_BACKEND_ORIGIN"]) {
  const value = process.env[name];
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(`${name} must use HTTP(S)`);
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new Error(`${name} must be an origin without credentials, path, query, or fragment`);
  }
}
if (process.version !== "v22.23.1") throw new Error(`Node runtime drift: ${process.version}`);
NODE

if [ "$(npm --version)" != "10.9.8" ]; then
  echo "npm runtime drift: $(npm --version)" >&2
  exit 1
fi

echo "LOCAL USER UAT / DIAGNOSTIC / TEXT ONLY / NOT PRODUCTION" >&2
exec ./node_modules/.bin/vite --host 0.0.0.0 --port 5173 --strictPort
