// Oasis Cup · inscripción en 4 pasos
import { createVestuario } from './vestuario.js';

const C = window.OASIS, S = window.OasisStore;
const $ = (id) => document.getElementById(id);
const form = $('form'), F = form.elements;
const plata = (n) => '$' + Number(n).toLocaleString('es-AR');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const shirtSVG = (hex) => `<svg class="shirt" viewBox="0 0 32 32" aria-hidden="true"><path d="M11 4c1.2 2 8.8 2 10 0l6 2 4 7-4 3-2-2v15H7V14l-2 2-4-3 4-7z" fill="${hex}" stroke="rgba(15,29,23,.35)" stroke-width="1.2"/></svg>`;
let toastT;
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('is-on'), 3800); }
if (S.demo) $('demo-ribbon').hidden = false;

const q = new URLSearchParams(location.search);
let estado = { tomados: { masculino: {}, femenino: {} }, inscriptos: { masculino: 0, femenino: 0 } };
let color = null;          // {id, n, hex}
// hasta ELECCION_HASTA se eligen color y talles; después se asignan (?simular=despues para probarlo)
const eligen = Date.now() < new Date(C.ELECCION_HASTA).getTime() && q.get('simular') !== 'despues';
const ASIGNADA = { id: 'asignar', n: 'Color a asignar', hex: '#8A8F86' };
$('plazo').innerHTML = eligen
  ? `Color y talles se eligen hasta el <b>${C.ELECCION_TEXTO}</b>. Después, la camiseta va con color asignado y talles genéricos de ${C.TALLES_GENERICOS}.`
  : `Ya pasó el ${C.ELECCION_TEXTO}: la camiseta va con color asignado por la organización y talles genéricos de ${C.TALLES_GENERICOS}.`;
document.querySelectorAll('.js-genericos').forEach((e) => { e.textContent = C.TALLES_GENERICOS; });
const cat = () => form.querySelector('input[name=categoria]:checked').value;
if (q.get('cat') === 'femenino') form.querySelector('input[value=femenino]').checked = true;

/* ---------- Paso 2: plantel ---------- */
const filas = [];
let html = '<div class="pl-head"><span></span><span>Nombre y apellido</span><span>DNI</span><span>Talle</span><span>N°</span><span>Arquero</span></div>';
for (let i = 1; i <= C.JUGADORES_MAX; i++) {
  if (i === C.JUGADORES_MIN + 1) html += '<p class="pl-sep">Suplentes (opcional)</p>';
  html += `<div class="pl${i > C.JUGADORES_MIN ? ' pl--sup' : ''}" data-i="${i}">
    <span class="pl__n">${i}</span>
    <input class="i-nom" name="j${i}-nombre" placeholder="Nombre y apellido" aria-label="Jugador ${i}: nombre y apellido" autocomplete="off">
    <input class="i-dni" name="j${i}-dni" inputmode="numeric" placeholder="DNI" aria-label="Jugador ${i}: DNI" autocomplete="off">
    <select class="i-talle" name="j${i}-talle" aria-label="Jugador ${i}: talle"><option value="">Talle</option>${C.TALLES.map((t) => `<option>${t}</option>`).join('')}</select>
    <input class="i-num" name="j${i}-numero" inputmode="numeric" maxlength="2" placeholder="N°" aria-label="Jugador ${i}: número">
    <label class="pl__gk"><input type="radio" name="arquero" value="${i}"${i === 1 ? ' checked' : ''}> Arquero</label>
  </div>`;
}
$('plantel').innerHTML = html;
if (!eligen) { $('plantel').classList.add('sin-talle'); $('plantel').querySelectorAll('.i-talle').forEach((s) => { s.disabled = true; }); }
function jugadores() {
  const out = [];
  for (let i = 1; i <= C.JUGADORES_MAX; i++) {
    const nom = F[`j${i}-nombre`].value.trim();
    if (!nom && i > C.JUGADORES_MIN) continue;
    out.push({ n: i, nombre: nom, dni: F[`j${i}-dni`].value.replace(/\D/g, ''), talle: eligen ? F[`j${i}-talle`].value : 'Genérico', numero: F[`j${i}-numero`].value.replace(/\D/g, ''), arquero: form.querySelector('input[name=arquero]:checked').value === String(i) });
  }
  return out;
}
function cuenta() {
  const n = jugadores().filter((j) => j.nombre).length;
  $('cuenta').textContent = `${n} de ${C.JUGADORES_MAX} jugadores cargados` + (n < C.JUGADORES_MIN ? `. Faltan ${C.JUGADORES_MIN - n} titulares.` : '.');
}
$('plantel').addEventListener('input', cuenta); cuenta();

/* ---------- validación ---------- */
function marcar(el, msg) {
  let e = el.parentElement.querySelector(':scope > .err');
  if (el.closest('.pl')) { el.setAttribute('aria-invalid', msg ? 'true' : 'false'); el.title = msg || ''; return !msg; }
  if (!e) { e = document.createElement('span'); e.className = 'err'; el.insertAdjacentElement('afterend', e); }
  e.textContent = msg || ''; el.setAttribute('aria-invalid', msg ? 'true' : 'false'); return !msg;
}
function validar(n) {
  let ok = true;
  if (n === 1) {
    if (lleno(cat())) { toast(`El cupo ${cat()} está completo.`); ok = false; }
    ok = marcar(F.equipo, F.equipo.value.trim().length < 2 ? 'Poné el nombre del equipo.' : '') && ok;
    ok = marcar(F.capitan, F.capitan.value.trim().length < 3 ? 'Poné nombre y apellido.' : '') && ok;
    ok = marcar(F.telefono, F.telefono.value.replace(/\D/g, '').length < 8 ? 'Poné un WhatsApp con característica.' : '') && ok;
  }
  if (n === 2) {
    const numeros = {};
    for (let i = 1; i <= C.JUGADORES_MAX; i++) {
      const nom = F[`j${i}-nombre`], dni = F[`j${i}-dni`], ta = F[`j${i}-talle`], nu = F[`j${i}-numero`];
      const usado = nom.value.trim() || i <= C.JUGADORES_MIN;
      if (!usado) { [nom, dni, ta, nu].forEach((x) => marcar(x, '')); continue; }
      ok = marcar(nom, nom.value.trim().split(/\s+/).length < 2 ? 'Nombre y apellido' : '') && ok;
      ok = marcar(dni, !/^\d{7,8}$/.test(dni.value.replace(/\D/g, '')) ? 'DNI de 7 u 8 números' : '') && ok;
      if (eligen) ok = marcar(ta, !ta.value ? 'Elegí el talle' : '') && ok;
      const num = nu.value.replace(/\D/g, '');
      ok = marcar(nu, num && numeros[num] ? 'Número repetido' : '') && ok;
      if (num) numeros[num] = true;
    }
    const gk = +form.querySelector('input[name=arquero]:checked').value;
    if (!F[`j${gk}-nombre`].value.trim()) { toast('El arquero marcado no tiene nombre.'); ok = false; }
    if (!ok) toast('Revisá los datos marcados en rojo.');
  }
  if (n === 3 && !color) { toast('Elegí un color de camiseta.'); ok = false; }
  if (!ok) { const f = form.querySelector('.paso:not([hidden]) [aria-invalid="true"]'); if (f) f.focus(); }
  return ok;
}

/* ---------- pasos ---------- */
let paso = 1;
function ir(n) {
  if (n > paso) for (let i = paso; i < n; i++) if (!validar(i)) return;
  paso = n;
  form.querySelectorAll('.paso').forEach((s) => { s.hidden = +s.dataset.step !== n; });
  $('stepper').querySelectorAll('li').forEach((li) => { const s = +li.dataset.s; li.classList.toggle('is-on', s === n); li.classList.toggle('is-done', s < n); });
  if (n === 3) { vest && vest.setEquipo(F.equipo.value.trim(), numeroCamiseta()); }
  if (n === 4) resumen();
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  if (window.gsap && !reduce) gsap.from(`.paso[data-step="${n}"] > *, .paso[data-step="${n}"] .wrap > *`, { y: 18, opacity: 0, duration: .6, stagger: .05, ease: 'expo.out' });
}
form.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) { e.preventDefault(); ir(+b.dataset.go); } });
function numeroCamiseta() { const c = jugadores().find((j) => !j.arquero && j.numero); return c ? c.numero : 10; }

/* ---------- categoría y cupo ---------- */
const lleno = (c) => C.CUPO[c] && (estado.inscriptos[c] || 0) >= C.CUPO[c];
function pintarCupo() {
  ['masculino', 'femenino'].forEach((c) => {
    const cupo = C.CUPO[c], n = estado.inscriptos[c] || 0, libres = C.COLORES.filter((x) => !(estado.tomados[c] || {})[x.id]).length;
    const radio = form.querySelector(`input[name=categoria][value=${c}]`);
    radio.disabled = !!lleno(c);
    $('cupo-' + c).textContent = lleno(c) ? 'Cupo completo' : `${C.CUPO_TEXTO[c]}. ` + (cupo ? `Quedan ${cupo - n} lugares` : '') + (eligen ? `, ${libres} colores libres.` : '.');
  });
  if (lleno(cat())) { const otra = cat() === 'masculino' ? 'femenino' : 'masculino'; if (!lleno(otra)) { form.querySelector(`input[value=${otra}]`).checked = true; vest && vest.setCategoria(otra); } }
}
form.addEventListener('change', (e) => {
  if (e.target.name === 'categoria') { vest ? vest.setCategoria(cat()) : pintarFallback(); if (color && color.id !== 'otro' && estado.tomados[cat()][color.id]) quitarColor('Ese color ya está elegido en esta categoría. Elegí otro.'); llenarAlternativo(); }
});

/* ---------- Paso 3: vestuario ---------- */
const vest = !eligen ? null : createVestuario($('vest'), {
  mode: 'pick', categoria: cat(), equipo: '',
  onPick: (c, info) => {
    if (info.arquero) { $('vest-msg').textContent = 'Arqueros: todos usan la misma camiseta, de un color distinto a los equipos. El color lo confirmamos antes del torneo.'; return; }
    if (info.tomado) { $('vest-msg').textContent = `${info.color.n}: ya la eligió ${info.por}.`; return; }
    if (!c) { quitarColor(); return; }
    ponerColor(c);
  }
});
function pintarFallback() {
  if (!eligen) return;
  const fb = $('vest-fallback'); fb.hidden = false;
  const tom = estado.tomados[cat()] || {};
  fb.innerHTML = C.COLORES.map((c) => `<button type="button" data-c="${c.id}" ${tom[c.id] ? 'disabled' : ''}><i style="background:${c.hex}"></i><b>${c.n}</b><small>${tom[c.id] ? 'Elegida' : 'Disponible'}</small></button>`).join('') +
    '<button type="button" data-c="otro"><i style="background:conic-gradient(#C47D71,#D9C9A0,#97B9A2,#7FA3D6,#C47D71)"></i><b>Otro color</b><small>Elegí el tono</small></button>';
}
if (!eligen) {
  color = { ...ASIGNADA };
  ['vest', 'eleccion'].forEach((id) => { $(id).hidden = true; });
  document.querySelectorAll('[data-step="3"] .vest__bar, [data-step="3"] .maqueta, [data-step="3"] .paso__lead').forEach((e) => { e.hidden = true; });
  $('asignada').hidden = false;
  document.querySelector('[data-step="3"] .paso__t').textContent = 'La camiseta';
} else if (!vest) { pintarFallback(); $('vest-fallback').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) ponerColor(b.dataset.c === 'otro' ? { id: 'otro', n: 'Otro color', hex: $('otro-color').value } : C.COLORES.find((c) => c.id === b.dataset.c)); }); }
document.querySelectorAll('.vest__bar .flecha').forEach((b) => b.addEventListener('click', () => vest && vest.mover(+b.dataset.dir)));

function ponerColor(c) {
  color = { ...c };
  if (c.id === 'otro') color.hex = $('otro-color').value;
  $('eleccion').hidden = false;
  $('el-swatch').style.background = color.hex;
  $('el-nombre').textContent = c.id === 'otro' ? 'Otro color' : c.n;
  $('otro-wrap').hidden = c.id !== 'otro';
  $('vest-msg').textContent = c.id === 'otro' ? 'Elegí el tono abajo. Lo confirmamos por Instagram según disponibilidad.' : `${c.n}: es tuya si confirmás la inscripción.`;
  llenarAlternativo();
}
function quitarColor(msg) { if (!eligen) return; color = null; $('eleccion').hidden = true; $('vest-msg').textContent = msg || 'Ningún color elegido todavía.'; if (vest) vest.soltar(); }
$('otro-color').addEventListener('input', (e) => { if (vest) vest.setOtro(e.target.value); if (color && color.id === 'otro') { color.hex = e.target.value; $('el-swatch').style.background = color.hex; } });
function llenarAlternativo() {
  const tom = estado.tomados[cat()] || {};
  $('alternativo').innerHTML = '<option value="">Sin segunda opción</option>' + C.COLORES.filter((c) => !tom[c.id] && (!color || c.id !== color.id)).map((c) => `<option value="${c.id}">${c.n}</option>`).join('');
}
F.equipo.addEventListener('input', () => vest && vest.setEquipo(F.equipo.value.trim(), numeroCamiseta()));

/* ---------- Paso 4: pago ---------- */
$('m-sena').textContent = plata(C.PRECIO_SENA); $('m-total').textContent = plata(C.PRECIO_TOTAL);
$('m-sena-txt').textContent = `Los otros ${plata(C.PRECIO_TOTAL - C.PRECIO_SENA)} hasta el ${C.SALDO_HASTA}`;
$('alias').textContent = C.ALIAS; $('titular').textContent = C.TITULAR;
$('aviso-reserva').textContent = `Al confirmar, la camiseta queda reservada ${C.RESERVA_HORAS} horas. Si en ese tiempo no recibimos el pago, el color se libera para otro equipo.`;
$('copy-alias').addEventListener('click', () => copiar(C.ALIAS, 'Alias copiado.'));
function monto() { return form.querySelector('input[name=pago]:checked').value === 'total' ? C.PRECIO_TOTAL : C.PRECIO_SENA; }
function resumen() {
  const js = jugadores(), gk = js.find((j) => j.arquero);
  $('resumen').innerHTML = `<div class="resumen__top">${shirtSVG(color.hex)}<div><b>${esc(F.equipo.value.trim())}</b><small>${cat() === 'masculino' ? 'Masculino' : 'Femenino'}</small></div></div>
    <dl><dt>Camiseta</dt><dd>${esc(color.id === 'otro' ? 'Otro color (' + color.hex + ')' : color.n)}</dd>
    <dt>Talles</dt><dd>${eligen ? 'Los que cargaste' : 'Genéricos de ' + C.TALLES_GENERICOS}</dd>
    <dt>Jugadores</dt><dd>${js.length} (${js.filter((j) => j.n <= C.JUGADORES_MIN).length} titulares)</dd>
    <dt>Arquero</dt><dd>${esc(gk ? gk.nombre : '')}, camiseta de arquero (${esc(C.ARQUERO.n.toLowerCase())})</dd>
    <dt>Capitán/a</dt><dd>${esc(F.capitan.value.trim())}, ${esc(F.telefono.value.trim())}</dd></dl>`;
}
function mensaje(cod) {
  const pago = monto() === C.PRECIO_TOTAL ? `el total (${plata(C.PRECIO_TOTAL)})` : `la mitad (${plata(C.PRECIO_SENA)}) y el resto hasta el ${C.SALDO_HASTA}`;
  return `¡Hola Oasis! Inscribimos a ${F.equipo.value.trim()} en la Oasis Cup ${cat() === 'masculino' ? 'masculina' : 'femenina'}.\n` +
    `Código: ${cod}\nCamiseta: ${color.id === 'otro' ? 'otro color (' + color.hex + ')' : color.id === 'asignar' ? 'color a asignar, talles genéricos' : color.n}\n` +
    `Quiero pagar ${pago}. Te paso el comprobante.\nCapitán/a: ${F.capitan.value.trim()} (${F.telefono.value.trim()})`;
}
function copiar(txt, ok) {
  const done = () => toast(ok);
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done));
  fallbackCopy(txt, done);
}
function fallbackCopy(txt, done) { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) {} t.remove(); }

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validar(1) || !validar(2) || !validar(3)) return;
  const btn = $('enviar'); btn.disabled = true; btn.textContent = 'Reservando tu camiseta…'; $('err').textContent = '';
  const datos = {
    categoria: cat(), equipo: F.equipo.value.trim(), capitan: F.capitan.value.trim(), telefono: F.telefono.value.trim(), instagram: F.instagram.value.trim(),
    color: color.id, colorNombre: color.id === 'otro' ? 'Otro color' : color.n, eligeTalles: eligen, hex: color.hex, alternativo: F.alternativo.value,
    pago: monto() === C.PRECIO_TOTAL ? 'Total' : 'Mitad', monto: monto(), jugadores: jugadores(), arqueroColor: C.ARQUERO.n
  };
  S.inscribir(datos).then((r) => {
    if (!r || !r.ok) {
      if (r && r.error === 'color_tomado') {
        estado.tomados[datos.categoria][datos.color] = { equipo: r.equipo || 'otro equipo' };
        if (vest) vest.setTomados(estado.tomados);
        quitarColor(`Uy, ${datos.colorNombre} la acaba de elegir ${r.equipo || 'otro equipo'}. Elegí otro color.`);
        ir(3); toast('Ese color se acaba de ocupar. Elegí otro.');
      } else if (r && r.error === 'cupo_completo') {
        estado.inscriptos[datos.categoria] = C.CUPO[datos.categoria]; pintarCupo();
        $('err').textContent = `Se completó el cupo ${datos.categoria} mientras te inscribías. Escribinos por Instagram y te anotamos en lista de espera.`;
      } else $('err').textContent = 'No pudimos guardar la inscripción. Revisá tu conexión y probá de nuevo.';
      return;
    }
    listo(r.codigo);
  }).catch(() => { $('err').textContent = 'No pudimos guardar la inscripción. Revisá tu conexión y probá de nuevo.'; })
    .finally(() => { btn.disabled = false; btn.textContent = 'Confirmar inscripción'; });
});

function listo(cod) {
  const msg = mensaje(cod);
  form.hidden = true; document.querySelector('.ins__head').hidden = true; $('listo').hidden = false;
  $('listo-equipo').textContent = F.equipo.value.trim();
  $('listo-codigo').textContent = cod;
  $('listo-monto').textContent = `${plata(monto())} a ${C.ALIAS}.`;
  $('listo-reserva').textContent = monto() === C.PRECIO_TOTAL ? `Cuando confirmamos el pago, tu equipo queda adentro. La camiseta queda reservada ${C.RESERVA_HORAS} horas mientras tanto.` : `Cuando confirmamos el pago, tu equipo queda adentro. El resto (${plata(C.PRECIO_TOTAL - C.PRECIO_SENA)}) lo pagás hasta el ${C.SALDO_HASTA}.`;
  $('msg-texto').textContent = msg;
  $('abrir-ig').href = 'https://ig.me/m/' + C.INSTAGRAM;
  $('abrir-ig').addEventListener('click', () => copiar(msg, 'Mensaje copiado: pegalo en el chat.'));
  $('copiar-msg').addEventListener('click', () => copiar(msg, 'Mensaje copiado.'));
  copiar(msg, 'Mensaje copiado: pegalo en el chat de Instagram.');
  window.scrollTo({ top: 0 });
  if (window.gsap && !reduce) gsap.from('#listo > *', { y: 24, opacity: 0, duration: .8, stagger: .07, ease: 'expo.out' });
}

/* ---------- datos ---------- */
function cargar() {
  S.estado().then((e) => {
    estado = e; pintarCupo(); llenarAlternativo();
    if (vest) vest.setTomados(e.tomados); else pintarFallback();
    if (eligen && color && color.id !== 'otro' && e.tomados[cat()][color.id]) quitarColor('Ese color se acaba de ocupar. Elegí otro.');
    const pre = q.get('color');
    if (eligen && pre && !color && !e.tomados[cat()][pre]) { const c = C.COLORES.find((x) => x.id === pre); if (c) { ponerColor(c); if (vest) vest.elegir(pre); } }
  }).catch(() => toast('No pudimos ver qué colores están libres. Probá recargar.'));
}
cargar(); setInterval(cargar, 45000);
