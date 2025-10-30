// =================== Main App ===================

import { 
  loadCfg, 
  isLoggedIn, 
  doLogin, 
  doLogout,
  fetchSession,
  fetchWorkDay,
  getTodayISO,
  getNextBankExpiration,
  calcWorkedMsToday,
  calcExpectedEnd,
  calcLimitTime,
  msToHHMM,
  fmtTime,
} from './api.js';

import { 
  baterPonto, 
  closePunchModal, 
  confirmPunch, 
  cleanAddress,
  setLastPunchLocation 
} from './ponto.js';

// =================== DOM Utils ===================

const $$ = sel => document.querySelector(sel);

const els = {
  loginScreen: $$('#loginScreen'), 
  mainPanel: $$('#mainPanel'),
  email: $$('#email'), 
  password: $$('#password'),
  loginBtn: $$('#loginBtn'), 
  logoutBtn: $$('#logoutBtn'),
  refreshBtn: $$('#refreshBtn'), 
  punchBtn: $$('#punchBtn'),
  ultimoPontoData: $$('#ultimoPontoData'), 
  ultimoPontoHora: $$('#ultimoPontoHora'),
  horasHoje: $$('#horasHoje'),
  bancoHoras: $$('#bancoHoras'), 
  bancoVencimento: $$('#bancoVencimento'),
  finalizarAs: $$('#finalizarAs'), 
  horarioLimite: $$('#horarioLimite'),
  loginStatus: $$('#loginStatus'), 
  punchList: $$('#punchList'), 
  toast: $$('#toast'),
  punchModal: $$('#punchModal'), 
  locationOptions: $$('#locationOptions'), 
  cancelPunchBtn: $$('#cancelPunchBtn'), 
  confirmPunchBtn: $$('#confirmPunchBtn'),
  tooltipBanco: $$('#tooltipBanco'), 
  tooltipBancoText: $$('#tooltipBancoText'),
  tooltipFinalizar: $$('#tooltipFinalizar'), 
  tooltipFinalizarText: $$('#tooltipFinalizarText'),
  tooltipLimite: $$('#tooltipLimite'), 
  tooltipLimiteText: $$('#tooltipLimiteText')
};

// =================== UI Helpers ===================

function toast(msg){ 
  els.toast.textContent = msg; 
  els.toast.classList.add('show'); 
  setTimeout(()=>els.toast.classList.remove('show'), 1800); 
}

function loginStatus(msg){ 
  els.loginStatus.textContent = msg; 
}

function showScreen(){
  if(isLoggedIn()){
    els.loginScreen.style.display = 'none';
    els.mainPanel.style.display = 'block';
  } else {
    els.loginScreen.style.display = 'block';
    els.mainPanel.style.display = 'none';
  }
}

function setupTooltips(isCLT){
  // Configura tooltips baseado no tipo de funcionário
  if(isCLT){
    // CLT: esconde tooltip de banco de horas
    els.tooltipBanco.style.display = 'none';
    
    // Finalizar dia às
    els.tooltipFinalizarText.textContent = 'Horário em que sua jornada completa 8 horas';
    
    // Horário limite
    els.tooltipLimiteText.textContent = 'A partir desse horário, será contada hora extra. Faça isso apenas se tiver autorização da liderança';
  } else {
    // Estagiário: mostra tooltip de banco de horas
    els.tooltipBanco.style.display = 'inline-block';
    els.tooltipBancoText.textContent = 'Não se aplica a estagiários';
    
    // Finalizar dia às
    els.tooltipFinalizarText.textContent = 'Horário em que sua jornada completa 6 horas';
    
    // Horário limite
    els.tooltipLimiteText.textContent = 'A partir desse horário, será contada hora extra';
  }
}

// =================== Render ===================

function renderPunchList(cards){
  if(!cards || cards.length === 0){
    els.punchList.innerHTML = '<p class="hint" style="margin:8px 0;">Nenhum ponto batido hoje</p>';
    return;
  }
  
  const items = cards.map((card, idx) => {
    const types = ['Entrada', 'Saída', 'Entrada', 'Saída', 'Entrada', 'Saída'];
    const type = types[idx] || (idx % 2 === 0 ? 'Entrada' : 'Saída');
    const method = card.software_method?.name || card.source?.name || '';
    const location = cleanAddress(card.address || '');
    
    let shortMethod = method.replace('Registro de ponto pelo ', '').replace('aplicativo ', '').replace('Inserção por ', '');
    if(shortMethod.includes('Comunicação')){
      shortMethod = "Ponto Físico";
    }
    
    return `
      <div class="punch-item">
        <div class="top">
          <div class="time">${card.time}</div>
          <div class="type">${type}</div>
          <div class="badge">${shortMethod}</div>
        </div>
        ${location ? `<div class="location">📍 ${location}</div>` : ''}
      </div>
    `;
  }).join('');
  
  els.punchList.innerHTML = items;
}

// =================== Refresh ===================

async function refreshAll(){
  try{
    toast('Atualizando...');
    const todayISO = getTodayISO(); // YYYY-MM-DD na timezone local

    const sess = await fetchSession();
    
    // Configura tooltips baseado no tipo de funcionário
    setupTooltips(sess.isCLT);
    
    // Banco de horas
    if(typeof sess.timeBalanceSec === 'number'){
      els.bancoHoras.textContent = msToHHMM(sess.timeBalanceSec * 1000);
    } else {
      els.bancoHoras.textContent = '—';
    }
    
    // Data de vencimento do banco
    const expirationDate = getNextBankExpiration();
    els.bancoVencimento.textContent = `Vence em ${String(expirationDate.getDate()).padStart(2,'0')}/${String(expirationDate.getMonth()+1).padStart(2,'0')}/${expirationDate.getFullYear()}`;
    
    // Último ponto (se vier no /session)
    if(sess.lastPunchDate && sess.lastPunchTime){
      els.ultimoPontoData.textContent = sess.lastPunchDate;
      els.ultimoPontoHora.textContent = sess.lastPunchTime;
    } else {
      els.ultimoPontoData.textContent = '—';
      els.ultimoPontoHora.textContent = '';
    }

    // Batidas do dia (para Horas Hoje e Finalizar às)
    const cards = await fetchWorkDay(todayISO, sess.employeeId || undefined);
    const workedMs = calcWorkedMsToday(cards);
    els.horasHoje.textContent = msToHHMM(workedMs);

    // Último ponto (mais preciso pelos cards, se existir)
    if(cards.length > 0){
      const last = cards[cards.length - 1];
      els.ultimoPontoData.textContent = last.date;
      els.ultimoPontoHora.textContent = last.time;
      
      // Salva localização do último ponto para usar no modal
      if(last.latitude && last.longitude){
        setLastPunchLocation({
          latitude: last.latitude,
          longitude: last.longitude,
          address: last.address || '',
          original_latitude: last.original_latitude || last.latitude,
          original_longitude: last.original_longitude || last.longitude,
          original_address: last.original_address || last.address || '',
          location_edited: last.location_edited || false,
          accuracy: last.accuracy || 0,
          accuracy_method: last.accuracy_method || null,
          reference_id: null
        });
      }
    }

    // Define meta de horas: 6h para estagiário, 8h para CLT
    const targetHours = sess.isCLT ? 8 : 6;
    const endAt = calcExpectedEnd(cards, targetHours);
    els.finalizarAs.textContent = endAt ? fmtTime(endAt) : '—';

    // Horário limite: igual ao finalizar dia para estagiário, regras complexas para CLT
    const limitTime = calcLimitTime(cards, workedMs, sess.isCLT, endAt);
    els.horarioLimite.textContent = limitTime ? fmtTime(limitTime) : '—';

    // Renderizar lista de pontos
    renderPunchList(cards);

    toast('Atualizado!');
  }catch(e){
    toast('Erro ao atualizar');
  }
}

// =================== Event Handlers ===================

async function handleLogin(){
  try {
    await doLogin(els.email.value, els.password.value, loginStatus);
    toast('Login OK');
    showScreen();
    await refreshAll();
  } catch(e) {
    toast('Falha no login');
  }
}

function handleLogout(){
  doLogout();
  toast('Logout efetuado');
  showScreen();
}

async function handlePunch(){
  await baterPonto(els, toast);
}

function handleCancelPunch(){
  closePunchModal(els);
}

async function handleConfirmPunch(){
  await confirmPunch(els, toast, refreshAll);
}

// =================== Event Listeners ===================

els.loginBtn.addEventListener('click', handleLogin);
els.logoutBtn.addEventListener('click', handleLogout);
els.refreshBtn.addEventListener('click', refreshAll);
els.punchBtn.addEventListener('click', handlePunch);
els.cancelPunchBtn.addEventListener('click', handleCancelPunch);
els.confirmPunchBtn.addEventListener('click', handleConfirmPunch);

// Permite fazer login pressionando Enter nos campos de email e senha
els.email.addEventListener('keypress', (e) => {
  if(e.key === 'Enter') handleLogin();
});
els.password.addEventListener('keypress', (e) => {
  if(e.key === 'Enter') handleLogin();
});

// Tooltips: clique para mobile (toggle)
[els.tooltipBanco, els.tooltipFinalizar, els.tooltipLimite].forEach(tooltip => {
  if(tooltip){
    tooltip.addEventListener('click', (e) => {
      e.stopPropagation();
      // Remove active de todos
      [els.tooltipBanco, els.tooltipFinalizar, els.tooltipLimite].forEach(t => {
        if(t && t !== tooltip) t.classList.remove('active');
      });
      // Toggle no clicado
      tooltip.classList.toggle('active');
    });
  }
});

// Fecha tooltips ao clicar fora
document.addEventListener('click', () => {
  [els.tooltipBanco, els.tooltipFinalizar, els.tooltipLimite].forEach(t => {
    if(t) t.classList.remove('active');
  });
});

// Fecha modal ao clicar fora
els.punchModal.addEventListener('click', (e) => {
  if(e.target === els.punchModal) handleCancelPunch();
});

// =================== Initialization ===================

loadCfg();
showScreen();
if(isLoggedIn()){ refreshAll(); }

// Registrar Service Worker para PWA
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js')
    .then(reg => console.log('Service Worker registrado', reg))
    .catch(err => console.log('Erro ao registrar Service Worker', err));
}

