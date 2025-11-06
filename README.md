# PontoMenos 🕐

Gerenciador de pontos alternativo para PontoMais com interface moderna e recursos extras.

## 📋 Pré-requisitos

- Node.js 20+ (ou Docker)
- Credenciais do PontoMais

## 🏃 Executando Localmente

### Opção 1: Direto com Node.js

```bash
# Instalar dependências
npm install

# Iniciar servidor
./start.sh
# ou
npm start
```

Acesse: `http://localhost:9993`

### Opção 2: Com Docker

```bash
docker compose -f deploy/docker-compose.local.yml up -d --build
```

## 📁 Estrutura do Projeto

```
pontomaiscript/
├── app/                    # Frontend (PWA)
│   ├── index.html         # Página principal
│   ├── app.js             # Lógica da aplicação
│   ├── ponto.js           # Gerenciamento de pontos
│   ├── api.js             # Comunicação com API
│   ├── config.js          # Configurações
│   ├── credentials.js     # Credenciais (não versionado)
│   ├── style.css          # Estilos
│   ├── sw.js              # Service Worker (PWA)
│   ├── manifest.json      # Manifest (PWA)
│   └── icons/             # Ícones do PWA
├── deploy/                 # Configurações de deploy
│   ├── docker-compose.yml # Docker Compose
│   ├── Dockerfile         # Imagem Docker
│   └── README.md          # Guia de deploy
├── server.js               # Servidor Express (frontend + proxy)
├── package.json            # Dependências
└── start.sh                # Script de inicialização

```



## 🔧 Configuração

### Porta

Por padrão usa a porta `9993`. Para alterar:

```bash
# Local
export PORT=8080
npm start

# Docker
# Edite docker-compose.yml, seção environment
```

### Credenciais

As credenciais ficam em `app/credentials.js`.

- Obrigatória: `BEARER_TOKEN` da empresa (usada para autenticar na API)
- Opcionais: campos `HARDCODED_*`. Se preenchidos, o app usa esses valores; se vazios, o app tenta obter automaticamente pela API do PontoMais, a partir do login e senha da tela inicial.

Exemplo de configuração:

```javascript
// app/credentials.js
export const CREDENTIALS = {
  BEARER_TOKEN: "SUA_CHAVE_DA_EMPRESA",
  HARDCODED_TOKEN: "",
  HARDCODED_CLIENT_ID: "",
  HARDCODED_LOGIN: "",
  HARDCODED_UUID: "",
  HARDCODED_SIGN_IN_COUNT: 0,
  HARDCODED_LAST_SIGN_IN_IP: "",
  HARDCODED_LAST_SIGN_IN_AT: 0
};
```

## 🏗️ Arquitetura

O projeto usa um **servidor único** (Express) que:

1. **Serve os arquivos estáticos** do frontend (HTML, CSS, JS)
2. **Faz proxy** para a API do PontoMais (resolve CORS)
3. **Roda na mesma porta** (9993 por padrão)

```
┌─────────────────┐
│   Navegador     │
└────────┬────────┘
         │
         │ http://localhost:9993
         ▼
┌─────────────────┐
│  Express Server │
│  (server.js)    │
├─────────────────┤
│  GET /          │──────> Serve app/index.html
│  GET /health    │──────> Health check
│  POST /api/...  │──────> Proxy para api.pontomais.com.br
└─────────────────┘
```

## 🛠️ Tecnologias

- **Backend**: Node.js + Express
- **Frontend**: JavaScript vanilla (sem framework)
- **PWA**: Service Worker + Manifest
- **Deploy**: Docker + Docker Compose
- **Proxy**: HTTPS para API do PontoMais

## 📝 Comandos Úteis

```bash
# Desenvolvimento
npm start                    # Inicia servidor
npm run dev                  # Inicia com nodemon (auto-reload)
npm test                     # Roda testes automatizados

# Docker
docker-compose up -d         # Inicia em background
docker logs pontomenos -f    # Ver logs
docker restart pontomenos    # Reinicia
docker-compose down          # Para e remove

# Deploy
./start.sh                   # Script completo de inicialização
```

## 🐛 Troubleshooting

### Porta já está em uso
```bash
# Alterar porta
export PORT=9994
npm start
```

### Erro de CORS
O proxy deve resolver. Verifique se está usando a URL correta em `app/config.js`.

### Container não inicia
```bash
docker logs pontomenos
```