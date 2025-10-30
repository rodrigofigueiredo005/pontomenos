// =================== API & Data Management ===================

export const API_BASE = 'https://api.pontomais.com.br';

// Dados de autenticação (exportados para uso em outros módulos)
export let authData = { token: '', client: '', uid: '', signInCount: 0, lastSignInIp: '', lastSignInAt: 0 };

// Dados da sessão (exportados para uso no módulo de ponto)
export let sessionData = null;

// =================== Storage ===================

const CFG_KEY = 'ponto_cfg_v2';

export function saveCfg(){
  localStorage.setItem(CFG_KEY, JSON.stringify(authData));
}

export function loadCfg(){
  try {
    const j = JSON.parse(localStorage.getItem(CFG_KEY) || '{}');
    authData = {
      token: j.token || '',
      client: j.client || '',
      uid: j.uid || '',
      signInCount: j.signInCount || 0,
      lastSignInIp: j.lastSignInIp || '',
      lastSignInAt: j.lastSignInAt || 0
    };
  } catch {}
}

export function isLoggedIn(){
  return !!(authData.token && authData.client && authData.uid);
}

// =================== HTTP Utils ===================

function authHeaders(){
  const h = { 'Content-Type': 'application/json' };
  if(authData.token && authData.client && authData.uid) {
    h['access-token'] = authData.token;
    h['client'] = authData.client;
    h['uid'] = authData.uid;
  }
  return h;
}

function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

export async function apiFetch(path, opts={}, retryCount=0){
  const maxRetries = 5;
  const url = API_BASE + path;
  const headers = { ...authHeaders(), ...(opts.headers||{}) };
  
  try {
    const res = await fetch(url, { ...opts, headers, credentials:'omit' });
    if(!res.ok){
      const txt = await res.text().catch(()=> '');
      
      // Se for 404 ou 5xx e ainda temos tentativas, retry
      if((res.status === 404 || res.status >= 500) && retryCount < maxRetries){
        console.log(`Retry ${retryCount + 1}/${maxRetries} para ${path} (status ${res.status})`);
        await sleep(300 * (retryCount + 1)); // delay progressivo: 300ms, 600ms, 900ms...
        return apiFetch(path, opts, retryCount + 1);
      }
      
      throw new Error(`HTTP ${res.status} – ${txt.slice(0,200)}`);
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  } catch(error) {
    // Se for erro de rede e ainda temos tentativas, retry
    if(retryCount < maxRetries && error.name === 'TypeError'){
      console.log(`Retry ${retryCount + 1}/${maxRetries} para ${path} (erro de rede)`);
      await sleep(300 * (retryCount + 1));
      return apiFetch(path, opts, retryCount + 1);
    }
    throw error;
  }
}

// =================== API Calls ===================

export async function fetchSession(){
  const data = await apiFetch('/api/session', { method:'GET' });
  // Tenta achar caminho dos campos sem depender 100% da estrutura:
  const sess = data.session || data;
  const emp = (sess && (sess.employee || sess.current_employee || sess.user?.employee)) || {};
  const workStatusTC = emp.work_status_time_card || {};
  const lastDate = workStatusTC.date; // "27/10/2025"
  const lastTime = workStatusTC.time; // "07:54"
  const timeBalanceSec = emp.time_balance ?? emp.bank_balance ?? null; // -23520 por exemplo
  const employeeId = emp.id || emp.employee_id || null;

  // Salva dados completos da sessão para bater ponto
  sessionData = { fullData: data, employee: emp };

  return {
    lastPunchDate: lastDate,
    lastPunchTime: lastTime,
    timeBalanceSec,
    employeeId,
    locationReferences: emp.location_references || [],
    isCLT: emp.is_clt ?? true // Assume CLT se não informado
  };
}

export async function fetchWorkDay(dateISO, employeeId){
  // dateISO: "YYYY-MM-DD"
  const qs = new URLSearchParams({ start_date: dateISO, end_date: dateISO, attributes: 'time_cards' });
  if(employeeId) qs.append('employee_id', String(employeeId));
  const data = await apiFetch('/api/time_cards/work_days?'+qs.toString(), { method:'GET' });
  const wd = data.work_days?.[0] || {};
  const cards = Array.isArray(wd.time_cards) ? wd.time_cards : [];
  // Esperado: cada card tem .date "dd/mm/yyyy" e .time "HH:mm"
  // Ordena por (date,time) para garantir:
  cards.sort((a,b)=>{
    const da = parseDateTimeDMY(a.date, a.time).getTime();
    const db = parseDateTimeDMY(b.date, b.time).getTime();
    return da - db;
  });
  return cards;
}

// =================== Login/Logout ===================

export async function doLogin(email, password, onStatus){
  try{
    onStatus('Fazendo login...');
    const body = { login: email.trim(), password: password };
    const data = await apiFetch('/api/auth/sign_in', { method:'POST', body: JSON.stringify(body) });
    
    const token = data.token;
    const client = data.client_id;
    const uid = data.data?.login || email.trim();
    if(!token || !client || !uid) throw new Error('Resposta de login sem token/client/uid esperados.');
    
    authData = { 
      token, 
      client, 
      uid,
      signInCount: data.data?.sign_in_count || 0,
      lastSignInIp: data.data?.last_sign_in_ip || '',
      lastSignInAt: data.data?.last_sign_in_at || Math.floor(Date.now() / 1000)
    };
    
    saveCfg();
    onStatus('Login OK');
    return true;
  }catch(e){ 
    console.error('Erro no login:', e.message);
    onStatus('Falha no login: '+e.message);
    throw e;
  }
}

export function doLogout(){
  authData = { token: '', client: '', uid: '', signInCount: 0, lastSignInIp: '', lastSignInAt: 0 };
  saveCfg();
}

// =================== Date/Time Utils ===================

export function parseDMY(dateStr){ // "27/10/2025" -> Date(2025-10-27T00:00)
  const [d,m,y] = dateStr.split('/').map(Number);
  return new Date(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}T00:00:00`);
}

export function parseDateTimeDMY(dateStr, timeStr){ // "27/10/2025", "07:54"
  const [d,m,y] = dateStr.split('/').map(Number);
  const [hh,mm] = timeStr.split(':').map(Number);
  return new Date(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`);
}

export function msToHHMM(ms){
  const neg = ms < 0 ? '-' : '';
  ms = Math.abs(ms);
  const h = Math.floor(ms/3600000);
  const m = Math.floor((ms%3600000)/60000);
  return `${neg}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

export function fmtTime(d){
  if(!d || isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export function fmtDateTime(d){
  if(!d || isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${fmtTime(d)}`;
}

export function getTodayISO(){
  // Retorna data no formato YYYY-MM-DD usando timezone local do dispositivo
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getNextBankExpiration(){
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  
  // Meses de vencimento: abril (3), agosto (7), dezembro (11)
  let targetMonth, targetYear;
  
  if(month < 3){ // jan-mar: próximo vencimento é abril
    targetMonth = 3;
    targetYear = year;
  } else if(month < 7){ // abr-jul: próximo vencimento é agosto
    targetMonth = 7;
    targetYear = year;
  } else if(month < 11){ // ago-nov: próximo vencimento é dezembro
    targetMonth = 11;
    targetYear = year;
  } else { // dezembro: próximo vencimento é abril do ano seguinte
    targetMonth = 3;
    targetYear = year + 1;
  }
  
  // Último dia do mês
  const lastDay = new Date(targetYear, targetMonth + 1, 0);
  
  // Se é sábado (6) ou domingo (0), volta para sexta
  let day = lastDay.getDate();
  const testDate = new Date(targetYear, targetMonth, day);
  const dayOfWeek = testDate.getDay();
  
  if(dayOfWeek === 0){ // domingo
    day -= 2;
  } else if(dayOfWeek === 6){ // sábado
    day -= 1;
  }
  
  return new Date(targetYear, targetMonth, day);
}

// =================== Calculations ===================

export function calcWorkedMsToday(cards){
  // Pares (1-2), (3-4), (5-6) ... usando "now" para o par de trabalho em aberto
  const now = new Date();
  const times = cards.map(c => parseDateTimeDMY(c.date, c.time));
  let total = 0;
  for(let i=0; i<times.length; i+=2){
    const tIn = times[i];
    if(!tIn || isNaN(tIn)) continue;
    const tOut = (i+1 < times.length) ? times[i+1] : now; // se sem saída, conta até agora
    if(tOut && !isNaN(tOut) && tOut > tIn) total += (tOut - tIn);
  }
  return total;
}

export function calcExpectedEnd(cards, targetHours = 8){
  // Retorna o horário em que o total de horas trabalhadas será igual à meta (8h CLT ou 6h estagiário)
  if(!cards.length) return null;
  
  // Se o último ponto é uma saída (número par de pontos), está em intervalo
  // Não dá para calcular quando vai terminar sem saber quando volta
  if(cards.length % 2 === 0) return null;
  
  // Calcula quanto já trabalhou até agora
  const workedMs = calcWorkedMsToday(cards);
  
  // Meta: 6h ou 8h
  const targetMs = targetHours * 60 * 60 * 1000;
  
  // Se já trabalhou a meta ou mais, retorna horário atual
  if(workedMs >= targetMs) {
    return new Date();
  }
  
  // Calcula quanto tempo falta para completar a meta
  const remainingMs = targetMs - workedMs;
  
  // Horário previsto = agora + tempo faltante
  return new Date(Date.now() + remainingMs);
}

export function calcLimitTime(cards, workedMs, isCLT = true, expectedEnd = null){
  // Para estagiários (não-CLT): horário limite = horário de finalizar dia
  if(!isCLT && expectedEnd) {
    return expectedEnd;
  }

  // Para CLT: Horário limite = menor entre:
  // 1. Último ponto + 6h
  // 2. Horário em que completaria 10h de trabalho
  // 3. 22:00 (início do horário noturno)
  if(!cards.length) return null;

  const now = new Date();
  const times = cards.map(c => parseDateTimeDMY(c.date, c.time));
  const last = times[times.length - 1];
  if(!last || isNaN(last)) return null;

  // Condição 1: Último ponto + 6h
  const sixHoursMs = 6 * 60 * 60 * 1000;
  const limit1 = new Date(last.getTime() + sixHoursMs);

  // Condição 2: Quando completaria 10h de trabalho
  const tenHoursMs = 10 * 60 * 60 * 1000;
  const remainingMs = tenHoursMs - workedMs;
  const limit2 = new Date(now.getTime() + remainingMs);

  // Condição 3: 22:00 (início do horário noturno)
  const limit3 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 22, 0, 0);

  // Retorna o menor (mais cedo)
  const minTimestamp = Math.min(limit1.getTime(), limit2.getTime(), limit3.getTime());
  return new Date(minTimestamp);
}

