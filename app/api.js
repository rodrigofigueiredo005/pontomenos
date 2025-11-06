export const API_BASE = 'https://api.pontomais.com.br';

export let authData = { token: '', client: '', uid: '', signInCount: 0, lastSignInIp: '', lastSignInAt: 0 };
export let sessionData = null;

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
      
      if((res.status === 404 || res.status >= 500) && retryCount < maxRetries){
        console.log(`Retry ${retryCount + 1}/${maxRetries} para ${path} (status ${res.status})`);
        await sleep(300 * (retryCount + 1));
        return apiFetch(path, opts, retryCount + 1);
      }
      
      throw new Error(`HTTP ${res.status} – ${txt.slice(0,200)}`);
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  } catch(error) {
    if(retryCount < maxRetries && error.name === 'TypeError'){
      console.log(`Retry ${retryCount + 1}/${maxRetries} para ${path} (erro de rede)`);
      await sleep(300 * (retryCount + 1));
      return apiFetch(path, opts, retryCount + 1);
    }
    throw error;
  }
}

export async function fetchSession(){
  const data = await apiFetch('/api/session', { method:'GET' });
  const sess = data.session || data;
  const emp = (sess && (sess.employee || sess.current_employee || sess.user?.employee)) || {};
  const workStatusTC = emp.work_status_time_card || {};
  const lastDate = workStatusTC.date;
  const lastTime = workStatusTC.time;
  const timeBalanceSec = emp.time_balance ?? emp.bank_balance ?? null;
  const employeeId = emp.id || emp.employee_id || null;

  sessionData = { fullData: data, employee: emp };

  return {
    lastPunchDate: lastDate,
    lastPunchTime: lastTime,
    timeBalanceSec,
    employeeId,
    locationReferences: emp.location_references || [],
    isCLT: emp.is_clt ?? true
  };
}

export async function fetchWorkDay(dateISO, employeeId){
  const qs = new URLSearchParams({ start_date: dateISO, end_date: dateISO, attributes: 'time_cards' });
  if(employeeId) qs.append('employee_id', String(employeeId));
  const data = await apiFetch('/api/time_cards/work_days?'+qs.toString(), { method:'GET' });
  const wd = data.work_days?.[0] || {};
  const cards = Array.isArray(wd.time_cards) ? wd.time_cards : [];
  cards.sort((a,b)=>{
    const da = parseDateTimeDMY(a.date, a.time).getTime();
    const db = parseDateTimeDMY(b.date, b.time).getTime();
    return da - db;
  });
  return cards;
}

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

export function parseDMY(dateStr){
  const [d,m,y] = dateStr.split('/').map(Number);
  return new Date(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}T00:00:00`);
}

export function parseDateTimeDMY(dateStr, timeStr){
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
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getNextBankExpiration(){
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  let targetMonth, targetYear;
  
  if(month < 3){
    targetMonth = 3;
    targetYear = year;
  } else if(month < 7){
    targetMonth = 7;
    targetYear = year;
  } else if(month < 11){
    targetMonth = 11;
    targetYear = year;
  } else {
    targetMonth = 3;
    targetYear = year + 1;
  }
  
  const lastDay = new Date(targetYear, targetMonth + 1, 0);
  let day = lastDay.getDate();
  const testDate = new Date(targetYear, targetMonth, day);
  const dayOfWeek = testDate.getDay();
  
  if(dayOfWeek === 0){
    day -= 2;
  } else if(dayOfWeek === 6){
    day -= 1;
  }
  
  return new Date(targetYear, targetMonth, day);
}

export function calcWorkedMsToday(cards){
  const now = new Date();
  const times = cards.map(c => parseDateTimeDMY(c.date, c.time));
  let total = 0;
  for(let i=0; i<times.length; i+=2){
    const tIn = times[i];
    if(!tIn || isNaN(tIn)) continue;
    const tOut = (i+1 < times.length) ? times[i+1] : now;
    if(tOut && !isNaN(tOut) && tOut > tIn) total += (tOut - tIn);
  }
  return total;
}

export function calcExpectedEnd(cards, targetHours = 8){
  if(!cards.length) return null;
  if(cards.length % 2 === 0) return null;

  // Verifica se já foi feito o intervalo intrajornada de pelo menos 1 hora (CLT)
  let mandatoryBreakMs = 0;
  let hasValidBreak = false;
  
  if(cards.length >= 2) {
    const times = cards.map(c => parseDateTimeDMY(c.date, c.time));
    // Verifica todas as pausas (pares de saída/entrada)
    for(let i = 1; i < times.length; i += 2) {
      if(i + 1 < times.length) {
        const breakMs = times[i + 1].getTime() - times[i].getTime();
        if(breakMs >= 60 * 60 * 1000) { // 1 hora ou mais
          hasValidBreak = true;
          break;
        }
      }
    }
  }
  
  // Se não tiver intervalo válido de 1h, adiciona ao tempo esperado
  if(!hasValidBreak) {
    mandatoryBreakMs = 60 * 60 * 1000;
  }

  const workedMs = calcWorkedMsToday(cards);
  const targetMs = targetHours * 60 * 60 * 1000;
  
  if(workedMs >= targetMs) {
    return new Date();
  }
  
  const remainingMs = targetMs - workedMs + mandatoryBreakMs;
  return new Date(Date.now() + remainingMs);
}

export function calcLimitTime(cards, workedMs, isCLT = true, expectedEnd = null){
  if(!isCLT && expectedEnd) {
    return expectedEnd;
  }

  if(!cards.length) return null;

  const now = new Date();
  const times = cards.map(c => parseDateTimeDMY(c.date, c.time));
  const last = times[times.length - 1];
  if(!last || isNaN(last)) return null;

  const sixHoursMs = 6 * 60 * 60 * 1000;
  const limit1 = new Date(last.getTime() + sixHoursMs);

  const tenHoursMs = 10 * 60 * 60 * 1000;
  const remainingMs = tenHoursMs - workedMs;
  const limit2 = new Date(now.getTime() + remainingMs);

  const limit3 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 22, 0, 0);

  const minTimestamp = Math.min(limit1.getTime(), limit2.getTime(), limit3.getTime());
  return new Date(minTimestamp);
}

