import { authData, sessionData, API_BASE } from './api.js';

let selectedLocation = null;
let currentGPSLocation = null;
export let lastPunchLocation = null;
let deviceUUID = localStorage.getItem('device_uuid') || generateUUID();

const PENDING_PUNCHES_KEY = 'pending_punches_v1';

function generateUUID(){
  let it = (new Date).getTime();
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(Ft){
    let cn = (it + 16 * Math.random()) % 16 | 0;
    it = Math.floor(it / 16);
    if (Ft !== "x") cn = (cn & 0x3) | 0x8;
    return cn.toString(16);
  });
  localStorage.setItem('device_uuid', uuid);
  return uuid;
}

function getCurrentPosition(){
  return new Promise((resolve, reject) => {
    if(!navigator.geolocation){
      reject(new Error('Geolocalização não suportada'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  });
}

async function reverseGeocode(lat, lng){
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pt-BR`;
    const res = await fetch(url, { headers: { 'User-Agent': 'PontoRapido/1.0' } });
    if(!res.ok) throw new Error('Erro na geocodificação');
    const data = await res.json();
    const addr = data.address || {};
    const parts = [];
    
    if(addr.road){
      if(addr.house_number){
        parts.push(`${addr.road}, ${addr.house_number}`);
      } else {
        parts.push(addr.road);
      }
    }
    
    if(addr.suburb || addr.neighbourhood){
      parts.push(addr.suburb || addr.neighbourhood);
    }
    
    if(addr.city || addr.town){
      parts.push(addr.city || addr.town);
    }
    
    return parts.join(' - ') || data.display_name || `${lat}, ${lng}`;
  } catch {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}

export function cleanAddress(address){
  if(!address) return '';
  let cleaned = address
    .replace(/,?\s*\d{5}-\d{3}\s*,?/g, '')
    .replace(/\s*-\s*[A-Z]{2}\s*,?/g, '')
    .replace(/,?\s*Brazil\s*$/i, '')
    .replace(/,\s*,/g, ',')
    .trim();
  return cleaned;
}

export async function openPunchModal(els, onToast){
  try {
    if(!sessionData || !sessionData.employee) {
      onToast('Erro: Dados da sessão não carregados');
      return;
    }

    els.punchModal.classList.add('show');
    els.confirmPunchBtn.disabled = false;

    const options = [];

    // Adiciona placeholder para localização GPS (será atualizado depois)
    options.push({
      type: 'gps',
      icon: '📍',
      name: 'Localização atual (GPS)',
      address: 'Carregando localização...',
      data: null,
      isPlaceholder: true
    });

    if(lastPunchLocation && lastPunchLocation.address){
      options.push({
        type: 'last',
        icon: '🕐',
        name: 'Último ponto registrado',
        address: cleanAddress(lastPunchLocation.address) || lastPunchLocation.address,
        data: lastPunchLocation
      });
    }

    const refs = sessionData.employee.location_references || [];
    refs.forEach(ref => {
      options.push({
        type: 'favorite',
        icon: '⭐',
        name: ref.description || 'Local favorito',
        address: cleanAddress(ref.address) || ref.address,
        data: {
          latitude: ref.latitude,
          longitude: ref.longitude,
          address: ref.address,
          original_latitude: ref.latitude,
          original_longitude: ref.longitude,
          original_address: ref.address,
          location_edited: false,
          accuracy: 0,
          accuracy_method: null,
          reference_id: ref.id
        }
      });
    });

    // Define seleção padrão (primeira opção não-placeholder ou null)
    selectedLocation = options.find(opt => !opt.isPlaceholder)?.data || null;

    // Função para renderizar as opções
    const renderOptions = () => {
      els.locationOptions.innerHTML = options.map((opt, idx) => {
        const isSelected = selectedLocation === opt.data && !opt.isPlaceholder;
        const isDisabled = opt.isPlaceholder ? 'disabled' : '';
        const opacity = opt.isPlaceholder ? 'style="opacity: 0.6; cursor: not-allowed;"' : '';
        
        return `
          <div class="location-option ${isSelected ? 'selected' : ''} ${isDisabled}" 
               data-option-index="${idx}" ${opacity}>
            <div class="name">${opt.icon} ${opt.name}</div>
            <div class="addr">${opt.address}</div>
          </div>
        `;
      }).join('');

      // Adiciona event listeners
      els.locationOptions.querySelectorAll('.location-option:not(.disabled)').forEach(opt => {
        opt.addEventListener('click', () => {
          els.locationOptions.querySelectorAll('.location-option').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          const idx = parseInt(opt.dataset.optionIndex);
          selectedLocation = options[idx].data;
        });
      });
    };

    // Renderiza opções iniciais
    renderOptions();

    // Busca localização GPS em segundo plano (não bloqueia o modal)
    getCurrentPosition()
      .then(async position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        const address = await reverseGeocode(lat, lng);

        currentGPSLocation = {
          latitude: lat,
          longitude: lng,
          address: address,
          original_latitude: lat,
          original_longitude: lng,
          original_address: address,
          location_edited: false,
          accuracy: accuracy,
          accuracy_method: null,
          reference_id: null
        };

        // Atualiza o placeholder com os dados reais
        const gpsOptionIndex = options.findIndex(opt => opt.type === 'gps');
        if(gpsOptionIndex !== -1) {
          options[gpsOptionIndex] = {
            type: 'gps',
            icon: '📍',
            name: 'Localização atual (GPS)',
            address: cleanAddress(address) || address,
            data: currentGPSLocation,
            isPlaceholder: false
          };

          // Só seleciona o GPS se for a única opção disponível
          const nonPlaceholderOptions = options.filter(opt => !opt.isPlaceholder);
          if(nonPlaceholderOptions.length === 1) {
            selectedLocation = currentGPSLocation;
          }

          // Re-renderiza as opções
          renderOptions();
        }
      })
      .catch(_ => {
        // Remove o placeholder em caso de erro
        const gpsOptionIndex = options.findIndex(opt => opt.type === 'gps');
        if(gpsOptionIndex !== -1) {
          options.splice(gpsOptionIndex, 1);
          renderOptions();
        }
        currentGPSLocation = null;
      });

  } catch(e){
    onToast('Erro ao obter localização');
    els.punchModal.classList.remove('show');
  }
}

export function closePunchModal(els){
  els.punchModal.classList.remove('show');
  selectedLocation = null;
}

export async function confirmPunch(els, onToast, onRefresh){
  try {
    const { PROXY_URL, USE_PROXY } = await import('./config.js');
    
    if(!selectedLocation){
      onToast('Erro: Nenhuma localização selecionada');
      return;
    }

    els.confirmPunchBtn.disabled = true;
    onToast('Registrando ponto...');

    const token = authData.token;
    const client_id = authData.client;
    const login = authData.uid;
    const uuid = deviceUUID;
    const sign_in_count = authData.signInCount;
    const last_sign_in_ip = authData.lastSignInIp;
    const last_sign_in_at = authData.lastSignInAt;

    const payload = {
      image: null,
      employee: sessionData?.employee || { id: null, pin: null },
      time_card: {
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        address: selectedLocation.address,
        reference_id: selectedLocation.reference_id,
        original_latitude: selectedLocation.original_latitude,
        original_longitude: selectedLocation.original_longitude,
        original_address: selectedLocation.original_address,
        location_edited: selectedLocation.location_edited,
        accuracy: selectedLocation.accuracy,
        accuracy_method: selectedLocation.accuracy_method,
        image: null
      },
      _path: "/registrar-ponto",
      _appVersion: "0.10.32",
      _device: {
        browser: {
          name: "chrome",
          version: "138.0.0.0",
          versionSearchString: "chrome"
        },
        manufacturer: "null",
        model: "null",
        uuid: {
          success: "Login efetuado com sucesso!",
          token: token,
          client_id: client_id,
          data: {
            login: login,
            sign_in_count: sign_in_count,
            last_sign_in_ip: last_sign_in_ip,
            last_sign_in_at: last_sign_in_at
          },
          uuid: uuid,
          // O authorization será injetado pelo servidor (BEARER_TOKEN da ENV)
          authorization: ''
        },
        version: "null"
      }
    };

    const headers = {
      'client': client_id,
      'access-token': token,
      'token': token,
      'uid': login,
      'uuid': uuid,
      'content-type': 'application/json'
    };

    if(!USE_PROXY) {
      headers['origin'] = 'https://app2.pontomais.com.br';
      headers['referer'] = 'https://app2.pontomais.com.br/';
    }

    const apiUrl = USE_PROXY ? PROXY_URL : `${API_BASE}/api/time_cards/register`;
    
    const res = await fetch(apiUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers,
      credentials: 'omit'
    });

    const responseText = await res.text();

    if (!res.ok) {
      console.error(`Erro ao bater ponto [${res.status}]:`, responseText.slice(0, 300));
      throw new Error(`HTTP ${res.status} - ${responseText.slice(0, 200)}`);
    }

    console.log(`Ponto registrado [${res.status}]`);
    
    // Status 2xx significa sucesso - salva no localStorage
    const now = new Date();
    const pendingPunch = {
      timestamp: now.getTime(),
      date: `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`,
      time: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      address: selectedLocation.address,
      original_latitude: selectedLocation.original_latitude,
      original_longitude: selectedLocation.original_longitude,
      original_address: selectedLocation.original_address,
      location_edited: selectedLocation.location_edited,
      accuracy: selectedLocation.accuracy,
      accuracy_method: selectedLocation.accuracy_method,
      isPending: true
    };
    
    savePendingPunch(pendingPunch);
    
    onToast('Ponto registrado com sucesso!');
    closePunchModal(els);
    
    // Atualiza imediatamente para mostrar o ponto pendente
    await onRefresh();

  } catch(e){
    console.error('Erro ao registrar ponto:', e.message);
    onToast('Erro ao registrar ponto');
    els.confirmPunchBtn.disabled = false;
  }
}

export async function baterPonto(els, onToast){
  await openPunchModal(els, onToast);
}

export function setLastPunchLocation(location){
  lastPunchLocation = location;
}

// ====== Funções para gerenciar pontos pendentes no localStorage ======

function savePendingPunch(punchData){
  try {
    const pending = getPendingPunches();
    pending.push(punchData);
    localStorage.setItem(PENDING_PUNCHES_KEY, JSON.stringify(pending));
  } catch(e) {
    console.error('Erro ao salvar ponto pendente:', e);
  }
}

function getPendingPunches(){
  try {
    const data = localStorage.getItem(PENDING_PUNCHES_KEY);
    return data ? JSON.parse(data) : [];
  } catch(e) {
    console.error('Erro ao recuperar pontos pendentes:', e);
    return [];
  }
}

function clearPendingPunch(timestamp){
  try {
    let pending = getPendingPunches();
    pending = pending.filter(p => p.timestamp !== timestamp);
    localStorage.setItem(PENDING_PUNCHES_KEY, JSON.stringify(pending));
  } catch(e) {
    console.error('Erro ao limpar ponto pendente:', e);
  }
}

// Mescla pontos da API com pontos pendentes do localStorage
// Remove do localStorage os que já aparecem na API (com margem de ±2min)
export function mergePunchesWithPending(apiCards){
  const pending = getPendingPunches();
  if(pending.length === 0) return apiCards;

  const merged = [...apiCards];
  const TTL_MS = 15 * 60 * 1000;

  pending.forEach(pendingPunch => {
    const pendingTime = new Date(pendingPunch.timestamp);
    if(Date.now() - pendingPunch.timestamp > TTL_MS) {
      // Remove pontos pendentes com mais de 15 minutos
      clearPendingPunch(pendingPunch.timestamp);
      return;
    }
    
    // Verifica se já existe um ponto da API com horário posterior ao ponto pendente 
    const alreadyInAPI = apiCards.some(card => {
      const cardTime = parsePunchDateTime(card.date, card.time);
      return cardTime >= new Date(pendingTime.getTime());
    });

    if(alreadyInAPI) {
      // Remove do localStorage pois já está na API
      clearPendingPunch(pendingPunch.timestamp);
    } else {
      // Adiciona à lista mesclada
      merged.push(pendingPunch);
    }
  });

  // Ordena por horário
  merged.sort((a, b) => {
    const timeA = a.timestamp ? new Date(a.timestamp) : parsePunchDateTime(a.date, a.time);
    const timeB = b.timestamp ? new Date(b.timestamp) : parsePunchDateTime(b.date, b.time);
    return timeA.getTime() - timeB.getTime();
  });

  return merged;
}

function parsePunchDateTime(dateStr, timeStr){
  const [d, m, y] = dateStr.split('/').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0);
}

