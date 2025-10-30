#!/usr/bin/env node

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 8787;
const ALLOWED_ORIGIN = '*';

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/api/time_cards/register') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
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

    proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(PORT, () => {
  console.log('🚀 Proxy: http://localhost:' + PORT);
  console.log('🌐 Frontend: http://localhost:8000');
});

