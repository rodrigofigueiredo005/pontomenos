#!/bin/bash

if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado!"
    exit 1
fi

if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "❌ Python não encontrado!"
    exit 1
fi

echo "🚀 Iniciando..."
echo "🔧 Proxy: http://localhost:8787"
echo "🌐 Frontend: http://localhost:8000"

node server.js &
PROXY_PID=$!
sleep 1

cleanup() {
    kill $PROXY_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

cd app
if command -v python3 &> /dev/null; then
    python3 -m http.server 8000
else
    python -m SimpleHTTPServer 8000
fi

