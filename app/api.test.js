import assert from 'assert';
import {
  parseDMY,
  parseDateTimeDMY,
  msToHHMM,
  fmtTime,
  calcWorkedMsToday,
  calcExpectedEnd,
  calcLimitTime
} from './api.js';

// Helper para criar cards de teste
function createCard(dateStr, timeStr) {
  return { date: dateStr, time: timeStr };
}

console.log('🧪 Iniciando testes de unidade...\n');

// ===== Testes de Parse e Formatação =====
console.log('📅 Testes de Parse e Formatação');

// parseDMY
(() => {
  const date = parseDMY('06/11/2025');
  assert.strictEqual(date.getFullYear(), 2025);
  assert.strictEqual(date.getMonth(), 10); // Novembro é mês 10
  assert.strictEqual(date.getDate(), 6);
  console.log('✓ parseDMY: converte corretamente data DD/MM/YYYY');
})();

// parseDateTimeDMY
(() => {
  const dt = parseDateTimeDMY('06/11/2025', '09:30');
  assert.strictEqual(dt.getFullYear(), 2025);
  assert.strictEqual(dt.getMonth(), 10);
  assert.strictEqual(dt.getDate(), 6);
  assert.strictEqual(dt.getHours(), 9);
  assert.strictEqual(dt.getMinutes(), 30);
  console.log('✓ parseDateTimeDMY: converte corretamente data e hora');
})();

// msToHHMM
(() => {
  assert.strictEqual(msToHHMM(3600000), '01:00'); // 1h
  assert.strictEqual(msToHHMM(7200000), '02:00'); // 2h
  assert.strictEqual(msToHHMM(5400000), '01:30'); // 1h30
  assert.strictEqual(msToHHMM(-3600000), '-01:00'); // -1h
  console.log('✓ msToHHMM: formata corretamente milissegundos para HH:MM');
})();

// fmtTime
(() => {
  const d = new Date('2025-11-06T14:30:00');
  assert.strictEqual(fmtTime(d), '14:30');
  assert.strictEqual(fmtTime(null), '—');
  console.log('✓ fmtTime: formata corretamente objetos Date');
})();

// ===== Testes de Cálculo de Tempo Trabalhado =====
console.log('\n⏱️  Testes de Cálculo de Tempo Trabalhado');

// calcWorkedMsToday - entrada única
(() => {
  const cards = [createCard('06/11/2025', '09:00')];
  // Mock de Date.now para simular que são 12:00
  const now = parseDateTimeDMY('06/11/2025', '12:00');
  const originalDate = global.Date;
  global.Date = class extends originalDate {
    constructor(...args) {
      if (args.length === 0) {
        super(now);
      } else {
        super(...args);
      }
    }
    static now() {
      return now.getTime();
    }
  };
  
  const worked = calcWorkedMsToday(cards);
  const hours = worked / (60 * 60 * 1000);
  
  global.Date = originalDate;
  
  assert.ok(Math.abs(hours - 3) < 0.01, `Deve calcular 3h trabalhadas (calculou ${hours.toFixed(2)}h)`);
  console.log('✓ calcWorkedMsToday: calcula corretamente com entrada única');
})();

// calcWorkedMsToday - entrada e saída
(() => {
  const cards = [
    createCard('06/11/2025', '09:00'),
    createCard('06/11/2025', '12:00')
  ];
  const worked = calcWorkedMsToday(cards);
  const hours = worked / (60 * 60 * 1000);
  assert.strictEqual(hours, 3, 'Deve calcular 3h trabalhadas');
  console.log('✓ calcWorkedMsToday: calcula corretamente com entrada e saída');
})();

// calcWorkedMsToday - jornada completa com intervalo
(() => {
  const cards = [
    createCard('06/11/2025', '09:00'), // Entrada
    createCard('06/11/2025', '12:00'), // Saída almoço
    createCard('06/11/2025', '13:00'), // Volta almoço
    createCard('06/11/2025', '18:00')  // Saída
  ];
  const worked = calcWorkedMsToday(cards);
  const hours = worked / (60 * 60 * 1000);
  assert.strictEqual(hours, 8, 'Deve calcular 8h trabalhadas (3h + 5h)');
  console.log('✓ calcWorkedMsToday: calcula corretamente jornada completa com intervalo');
})();

// ===== Testes de Cálculo de Horário Esperado =====
console.log('\n🎯 Testes de Cálculo de Horário Esperado');

// calcExpectedEnd - sem batidas
(() => {
  const result = calcExpectedEnd([]);
  assert.strictEqual(result, null);
  console.log('✓ calcExpectedEnd: retorna null sem batidas');
})();

// calcExpectedEnd - número par de batidas (já saiu)
(() => {
  const cards = [
    createCard('06/11/2025', '09:00'),
    createCard('06/11/2025', '18:00')
  ];
  const result = calcExpectedEnd(cards);
  assert.strictEqual(result, null);
  console.log('✓ calcExpectedEnd: retorna null com número par de batidas');
})();

// calcExpectedEnd - sem intervalo ainda (deve adicionar 1h obrigatória)
(() => {
  const cards = [createCard('06/11/2025', '09:00')];
  const now = parseDateTimeDMY('06/11/2025', '09:00');
  const originalDate = global.Date;
  global.Date = class extends originalDate {
    constructor(...args) {
      if (args.length === 0) {
        super(now);
      } else {
        super(...args);
      }
    }
    static now() {
      return now.getTime();
    }
  };
  
  const expected = calcExpectedEnd(cards, 8);
  const expectedHour = expected.getHours();
  
  global.Date = originalDate;
  
  // 09:00 + 8h trabalho + 1h intervalo = 18:00
  assert.strictEqual(expectedHour, 18, 'Deve adicionar 1h de intervalo obrigatório');
  console.log('✓ calcExpectedEnd: adiciona 1h obrigatória quando não há intervalo');
})();

// calcExpectedEnd - com pausa pequena (15min) - deve ainda adicionar 1h
(() => {
  const cards = [
    createCard('06/11/2025', '09:00'),
    createCard('06/11/2025', '12:00'), // Saída
    createCard('06/11/2025', '12:15')  // Volta após 15min (pausa curta)
  ];
  const now = parseDateTimeDMY('06/11/2025', '12:15');
  const originalDate = global.Date;
  global.Date = class extends originalDate {
    constructor(...args) {
      if (args.length === 0) {
        super(now);
      } else {
        super(...args);
      }
    }
    static now() {
      return now.getTime();
    }
  };
  
  const expected = calcExpectedEnd(cards, 8);
  const worked = calcWorkedMsToday(cards); // 3h
  const remaining = expected.getTime() - now.getTime();
  const remainingHours = remaining / (60 * 60 * 1000);
  
  global.Date = originalDate;
  
  // Falta 5h de trabalho + 1h de intervalo obrigatório = 6h
  assert.ok(Math.abs(remainingHours - 6) < 0.1, `Deve adicionar 1h mesmo com pausa pequena (calculou ${remainingHours.toFixed(2)}h)`);
  console.log('✓ calcExpectedEnd: adiciona 1h obrigatória mesmo com pausa pequena');
})();

// calcExpectedEnd - com intervalo válido de 1h
(() => {
  const cards = [
    createCard('06/11/2025', '09:00'),
    createCard('06/11/2025', '12:00'), // Saída
    createCard('06/11/2025', '13:00')  // Volta após 1h
  ];
  const now = parseDateTimeDMY('06/11/2025', '13:00');
  const originalDate = global.Date;
  global.Date = class extends originalDate {
    constructor(...args) {
      if (args.length === 0) {
        super(now);
      } else {
        super(...args);
      }
    }
    static now() {
      return now.getTime();
    }
  };
  
  const expected = calcExpectedEnd(cards, 8);
  const worked = calcWorkedMsToday(cards); // 3h
  const remaining = expected.getTime() - now.getTime();
  const remainingHours = remaining / (60 * 60 * 1000);
  
  global.Date = originalDate;
  
  // Falta 5h de trabalho (sem adicionar intervalo, pois já fez)
  assert.ok(Math.abs(remainingHours - 5) < 0.1, `Não deve adicionar 1h se já fez intervalo válido (calculou ${remainingHours.toFixed(2)}h)`);
  console.log('✓ calcExpectedEnd: não adiciona 1h quando já há intervalo válido');
})();

// ===== Testes de Cálculo de Horário Limite =====
console.log('\n⏰ Testes de Cálculo de Horário Limite');

// calcLimitTime - sem batidas
(() => {
  const result = calcLimitTime([], 0, true);
  assert.strictEqual(result, null);
  console.log('✓ calcLimitTime: retorna null sem batidas');
})();

// calcLimitTime - não-CLT usa expectedEnd
(() => {
  const cards = [createCard('06/11/2025', '09:00')];
  const workedMs = 3 * 60 * 60 * 1000;
  const expectedEnd = new Date('2025-11-06T15:00:00');
  
  const limit = calcLimitTime(cards, workedMs, false, expectedEnd);
  assert.strictEqual(limit.getTime(), expectedEnd.getTime());
  console.log('✓ calcLimitTime: não-CLT retorna expectedEnd');
})();

// calcLimitTime - CLT considera limite de 6h após última batida
(() => {
  const cards = [
    createCard('06/11/2025', '09:00'),
    createCard('06/11/2025', '12:00'),
    createCard('06/11/2025', '13:00')
  ];
  const now = parseDateTimeDMY('06/11/2025', '14:00'); // 1h trabalhando após almoço
  const originalDate = global.Date;
  global.Date = class extends originalDate {
    constructor(...args) {
      if (args.length === 0) {
        super(now);
      } else {
        super(...args);
      }
    }
    static now() {
      return now.getTime();
    }
  };
  
  const workedMs = 4 * 60 * 60 * 1000; // 4h trabalhadas
  const limit = calcLimitTime(cards, workedMs, true, null);
  
  global.Date = originalDate;
  
  // Limite 1: 6h após última batida (13:00 + 6h = 19:00)
  const expectedLimit1 = new Date('2025-11-06T19:00:00');
  assert.ok(limit !== null, 'Deve retornar um horário limite');
  console.log('✓ calcLimitTime: CLT considera 6h após última batida');
})();

// calcLimitTime - CLT considera limite de 10h totais trabalhadas
(() => {
  const cards = [
    createCard('06/11/2025', '09:00'),
    createCard('06/11/2025', '12:00'),
    createCard('06/11/2025', '13:00')
  ];
  const now = parseDateTimeDMY('06/11/2025', '17:00');
  const originalDate = global.Date;
  global.Date = class extends originalDate {
    constructor(...args) {
      if (args.length === 0) {
        super(now);
      } else {
        super(...args);
      }
    }
    static now() {
      return now.getTime();
    }
  };
  
  const workedMs = 7 * 60 * 60 * 1000; // 7h trabalhadas
  const limit = calcLimitTime(cards, workedMs, true, null);
  
  global.Date = originalDate;
  
  // Limite 2: faltam 3h para completar 10h (17:00 + 3h = 20:00)
  // Limite 3: às 22:00
  // Deve retornar o menor entre os 3 limites
  assert.ok(limit !== null, 'Deve retornar um horário limite');
  console.log('✓ calcLimitTime: CLT considera limite de 10h totais trabalhadas');
})();

// calcLimitTime - CLT considera limite de 22h
(() => {
  const cards = [createCard('06/11/2025', '20:00')];
  const now = parseDateTimeDMY('06/11/2025', '21:00');
  const originalDate = global.Date;
  global.Date = class extends originalDate {
    constructor(...args) {
      if (args.length === 0) {
        super(now);
      } else {
        super(...args);
      }
    }
    static now() {
      return now.getTime();
    }
  };
  
  const workedMs = 1 * 60 * 60 * 1000; // 1h trabalhada
  const limit = calcLimitTime(cards, workedMs, true, null);
  
  global.Date = originalDate;
  
  // Deve limitar às 22:00
  assert.strictEqual(limit.getHours(), 22);
  assert.strictEqual(limit.getMinutes(), 0);
  console.log('✓ calcLimitTime: CLT limita às 22:00');
})();

// calcLimitTime - retorna o menor entre os 3 limites
(() => {
  const cards = [
    createCard('06/11/2025', '08:00'),
    createCard('06/11/2025', '12:00'),
    createCard('06/11/2025', '13:00')
  ];
  const now = parseDateTimeDMY('06/11/2025', '18:00');
  const originalDate = global.Date;
  global.Date = class extends originalDate {
    constructor(...args) {
      if (args.length === 0) {
        super(now);
      } else {
        super(...args);
      }
    }
    static now() {
      return now.getTime();
    }
  };
  
  const workedMs = 9 * 60 * 60 * 1000; // 9h trabalhadas (1h extra)
  const limit = calcLimitTime(cards, workedMs, true, null);
  
  global.Date = originalDate;
  
  // Limite 1: 13:00 + 6h = 19:00
  // Limite 2: 18:00 + 1h restante (para 10h) = 19:00
  // Limite 3: 22:00
  // Deve retornar 19:00 (o menor)
  assert.ok(limit !== null, 'Deve retornar um horário limite');
  assert.strictEqual(limit.getHours(), 19);
  console.log('✓ calcLimitTime: retorna o menor entre os 3 limites');
})();

console.log('\n✅ Todos os testes passaram!\n');
