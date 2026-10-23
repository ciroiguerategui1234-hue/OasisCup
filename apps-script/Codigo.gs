/**
 * Oasis Cup × mirabella · planilla de inscripciones
 *
 * Pegá este código en la planilla (Extensiones > Apps Script), ejecutá "configurar" una vez
 * y publicalo como aplicación web. La página guarda cada inscripción acá y lee qué colores
 * están tomados. Vos aprobás los pagos cambiando la columna "Estado".
 */

const CONFIG = {
  RESERVA_HORAS: 48,
  CUPO: { masculino: 12, femenino: 6 },
  COLORES: ['marino', 'verde', 'bordo', 'celeste', 'marron', 'gris', 'agua', 'salmon', 'blanco'],
  AVISAR_POR_MAIL: true          // te llega un mail con cada inscripción nueva
};

const ESTADOS = ['Pendiente de pago', 'Seña pagada', 'Pagado', 'Cancelado'];
const H_INS = ['Fecha', 'Código', 'Categoría', 'Equipo', 'Estado', 'Pago elegido', 'Monto', 'Color', 'Color (código)', 'Tono elegido', 'Segunda opción', 'Elige talles', 'Capitán/a', 'WhatsApp', 'Instagram', 'Jugadores', 'Arquero', 'Reserva vence', 'Notas'];
const H_JUG = ['Código', 'Equipo', 'Categoría', 'Jugador', 'Nombre y apellido', 'DNI', 'Talle', 'Número', 'Arquero'];
const H_FIX = ['Categoría', 'Día', 'Hora', 'Equipo A', 'Goles A', 'Goles B', 'Equipo B', 'Fase', 'Cancha'];

/* ---------- 1. Ejecutá esto una sola vez ---------- */
function configurar() {
  const ss = SpreadsheetApp.getActive();
  const ins = hoja_(ss, 'Inscripciones', H_INS);
  hoja_(ss, 'Jugadores', H_JUG);
  const fix = hoja_(ss, 'Fixture web', H_FIX);

  // Estado: desplegable con colores
  const col = H_INS.indexOf('Estado') + 1;
  const rango = ins.getRange(2, col, ins.getMaxRows() - 1, 1);
  rango.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).setAllowInvalid(false).build());
  const colores = { 'Pendiente de pago': '#FCE8B2', 'Seña pagada': '#CDE7D3', 'Pagado': '#8FCB9F', 'Cancelado': '#E6E6E6' };
  ins.setConditionalFormatRules(Object.keys(colores).map((e) => SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(e).setBackground(colores[e]).setRanges([rango]).build()));
  ins.getRange('A:A').setNumberFormat('dd/mm/yyyy hh:mm');
  ins.getRange('R:R').setNumberFormat('dd/mm/yyyy hh:mm');
  ins.getRange('G:G').setNumberFormat('$#,##0');
  fix.getRange('A2:A').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Masculino', 'Femenino'], true).build());

  // Resumen: equipos por estado y talles para encargar camisetas
  const res = ss.getSheetByName('Resumen') || ss.insertSheet('Resumen');
  res.clear();
  res.getRange('A1').setValue('Equipos por estado').setFontWeight('bold');
  res.getRange('A2:C2').setValues([['Estado', 'Masculino', 'Femenino']]).setFontWeight('bold');
  ESTADOS.forEach((e, i) => {
    const r = i + 3;
    res.getRange(r, 1).setValue(e);
    res.getRange(r, 2).setFormula(`=COUNTIFS(Inscripciones!C:C,"masculino",Inscripciones!E:E,A${r})`);
    res.getRange(r, 3).setFormula(`=COUNTIFS(Inscripciones!C:C,"femenino",Inscripciones!E:E,A${r})`);
  });
  res.getRange('A9').setValue('Talles de equipos con pago (seña o total)').setFontWeight('bold');
  res.getRange('A10:C10').setValues([['Talle', 'Masculino', 'Femenino']]).setFontWeight('bold');
  ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Genérico'].forEach((t, i) => {
    const r = i + 11;
    res.getRange(r, 1).setValue(t);
    ['masculino', 'femenino'].forEach((c, k) => res.getRange(r, 2 + k).setFormula(
      `=SUMPRODUCT((Jugadores!C2:C="${c}")*(Jugadores!G2:G=A${r})*(COUNTIFS(Inscripciones!B:B,Jugadores!A2:A,Inscripciones!E:E,"Seña pagada")+COUNTIFS(Inscripciones!B:B,Jugadores!A2:A,Inscripciones!E:E,"Pagado")>0))`));
  });
  res.setColumnWidth(1, 260);
  const hoja1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (hoja1 && ss.getSheets().length > 1 && hoja1.getLastRow() === 0) ss.deleteSheet(hoja1);
  ss.setActiveSheet(ins);
}

function hoja_(ss, nombre, headers) {
  const h = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
  h.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#113F26').setFontColor('#F7F7F2');
  h.setFrozenRows(1);
  headers.forEach((_, i) => h.autoResizeColumn(i + 1));
  return h;
}

/* ---------- Limpieza: vacía la lista de equipos de la pestaña Costos ----------
   Borra solo los datos de los equipos (columnas D a H, desde la fila 3).
   Deja los títulos de la tabla y los montos de la columna A y B. Ejecutalo una vez. */
function borrarEquiposDeCostos() {
  const h = SpreadsheetApp.getActive().getSheetByName('Costos');
  if (!h) return;
  const ultima = Math.max(h.getLastRow(), 3);
  h.getRange(3, 4, ultima - 2, 5).clearContent();
}

/* ---------- La página lee: colores tomados y fixture (sin datos personales) ---------- */
function doGet() {
  const ss = SpreadsheetApp.getActive();
  const ins = filas_(ss.getSheetByName('Inscripciones')).map((r) => ({
    codigo: r['Código'], fecha: fechaISO_(r['Fecha']), categoria: r['Categoría'], equipo: r['Equipo'],
    color: r['Color (código)'], hex: r['Tono elegido'], estado: r['Estado']
  }));
  const fixture = filas_(ss.getSheetByName('Fixture web')).filter((r) => r['Equipo A'] || r['Equipo B']).map((r) => ({
    categoria: r['Categoría'], dia: r['Día'] instanceof Date ? String(r['Día'].getDate()) : String(r['Día']),
    hora: r['Hora'] instanceof Date ? Utilities.formatDate(r['Hora'], 'America/Argentina/Buenos_Aires', 'HH:mm') : r['Hora'],
    equipoA: r['Equipo A'], equipoB: r['Equipo B'], golesA: r['Goles A'], golesB: r['Goles B'], fase: r['Fase'], cancha: r['Cancha']
  }));
  return json_({ ok: true, inscripciones: ins, fixture: fixture });
}

/* ---------- La página escribe: una inscripción nueva ---------- */
function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return json_({ ok: false, error: 'ocupado' });
  try {
    const d = JSON.parse(e.postData.contents);
    const cat = d.categoria === 'femenino' ? 'femenino' : 'masculino';
    if (!d.equipo || !d.capitan || !Array.isArray(d.jugadores) || d.jugadores.length < 8) return json_({ ok: false, error: 'datos' });

    const ss = SpreadsheetApp.getActive();
    const hIns = ss.getSheetByName('Inscripciones');
    const ahora = new Date();
    const vigentes = filas_(hIns).filter((r) => r['Categoría'] === cat && vigente_(r, ahora));

    if (CONFIG.CUPO[cat] && vigentes.length >= CONFIG.CUPO[cat]) return json_({ ok: false, error: 'cupo_completo' });
    if (CONFIG.COLORES.indexOf(d.color) >= 0) {
      const ya = vigentes.find((r) => r['Color (código)'] === d.color);
      if (ya) return json_({ ok: false, error: 'color_tomado', equipo: ya['Equipo'] });
    }

    const codigo = codigo_(hIns);
    const arq = d.jugadores.find((j) => j.arquero);
    const vence = new Date(ahora.getTime() + CONFIG.RESERVA_HORAS * 3600e3);
    hIns.appendRow([ahora, codigo, cat, txt_(d.equipo), 'Pendiente de pago', d.pago === 'Total' ? 'Total' : 'Mitad', Number(d.monto) || 0,
      txt_(d.colorNombre), txt_(d.color), txt_(d.hex), txt_(d.alternativo), d.eligeTalles === false ? 'No (genéricos)' : 'Sí',
      txt_(d.capitan), txt_(d.telefono), txt_(d.instagram), d.jugadores.length, arq ? txt_(arq.nombre) : '', vence, '']);
    const hJug = ss.getSheetByName('Jugadores');
    const filas = d.jugadores.slice(0, 10).map((j) => [codigo, txt_(d.equipo), cat, Number(j.n) || '', txt_(j.nombre), txt_(j.dni), txt_(j.talle), txt_(j.numero), j.arquero ? 'Sí' : '']);
    if (filas.length) hJug.getRange(hJug.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas);

    if (CONFIG.AVISAR_POR_MAIL) {
      try {
        MailApp.sendEmail(Session.getEffectiveUser().getEmail(), `Oasis Cup: nueva inscripción ${codigo}`,
          `${d.equipo} (${cat})\nCamiseta: ${d.colorNombre}\nPago elegido: ${d.pago} $${d.monto}\nCapitán/a: ${d.capitan}, ${d.telefono}\n\nCuando llegue el comprobante, cambiá el Estado en la planilla:\n${ss.getUrl()}`);
      } catch (err) {}
    }
    return json_({ ok: true, codigo: codigo });
  } catch (err) {
    return json_({ ok: false, error: 'servidor' });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- ayudas ---------- */
function vigente_(r, ahora) {
  if (r['Estado'] === 'Seña pagada' || r['Estado'] === 'Pagado') return true;
  if (r['Estado'] === 'Pendiente de pago') return ahora - new Date(r['Fecha']) < CONFIG.RESERVA_HORAS * 3600e3;
  return false;
}
function filas_(h) {
  if (!h || h.getLastRow() < 2) return [];
  const v = h.getDataRange().getValues(), cab = v.shift();
  return v.map((f) => { const o = {}; cab.forEach((c, i) => { o[c] = f[i]; }); return o; });
}
function codigo_(h) {
  const usados = new Set(filas_(h).map((r) => r['Código']));
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = 'OC-'; for (let i = 0; i < 5; i++) c += abc[Math.floor(Math.random() * abc.length)]; } while (usados.has(c));
  return c;
}
// evita que un texto se interprete como fórmula
function txt_(v) { const s = String(v == null ? '' : v).slice(0, 120); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function fechaISO_(f) { return f instanceof Date ? f.toISOString() : String(f || ''); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
