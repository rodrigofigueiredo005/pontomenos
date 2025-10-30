#!/bin/bash

# Script para iniciar o proxy e o servidor HTTP do front-end

echo ""
echo "🚀 Iniciando Ponto Menos..."
echo ""

# Verifica se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado!"
    echo "   Instale em: https://nodejs.org/"
    exit 1
fi

# Verifica se o Python está instalado
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "❌ Python não encontrado!"
    echo "   Instale Python ou use 'npx http-server -p 8000' manualmente"
    exit 1
fi

echo "✅ Node.js: $(node --version)"
echo "✅ Python: $(python3 --version 2>/dev/null || python --version)"
echo ""

# Inicia o proxy em background
echo "🔧 Iniciando proxy em http://localhost:8787..."
node server.js &
PROXY_PID=$!
echo "   PID do proxy: $PROXY_PID"
sleep 2

# Inicia o servidor HTTP do front
echo ""
echo "🌐 Iniciando front-end em http://localhost:8000..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Acesse: http://localhost:8000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Pressione Ctrl+C para parar os dois servidores"
echo ""

# Função para limpar processos ao sair
cleanup() {
    echo ""
    echo "🛑 Parando servidores..."
    kill $PROXY_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Inicia o servidor HTTP (tenta Python 3, depois Python 2)
if command -v python3 &> /dev/null; then
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer 8000
fi

