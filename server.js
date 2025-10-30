#!/usr/bin/env node

/**
 * Proxy Server para PontoMais
 * 
 * Este proxy permite que o front-end faça requisições para a API do PontoMais
 * sem problemas de CORS/Origin, já que a API só aceita requests de app2.pontomais.com.br
 * 
 * Para rodar: node server.js
 */

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 8787;
// Aceita qualquer origem (necessário quando rodando atrás de Nginx)
const ALLOWED_ORIGIN = '*';

const server = http.createServer((req, res) => {
  // CORS headers
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Só aceita POST em /api/time_cards/register
  if (req.method !== 'POST' || req.url !== '/api/time_cards/register') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // Coleta o body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    // Monta os headers para a API oficial
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

    // Configura a requisição para a API do PontoMais
    const options = {
      hostname: 'api.pontomais.com.br',
      path: '/api/time_cards/register',
      method: 'POST',
      headers: headers
    };

    // Faz a requisição
    const proxyReq = https.request(options, (proxyRes) => {
      let responseBody = '';

      proxyRes.on('data', (chunk) => {
        responseBody += chunk;
      });

      proxyRes.on('end', () => {
        console.log(`[${proxyRes.statusCode}] ${req.method} ${req.url}`);
        // Repassa a resposta para o front
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': proxyRes.headers['content-type'] || 'application/json',
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN
        });
        res.end(responseBody);
      });
    });

    proxyReq.on('error', (error) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy error: ' + error.message }));
    });

    // Envia o body
    proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('🚀 Proxy PontoMais rodando!');
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`   CORS: Aceita requisições de qualquer origem`);
  console.log('');
  console.log('💡 Use em conjunto com Nginx ou acesse diretamente via http://localhost:8000');
  console.log('');
});

