#!/bin/bash

if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado!"
    exit 1
fi

# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

echo "🚀 Iniciando PontoMenos..."
echo "🌐 Acesse: http://localhost:9993"
echo "💚 Health: http://localhost:9993/health"
echo ""

node server.js

