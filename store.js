// Oasis Cup · conexión con la planilla (función de Vercel /api/inscripciones) o modo demostración
window.OasisStore = (function () {
  var C = window.OASIS;
  var DEMO_KEY = 'oasiscup-demo-v2';   // clave nueva: borra las pruebas anteriores
  var demo = !C.API_URL;

  function horas(h) { return h * 3600e3; }
  function vigente(ins, now) {
    if (ins.estado === 'Seña pagada' || ins.estado === 'Pagado') return true;
    if (ins.estado === 'Pendiente de pago') return now - new Date(ins.fecha).getTime() < horas(C.RESERVA_HORAS);
    return false;
  }

  // ---------- Modo demostración: algunos equipos de ejemplo + lo que se inscriba en este navegador ----------
  function demoLeer() {
    var base = [];   // sin equipos de ejemplo: arranca en cero
    var propias = [];
    try { propias = JSON.parse(localStorage.getItem(DEMO_KEY) || '[]'); } catch (e) {}
    return base.concat(propias);
  }
  function demoGuardar(ins) {
    var propias = [];
    try { propias = JSON.parse(localStorage.getItem(DEMO_KEY) || '[]'); } catch (e) {}
    propias.push(ins);
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(propias)); } catch (e) {}
  }

  // fixture de ejemplo para ver la sección de partidos: agregá ?fixture=demo a la dirección
  function fixtureDemo() {
    var M = 'Masculino';
    return [
      { categoria: M, dia: '7', hora: '19:00', equipoA: 'Los Lobos', equipoB: 'Real Golfo', golesA: 3, golesB: 1, fase: 'Zona A', cancha: '1' },
      { categoria: M, dia: '7', hora: '19:40', equipoA: 'Tehuelches', equipoB: 'Punta Cuevas', golesA: 2, golesB: 2, fase: 'Zona A', cancha: '1' },
      { categoria: M, dia: '7', hora: '20:20', equipoA: 'El Doradillo', equipoB: 'Los Pibes', golesA: 0, golesB: 1, fase: 'Zona B', cancha: '1' },
      { categoria: M, dia: '7', hora: '21:00', equipoA: 'Ballenera', equipoB: 'Muelle Norte', golesA: '', golesB: '', fase: 'Zona B', cancha: '1' },
      { categoria: M, dia: '8', hora: '19:00', equipoA: 'Los Lobos', equipoB: 'Tehuelches', golesA: '', golesB: '', fase: 'Zona A', cancha: '1' },
      { categoria: M, dia: '9', hora: '20:00', equipoA: '1° Zona A', equipoB: '2° Zona B', golesA: '', golesB: '', fase: 'Semifinal', cancha: '1' },
      { categoria: M, dia: '9', hora: '22:00', equipoA: '', equipoB: '', golesA: '', golesB: '', fase: 'Final', cancha: '1' }
    ];
  }

  function armarEstado(lista, fixture) {
    var now = Date.now(), tomados = { masculino: {}, femenino: {} }, confirmados = { masculino: [], femenino: [] }, inscriptos = { masculino: 0, femenino: 0 };
    lista.forEach(function (i) {
      if (!tomados[i.categoria] || !vigente(i, now)) return;
      inscriptos[i.categoria]++;
      if (C.COLORES.some(function (c) { return c.id === i.color; })) tomados[i.categoria][i.color] = { equipo: i.equipo, estado: i.estado };
      if (i.estado === 'Seña pagada' || i.estado === 'Pagado') confirmados[i.categoria].push({ equipo: i.equipo, color: i.color, hex: i.hex || '' });
    });
    return { tomados: tomados, confirmados: confirmados, inscriptos: inscriptos, fixture: fixture || [], demo: !api };
  }

  // Si la función de Vercel todavía no tiene las claves (o no existe), la web sigue en modo demostración
  var api = !demo;
  function estado() {
    if (!api) return Promise.resolve(armarEstado(demoLeer(), /fixture=demo/.test(location.search) ? fixtureDemo() : []));
    return fetch(C.API_URL + '?t=' + Date.now()).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok) throw new Error(d && d.error || 'respuesta');
      return armarEstado(d.inscripciones || [], d.fixture || []);
    }).catch(function (e) {
      if (/sin_configurar|Unexpected|JSON|Failed to fetch|NetworkError/i.test(String(e && e.message))) { api = false; demo = true; return estado(); }
      throw e;
    });
  }

  function codigo() {
    var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = 'OC-';
    for (var i = 0; i < 5; i++) s += abc[Math.floor(Math.random() * abc.length)];
    return s;
  }

  function inscribir(datos) {
    if (!api) {
      return estado().then(function (e) {
        if (C.CUPO[datos.categoria] && e.inscriptos[datos.categoria] >= C.CUPO[datos.categoria]) return { ok: false, error: 'cupo_completo' };
        if (datos.color !== 'otro' && e.tomados[datos.categoria][datos.color]) return { ok: false, error: 'color_tomado', equipo: e.tomados[datos.categoria][datos.color].equipo };
        var ins = { codigo: codigo(), fecha: new Date().toISOString(), categoria: datos.categoria, equipo: datos.equipo, color: datos.color, estado: 'Pendiente de pago' };
        demoGuardar(ins);
        return { ok: true, codigo: ins.codigo, demo: true };
      });
    }
    // text/plain evita el preflight de CORS que Apps Script no responde
    return fetch(C.API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) })
      .then(function (r) { return r.json(); });
  }

  return { estado: estado, inscribir: inscribir, get demo() { return !api; } };
})();
