#!/usr/bin/env bash
# Sobe o ambiente local. Uso: dev/local-supabase/start.sh [--reset]
set -e
cd "$(dirname "$0")/../.."
export LOCAL_PG_DIR="${LOCAL_PG_DIR:-/var/tmp/seven/pgdata}"
mkdir -p "$(dirname "$LOCAL_PG_DIR")" dev/.local
id postgres >/dev/null 2>&1 && chown postgres "$(dirname "$LOCAL_PG_DIR")" 2>/dev/null || true
if [ -f dev/.local/server.pid ]; then kill "$(cat dev/.local/server.pid)" 2>/dev/null || true; sleep 3; fi
if [ "$1" = "--reset" ]; then rm -rf "$LOCAL_PG_DIR" dev/.local/storage; fi
LOCAL_KEYS_FILE=dev/.local/keys.env nohup node dev/local-supabase/server.mjs > dev/.local/server.log 2>&1 &
echo $! > dev/.local/server.pid
for i in $(seq 1 60); do grep -q "Supabase local pronto" dev/.local/server.log && break; grep -q "Error" dev/.local/server.log && break; sleep 1; done
tail -6 dev/.local/server.log
