#!/usr/bin/env node

const express = require('express');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 9993;

// Middleware para CORS
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, 'app')));

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ response: 'PontoMenos is alive', timestamp: new Date().toISOString() });
});

// Proxy para a API do PontoMais
app.post('/api/time_cards/register', (req, res) => {
  const headers = {
    'client': req.headers['client'] || '',
    'access-token': req.headers['access-token'] || '',
    'token': req.headers['token'] || '',
    'uid': req.headers['uid'] || '',
    'uuid': req.headers['uuid'] || '',
    'content-type': 'application/json',
    'origin': 'https://app2.pontomais.com.br',
    'referer': 'https://app2.pontomais.com.br/'
  };

  const options = {
    hostname: 'api.pontomais.com.br',
    path: '/api/time_cards/register',
    method: 'POST',
    headers: headers
  };

  const proxyReq = https.request(options, (proxyRes) => {
    let responseBody = '';

    proxyRes.on('data', (chunk) => {
      responseBody += chunk;
    });

    proxyRes.on('end', () => {
      console.log(`[${proxyRes.statusCode}] ${req.method} ${req.url}`);
      res.status(proxyRes.statusCode)
        .set('Content-Type', proxyRes.headers['content-type'] || 'application/json')
        .send(responseBody);
    });
  });

  proxyReq.on('error', (error) => {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error: ' + error.message });
  });

  proxyReq.write(JSON.stringify(req.body));
  proxyReq.end();
});

// Fallback para SPA - todas as outras rotas retornam o index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'app', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 PontoMenos rodando em http://localhost:${PORT}`);
  console.log(`📡 API proxy: http://localhost:${PORT}/api/time_cards/register`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});

