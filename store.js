// Oasis Cup · conexión con la planilla (Google Apps Script) o modo demostración
window.OasisStore = (function () {
  var C = window.OASIS;
  var DEMO_KEY = 'oasiscup-demo-v1';
  var demo = !C.API_URL;

  function horas(h) { return h * 3600e3; }
  function vigente(ins, now) {
    if (ins.estado === 'Seña pagada' || ins.estado === 'Pagado') return true;
    if (ins.estado === 'Pendiente de pago') return now - new Date(ins.fecha).getTime() < horas(C.RESERVA_HORAS);
    return false;
  }

  // ---------- Modo demostración: algunos equipos de ejemplo + lo que se inscriba en este navegador ----------
  function demoLeer() {
    var base = [
      { codigo: 'OC-DEMO1', fecha: new Date(Date.now() - horas(30)).toISOString(), categoria: 'masculino', equipo: 'Los Pibes de Tehuelche', color: 'bordo', estado: 'Seña pagada' },
      { codigo: 'OC-DEMO2', fecha: new Date(Date.now() - horas(5)).toISOString(), categoria: 'masculino', equipo: 'La Scaloneta Madrynense', color: 'verde', estado: 'Pendiente de pago' },
      { codigo: 'OC-DEMO3', fecha: new Date(Date.now() - horas(50)).toISOString(), categoria: 'masculino', equipo: 'Real Golfo', color: 'blanco', estado: 'Pagado' },
      { codigo: 'OC-DEMO4', fecha: new Date(Date.now() - horas(20)).toISOString(), categoria: 'femenino', equipo: 'Las Ballenas FC', color: 'celeste', estado: 'Seña pagada' },
      { codigo: 'OC-DEMO5', fecha: new Date(Date.now() - horas(72)).toISOString(), categoria: 'femenino', equipo: 'Equipo vencido', color: 'salmon', estado: 'Pendiente de pago' }
    ];
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

  function armarEstado(lista, fixture) {
    var now = Date.now(), tomados = { masculino: {}, femenino: {} }, confirmados = { masculino: [], femenino: [] }, inscriptos = { masculino: 0, femenino: 0 };
    lista.forEach(function (i) {
      if (!tomados[i.categoria] || !vigente(i, now)) return;
      inscriptos[i.categoria]++;
      if (C.COLORES.some(function (c) { return c.id === i.color; })) tomados[i.categoria][i.color] = { equipo: i.equipo, estado: i.estado };
      if (i.estado === 'Seña pagada' || i.estado === 'Pagado') confirmados[i.categoria].push({ equipo: i.equipo, color: i.color, hex: i.hex || '' });
    });
    return { tomados: tomados, confirmados: confirmados, inscriptos: inscriptos, fixture: fixture || [], demo: demo };
  }

  function estado() {
    if (demo) return Promise.resolve(armarEstado(demoLeer(), []));
    return fetch(C.API_URL + '?t=' + Date.now()).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok) throw new Error('respuesta');
      return armarEstado(d.inscripciones || [], d.fixture || []);
    });
  }

  function codigo() {
    var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = 'OC-';
    for (var i = 0; i < 5; i++) s += abc[Math.floor(Math.random() * abc.length)];
    return s;
  }

  function inscribir(datos) {
    if (demo) {
      return estado().then(function (e) {
        if (C.CUPO[datos.categoria] && e.inscriptos[datos.categoria] >= C.CUPO[datos.categoria]) return { ok: false, error: 'cupo_completo' };
        if (datos.color !== 'otro' && e.tomados[datos.categoria][datos.color]) return { ok: false, error: 'color_tomado', equipo: e.tomados[datos.categoria][datos.color].equipo };
        var ins = { codigo: codigo(), fecha: new Date().toISOString(), categoria: datos.categoria, equipo: datos.equipo, color: datos.color, estado: 'Pendiente de pago' };
        demoGuardar(ins);
        return { ok: true, codigo: ins.codigo, demo: true };
      });
    }
    // text/plain evita el preflight de CORS que Apps Script no responde
    return fetch(C.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(datos) })
      .then(function (r) { return r.json(); });
  }

  return { estado: estado, inscribir: inscribir, demo: demo };
})();
