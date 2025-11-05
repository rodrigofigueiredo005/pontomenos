import { authData, sessionData, API_BASE } from './api.js';

let selectedLocation = null;
let currentGPSLocation = null;
export let lastPunchLocation = null;
let deviceUUID = localStorage.getItem('device_uuid') || generateUUID();

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
    els.locationOptions.innerHTML = '<p class="hint">Buscando sua localização...</p>';
    els.confirmPunchBtn.disabled = false;

    const options = [];

    // Busca localização GPS atual (falhas devem ser silenciosas)
    try {
      const position = await getCurrentPosition();
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

      options.push({
        type: 'gps',
        icon: '📍',
        name: 'Localização atual (GPS)',
        address: cleanAddress(address) || address,
        data: currentGPSLocation
      });
    } catch (_) {
      currentGPSLocation = null;
    }

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

    // Define seleção padrão com base nas opções disponíveis
    selectedLocation = options.length > 0 ? options[0].data : null;

    // Renderiza todas as opções
    els.locationOptions.innerHTML = options.map((opt, idx) => `
      <div class="location-option ${idx === 0 ? 'selected' : ''}" data-option-index="${idx}">
        <div class="name">${opt.icon} ${opt.name}</div>
        <div class="addr">${opt.address}</div>
      </div>
    `).join('');

    els.locationOptions.querySelectorAll('.location-option').forEach(opt => {
      opt.addEventListener('click', () => {
        els.locationOptions.querySelectorAll('.location-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        const idx = parseInt(opt.dataset.optionIndex);
        selectedLocation = options[idx].data;
      });
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
    const { CREDENTIALS } = await import('./credentials.js');
    
    if(!selectedLocation){
      onToast('Erro: Nenhuma localização selecionada');
      return;
    }

    els.confirmPunchBtn.disabled = true;
    onToast('Registrando ponto...');

    const token = CREDENTIALS.HARDCODED_TOKEN || authData.token;
    const client_id = CREDENTIALS.HARDCODED_CLIENT_ID || authData.client;
    const login = CREDENTIALS.HARDCODED_LOGIN || authData.uid;
    const uuid = CREDENTIALS.HARDCODED_UUID || deviceUUID;
    const sign_in_count = CREDENTIALS.HARDCODED_SIGN_IN_COUNT || authData.signInCount;
    const last_sign_in_ip = CREDENTIALS.HARDCODED_LAST_SIGN_IN_IP || authData.lastSignInIp;
    const last_sign_in_at = CREDENTIALS.HARDCODED_LAST_SIGN_IN_AT || authData.lastSignInAt;

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
          authorization: `Bearer ${CREDENTIALS.BEARER_TOKEN}`
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
    onToast('Ponto registrado com sucesso!');
    closePunchModal(els);
    
    if (res.status === 202) {
      addTemporaryPunch(els, selectedLocation);
      setTimeout(() => onRefresh(), 2000);
    } else {
      await onRefresh();
    }

  } catch(e){
    console.error('Erro ao registrar ponto:', e.message);
    onToast('Erro ao registrar ponto');
    els.confirmPunchBtn.disabled = false;
  }
}

export async function baterPonto(els, onToast){
  await openPunchModal(els, onToast);
}

function addTemporaryPunch(els, location){
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const dateStr = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
  
  els.ultimoPontoData.textContent = dateStr;
  els.ultimoPontoHora.textContent = timeStr;
  
  const tempPunchHtml = `
    <div class="punch-item" style="opacity: 0.7; border: 1px dashed #999;">
      <div class="top">
        <div class="time">${timeStr}</div>
        <div class="type">Processando...</div>
        <div class="badge">App Web</div>
      </div>
      ${(location && location.address) ? `<div class="location">📍 ${cleanAddress(location.address)}</div>` : ''}
    </div>
  `;
  
  if(els.punchList.querySelector('.punch-item')) {
    els.punchList.insertAdjacentHTML('afterbegin', tempPunchHtml);
  } else {
    els.punchList.innerHTML = tempPunchHtml;
  }
}

export function setLastPunchLocation(location){
  lastPunchLocation = location;
}

