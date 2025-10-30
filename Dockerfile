# Dockerfile para Ponto Menos
FROM node:20-alpine

# Define diretório de trabalho
WORKDIR /app

# Instala http-server globalmente para servir arquivos estáticos
RUN npm install -g http-server

# Copia todos os arquivos do projeto
COPY . .

# Expõe as portas
# 8000 - Frontend (http-server)
# 8787 - Proxy para API do PontoMais
EXPOSE 8000 8787

# Script de inicialização
CMD ["sh", "-c", "node server.js & http-server -p 8000 -c-1 --cors"]

