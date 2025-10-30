const BASE_PATH = (() => {
  const path = window.location.pathname;
  const match = path.match(/^\/[^\/]+/);
  return match ? match[0] : '';
})();

export const PROXY_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:8787/api/time_cards/register'
  : `${window.location.protocol}//${window.location.host}/pontomenos-api/api/time_cards/register`;

export const USE_PROXY = true;

console.log('Config:', { BASE_PATH, PROXY_URL, USE_PROXY });

export default BASE_PATH;

