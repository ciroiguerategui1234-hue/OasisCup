// Oasis Cup · puente entre la web y la planilla de Google (función de Vercel)
// GET  /api/inscripciones  -> colores tomados y fixture (sin datos personales)
// POST /api/inscripciones  -> guarda una inscripción nueva y su plantel
// Usa una cuenta de servicio de Google. Variables en Vercel:
//   GOOGLE_CLIENT_EMAIL  el email de la cuenta de servicio (termina en iam.gserviceaccount.com)
//   GOOGLE_PRIVATE_KEY   la clave "private_key" del archivo JSON, completa
//   SHEET_ID             (opcional) el id de la planilla
const crypto = require('crypto');

const SHEET_ID = process.env.SHEET_ID || '1B5zPrYvx3o7nCkpvs9yam-swz-14Gj3VZ15MEYAqA58';
const RESERVA_HORAS = 48;
const CUPO = { masculino: 12, femenino: 6 };
const COLORES = ['marino', 'verde', 'bordo', 'celeste', 'marron', 'gris', 'agua', 'salmon', 'blanco'];
const ESTADOS = ['Pendiente de pago', 'Seña pagada', 'Pagado', 'Cancelado'];
const TABS = {
  Inscripciones: ['Fecha', 'Código', 'Categoría', 'Equipo', 'Estado', 'Pago elegido', 'Monto', 'Color', 'Color (código)', 'Tono elegido', 'Segunda opción', 'Elige talles', 'Capitán/a', 'WhatsApp', 'Instagram', 'Jugadores', 'Arquero', 'Reserva vence', 'Notas'],
  Jugadores: ['Código', 'Equipo', 'Categoría', 'Jugador', 'Nombre y apellido', 'DNI', 'Talle', 'Número', 'Arquero'],
  'Fixture web': ['Categoría', 'Día', 'Hora', 'Equipo A', 'Goles A', 'Goles B', 'Equipo B', 'Fase', 'Cancha']
};
const API = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;

/* ---------- acceso a Google con la cuenta de servicio ---------- */
let token = null;
async function acceso() {
  if (token && token.vence > Date.now() + 60e3) return token.valor;
  const email = process.env.GOOGLE_CLIENT_EMAIL, clave = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !clave) throw new Error('faltan_credenciales');
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const ahora = Math.floor(Date.now() / 1000);
  const sin = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600 });
  const firma = crypto.createSign('RSA-SHA256').update(sin).sign(clave, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: sin + '.' + firma }) });
  const d = await r.json();
  if (!d.access_token) throw new Error('token: ' + JSON.stringify(d));
  token = { valor: d.access_token, vence: Date.now() + (d.expires_in || 3600) * 1000 };
  return token.valor;
}
async function g(ruta, opts = {}) {
  const r = await fetch(API + ruta, { ...opts, headers: { Authorization: 'Bearer ' + (await acceso()), 'Content-Type': 'application/json' } });
  const d = await r.json();
  if (!r.ok) throw new Error('sheets ' + r.status + ': ' + JSON.stringify(d.error || d));
  return d;
}
const rango = (tab, a1) => encodeURIComponent(`'${tab}'!${a1}`);

/* ---------- la primera vez arma las pestañas ---------- */
let listo = false;
async function preparar() {
  if (listo) return;
  const meta = await g('?fields=sheets.properties');
  const existentes = new Map(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
  const faltan = Object.keys(TABS).filter((t) => !existentes.has(t));
  if (faltan.length) {
    const r = await g(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: faltan.map((t) => ({ addSheet: { properties: { title: t, gridProperties: { frozenRowCount: 1 } } } })) }) });
    r.replies.forEach((rep, i) => existentes.set(faltan[i], rep.addSheet.properties.sheetId));
    await g('/values:batchUpdate', { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data: faltan.map((t) => ({ range: `'${t}'!A1`, values: [TABS[t]] })) }) });
    const reqs = [];
    faltan.forEach((t) => reqs.push({ repeatCell: { range: { sheetId: existentes.get(t), startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true, foregroundColor: { red: .97, green: .97, blue: .95 } }, backgroundColor: { red: .07, green: .25, blue: .15 } } }, fields: 'userEnteredFormat.textFormat,userEnteredFormat.backgroundColor' } }));
    if (faltan.includes('Inscripciones')) {
      const id = existentes.get('Inscripciones'), col = TABS.Inscripciones.indexOf('Estado');
      const r5 = { sheetId: id, startRowIndex: 1, startColumnIndex: col, endColumnIndex: col + 1 };
      reqs.push({ setDataValidation: { range: r5, rule: { condition: { type: 'ONE_OF_LIST', values: ESTADOS.map((v) => ({ userEnteredValue: v })) }, strict: true, showCustomUi: true } } });
      const colores = { 'Pendiente de pago': [.99, .91, .70], 'Seña pagada': [.80, .91, .83], 'Pagado': [.56, .80, .62], 'Cancelado': [.90, .90, .90] };
      Object.entries(colores).forEach(([v, [red, green, blue]]) => reqs.push({ addConditionalFormatRule: { index: 0, rule: { ranges: [r5], booleanRule: { condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: v }] }, format: { backgroundColor: { red, green, blue } } } } } }));
    }
    const vacia = existentes.get('Hoja 1') ?? existentes.get('Sheet1');
    if (vacia !== undefined) reqs.push({ deleteSheet: { sheetId: vacia } });
    try { await g(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: reqs }) }); }
    catch (e) { await g(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: reqs.filter((q) => !q.deleteSheet) }) }); }
  }
  listo = true;
}

/* ---------- lectura ---------- */
async function filas(tab) {
  const d = await g('/values/' + rango(tab, 'A1:Z5000'));
  const v = d.values || [], cab = v.shift() || [];
  return v.map((f) => Object.fromEntries(cab.map((c, i) => [c, f[i] ?? ''])));
}
// "2026-10-23 19:05" en hora argentina
const fechaAR = (d) => new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
const leerFecha = (s) => { const m = String(s).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/); return m ? new Date(`${m[1]}T${m[2]}:00-03:00`) : new Date(NaN); };
function vigente(r, ahora) {
  if (r['Estado'] === 'Seña pagada' || r['Estado'] === 'Pagado') return true;
  if (r['Estado'] === 'Pendiente de pago') return ahora - leerFecha(r['Fecha']) < RESERVA_HORAS * 3600e3;
  return false;
}
const txt = (v, n = 120) => String(v == null ? '' : v).slice(0, n);

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    await preparar();
    if (req.method === 'GET') {
      const [ins, fix] = await Promise.all([filas('Inscripciones'), filas('Fixture web')]);
      res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
      return res.status(200).json({
        ok: true,
        inscripciones: ins.filter((r) => r['Código']).map((r) => ({ codigo: r['Código'], fecha: isNaN(leerFecha(r['Fecha'])) ? '' : leerFecha(r['Fecha']).toISOString(), categoria: r['Categoría'], equipo: r['Equipo'], color: r['Color (código)'], hex: r['Tono elegido'], estado: r['Estado'] })),
        fixture: fix.filter((r) => r['Equipo A'] || r['Equipo B'] || r['Fase']).map((r) => ({ categoria: r['Categoría'], dia: r['Día'], hora: r['Hora'], equipoA: r['Equipo A'], equipoB: r['Equipo B'], golesA: r['Goles A'], golesB: r['Goles B'], fase: r['Fase'], cancha: r['Cancha'] }))
      });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'metodo' });

    const d = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const cat = d.categoria === 'femenino' ? 'femenino' : 'masculino';
    if (!d.equipo || !d.capitan || !Array.isArray(d.jugadores) || d.jugadores.length < 8) return res.status(400).json({ ok: false, error: 'datos' });

    const ahora = new Date();
    const todas = await filas('Inscripciones');
    const vigentes = todas.filter((r) => r['Categoría'] === cat && vigente(r, ahora));
    if (CUPO[cat] && vigentes.length >= CUPO[cat]) return res.status(200).json({ ok: false, error: 'cupo_completo' });
    if (COLORES.includes(d.color)) {
      const ya = vigentes.find((r) => r['Color (código)'] === d.color);
      if (ya) return res.status(200).json({ ok: false, error: 'color_tomado', equipo: ya['Equipo'] });
    }
    const usados = new Set(todas.map((r) => r['Código']));
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codigo; do { codigo = 'OC-' + Array.from(crypto.randomBytes(5), (b) => abc[b % abc.length]).join(''); } while (usados.has(codigo));

    const arq = d.jugadores.find((j) => j.arquero);
    const fila = [fechaAR(ahora), codigo, cat, txt(d.equipo, 40), 'Pendiente de pago', d.pago === 'Total' ? 'Total' : 'Mitad', Number(d.monto) || 0,
      txt(d.colorNombre), txt(d.color), txt(d.hex), txt(d.alternativo), d.eligeTalles === false ? 'No (genéricos)' : 'Sí',
      txt(d.capitan), txt(d.telefono), txt(d.instagram), d.jugadores.length, arq ? txt(arq.nombre) : '', fechaAR(new Date(ahora.getTime() + RESERVA_HORAS * 3600e3)), ''];
    const jug = d.jugadores.slice(0, 10).map((j) => [codigo, txt(d.equipo, 40), cat, Number(j.n) || '', txt(j.nombre), txt(j.dni, 12), txt(j.talle, 10), txt(j.numero, 3), j.arquero ? 'Sí' : '']);
    // RAW: lo que escribe el equipo se guarda como texto, nunca como fórmula
    await g('/values/' + rango('Inscripciones', 'A1') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { method: 'POST', body: JSON.stringify({ values: [fila] }) });
    await g('/values/' + rango('Jugadores', 'A1') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { method: 'POST', body: JSON.stringify({ values: jug }) });
    return res.status(200).json({ ok: true, codigo });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: String(e.message).startsWith('faltan_credenciales') ? 'sin_configurar' : 'servidor' });
  }
};
