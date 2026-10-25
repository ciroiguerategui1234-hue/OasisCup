// Oasis Cup · conexión con la planilla de Google
// Escribir: cada inscripción se manda por atrás a un Formulario de Google, que la guarda en la planilla.
// Leer: la web lee la pestaña "Para la web (no tocar)", publicada como CSV, sin datos personales.
window.OasisStore = (function () {
  var C = window.OASIS;
  var DEMO_KEY = 'oasiscup-demo-v2';
  var conectado = !!(C.FORM_URL && C.PLANILLA_CSV);
  var ENVIADAS = 'oasiscup-enviadas-v1';   // lo que mandó este navegador, hasta que aparezca en la planilla

  function horas(h) { return h * 3600e3; }
  function vigente(ins, now) {
    if (ins.estado === 'Seña pagada' || ins.estado === 'Pagado') return true;
    if (ins.estado === 'Pendiente de pago') return now - new Date(ins.fecha).getTime() < horas(C.RESERVA_HORAS);
    return false;
  }
  function leerLS(k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } }
  function guardarLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

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
      if (i.estado === 'Seña pagada' || i.estado === 'Pagado') confirmados[i.categoria].push({ equipo: i.equipo, color: i.color });
    });
    return { tomados: tomados, confirmados: confirmados, inscriptos: inscriptos, fixture: fixture || [], demo: !conectado };
  }

  /* ---------- lectura del CSV publicado ---------- */
  function csv(texto) {
    var filas = [], f = [], v = '', q = false;
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (q) { if (c === '"' && texto[i + 1] === '"') { v += '"'; i++; } else if (c === '"') q = false; else v += c; }
      else if (c === '"') q = true; else if (c === ',') { f.push(v); v = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && texto[i + 1] === '\n') i++; f.push(v); filas.push(f); f = []; v = ''; }
      else v += c;
    }
    if (v || f.length) { f.push(v); filas.push(f); }
    return filas;
  }
  // "25/10/2026 9:41:30" (hora argentina) -> ISO
  function fechaPlanilla(s) {
    var m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return new Date(s).toISOString();
    var p = function (n) { return ('0' + n).slice(-2); };
    return new Date(m[3] + '-' + p(m[2]) + '-' + p(m[1]) + 'T' + p(m[4]) + ':' + m[5] + ':' + (m[6] || '00') + '-03:00').toISOString();
  }
  function leerPlanilla() {
    return fetch(C.PLANILLA_CSV + (C.PLANILLA_CSV.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now()).then(function (r) {
      if (!r.ok) throw new Error('csv ' + r.status);
      return r.text();
    }).then(function (t) {
      var filas = csv(t), cab = (filas.shift() || []).map(function (h) { return h.trim().toLowerCase(); });
      var col = function (n) { return cab.findIndex(function (h) { return h.indexOf(n) === 0; }); };
      var iF = col('marca'), iC = col('código') >= 0 ? col('código') : col('codigo'), iCat = col('categor'), iE = col('equipo'), iCam = col('camiseta'), iEs = col('estado');
      return filas.filter(function (f) { return f[iC]; }).map(function (f) {
        var cam = f[iCam] || '', m = cam.match(/\[([a-z]+)\]/);
        var est = (f[iEs] || '').trim();
        if (!est) est = 'Pendiente de pago';
        return { codigo: f[iC], fecha: fechaPlanilla(f[iF]), categoria: (f[iCat] || '').toLowerCase().indexOf('fem') === 0 ? 'femenino' : 'masculino', equipo: f[iE], color: m ? m[1] : '', estado: est };
      });
    });
  }

  function estado() {
    var fx = /fixture=demo/.test(location.search) ? fixtureDemo() : [];
    if (!conectado) return Promise.resolve(armarEstado(leerLS(DEMO_KEY), fx));
    return leerPlanilla().then(function (lista) {
      // sumo lo que este navegador mandó y la planilla todavía no muestra (el CSV tarda unos minutos)
      var codigos = {}; lista.forEach(function (i) { codigos[i.codigo] = 1; });
      var propias = leerLS(ENVIADAS).filter(function (i) { return !codigos[i.codigo] && Date.now() - new Date(i.fecha).getTime() < horas(1); });
      guardarLS(ENVIADAS, propias);
      return armarEstado(lista.concat(propias), fx);
    });
  }

  function codigo() {
    var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = 'OC-';
    for (var i = 0; i < 5; i++) s += abc[Math.floor(Math.random() * abc.length)];
    return s;
  }
  var plata = function (n) { return '$' + Number(n).toLocaleString('es-AR'); };

  function inscribir(d) {
    return estado().catch(function () { return null; }).then(function (e) {
      if (e && C.CUPO[d.categoria] && e.inscriptos[d.categoria] >= C.CUPO[d.categoria]) return { ok: false, error: 'cupo_completo' };
      if (e && d.color !== 'otro' && e.tomados[d.categoria][d.color]) return { ok: false, error: 'color_tomado', equipo: e.tomados[d.categoria][d.color].equipo };
      var cod = codigo();
      var ins = { codigo: cod, fecha: new Date().toISOString(), categoria: d.categoria, equipo: d.equipo, color: d.color, estado: 'Pendiente de pago' };
      if (!conectado) { var l = leerLS(DEMO_KEY); l.push(ins); guardarLS(DEMO_KEY, l); return { ok: true, codigo: cod, demo: true }; }

      var E = C.FORM_CAMPOS;
      var camiseta = (d.colorNombre || '') + ' [' + d.color + ']' + (d.color === 'otro' && d.hex ? ' tono ' + d.hex : '') + (d.alternativo ? '. Si se ocupa: ' + d.alternativo : '');
      var pago = (d.pago === 'Total' ? 'Total ' + plata(d.monto) : 'Mitad ' + plata(d.monto) + ', resto hasta el ' + C.SALDO_HASTA) + '. Talles: ' + (d.eligeTalles === false ? 'genéricos' : 'elegidos');
      var jug = (d.jugadores || []).map(function (j) {
        return j.n + '. ' + j.nombre + ', DNI ' + j.dni + ', talle ' + j.talle + (j.numero ? ', N° ' + j.numero : '') + (j.arquero ? ' (arquero)' : '');
      }).join('\n');
      var f = new URLSearchParams();
      f.append(E.codigo, cod);
      f.append(E.categoria, d.categoria);
      f.append(E.equipo, d.equipo);
      f.append(E.capitan, d.capitan + (d.instagram ? ' (Instagram ' + d.instagram + ')' : ''));
      f.append(E.whatsapp, d.telefono);
      f.append(E.camiseta, camiseta);
      f.append(E.pago, pago);
      f.append(E.jugadores, jug);
      // el formulario no deja leer la respuesta (no-cors): si la red no falla, llegó
      return fetch(C.FORM_URL, { method: 'POST', mode: 'no-cors', body: f }).then(function () {
        var p = leerLS(ENVIADAS); p.push(ins); guardarLS(ENVIADAS, p);
        return { ok: true, codigo: cod };
      });
    });
  }

  return { estado: estado, inscribir: inscribir, get demo() { return !conectado; } };
})();
