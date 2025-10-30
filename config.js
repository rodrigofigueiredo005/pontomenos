// =================== Configuração do App ===================
// 
// Se estiver rodando em um subpath (ex: https://dominio.com/ponto/),
// defina BASE_PATH como '/ponto'
// 
// Se estiver rodando na raiz (ex: https://dominio.com/),
// deixe BASE_PATH como ''
//

// Detecta automaticamente se está rodando em subpath
const BASE_PATH = (() => {
  const path = window.location.pathname;
  // Se o path começa com /ponto, /app, etc, usa isso como base
  const match = path.match(/^\/[^\/]+/);
  return match ? match[0] : '';
})();

// URL do proxy
export const PROXY_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:8787/api/time_cards/register'
  : `${window.location.protocol}//${window.location.host}/pontomenos-api/api/time_cards/register`;

export const USE_PROXY = true; // Sempre true em produção

console.log('Config:', { BASE_PATH, PROXY_URL, USE_PROXY });

export default BASE_PATH;

