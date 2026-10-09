#!/usr/bin/env sh
# Starts MetaKit: ./start.sh, or ./start.sh --preview for the production build.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "MetaKit needs Node.js 22 or newer. Get it from https://nodejs.org and run this again."
  exit 1
fi
exec node scripts/start.js "$@"
