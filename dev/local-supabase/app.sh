#!/usr/bin/env bash
# Reconstrói e sobe o app em modo produção na porta 3000 (para testes locais).
cd "$(dirname "$0")/../.."
if [ -f dev/.local/next.pid ]; then kill "$(cat dev/.local/next.pid)" 2>/dev/null; sleep 1; fi
npx next build > dev/.local/build.log 2>&1 || { tail -30 dev/.local/build.log; exit 1; }
nohup npx next start -p 3000 > dev/.local/next.log 2>&1 &
echo $! > dev/.local/next.pid
sleep 4
curl -s -o /dev/null -w "app: %{http_code}\n" http://localhost:3000/entrar
