// Oasis Cup · página principal
import { createVestuario } from './vestuario.js';

const C = window.OASIS, S = window.OasisStore;
const $ = (id) => document.getElementById(id);
const plata = (n) => '$' + Number(n).toLocaleString('es-AR');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

$('pl-precio').textContent = plata(C.PRECIO_TOTAL) + ' por equipo';
$('precio-total').textContent = plata(C.PRECIO_TOTAL);
$('precio-sena').textContent = plata(C.PRECIO_SENA);
$('p-sena').textContent = plata(C.PRECIO_SENA);
$('p-total').textContent = plata(C.PRECIO_TOTAL - C.PRECIO_SENA);
$('precio-txt').textContent = `Mismo valor en masculino y femenino. Pagás la mitad al anotarte y el resto hasta el ${C.SALDO_HASTA}, un día antes del primer partido.`;
$('mapa').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(C.SEDE_MAPA);
$('faq-cierre').textContent = 'Hasta completar el cupo de cada categoría: masculino de 8 a 12 equipos, femenino hasta 6.';
const eligen = Date.now() < new Date(C.ELECCION_HASTA).getTime();
$('faq-eleccion').textContent = `Hasta el ${C.ELECCION_TEXTO} elegís el color de la camiseta y el talle de cada jugador. Si se inscriben después, les asignamos un color libre y las camisetas van con talles genéricos variados, de ${C.TALLES_GENERICOS}.`;
$('plazo').innerHTML = eligen
  ? `Color y talles se eligen hasta el <b>${C.ELECCION_TEXTO}</b>. Después, la camiseta va con color asignado y talles genéricos de ${C.TALLES_GENERICOS}.`
  : `Ya cerró la elección: los equipos nuevos van con color asignado y talles genéricos de ${C.TALLES_GENERICOS}.`;
document.querySelectorAll('.js-eleccion').forEach((e) => { e.textContent = C.ELECCION_TEXTO; });

/* Cuenta regresiva */
function contar() {
  const ms = new Date(C.INICIO).getTime() - Date.now();
  if (ms <= 0) { $('count').textContent = '¡Se juega!'; return; }
  const d = Math.ceil(ms / 86400000);
  $('count').innerHTML = d === 1 ? 'Mañana arranca' : `Faltan <span id="c-d">${d}</span> días`;
}
contar(); setInterval(contar, 60000);

/* Vestuario */
let cat = 'masculino', estado = null;
const vest = createVestuario($('vest'), {
  mode: 'view',
  onCambio: ({ libres, total }) => { $('libres').textContent = `${libres} de ${total} colores libres`; },
  onPick: (color, info) => {
    const m = $('vest-msg');
    if (info.arquero) { m.textContent = 'Arqueros: todos usan la misma camiseta, de un color distinto a los equipos. El color lo confirmamos antes del torneo.'; return; }
    if (info.tomado) { m.textContent = `${info.color.n}: ya la reservó ${info.por}.`; return; }
    if (!color) { m.textContent = 'Tocá una camiseta para verla de cerca.'; return; }
    m.innerHTML = color.id === 'otro'
      ? `¿Querés otro tono? <a href="inscripcion.html?cat=${cat}&color=otro">Elegilo en la inscripción</a>`
      : `<b>${esc(color.n)}</b> está libre en ${cat}. <a href="inscripcion.html?cat=${cat}&color=${color.id}">Reservarla para mi equipo</a>`;
  }
});
if (!vest) {
  const fb = $('vest-fallback'); fb.hidden = false;
  window.__pintarFallback = () => {
    const tom = (estado && estado.tomados[cat]) || {};
    fb.innerHTML = C.COLORES.map((c) => `<button ${tom[c.id] ? 'disabled' : ''} onclick="location.href='inscripcion.html?cat=${cat}&color=${c.id}'"><i style="background:${c.hex}"></i><b>${c.n}</b><small>${tom[c.id] ? 'Reservada' : 'Libre'}</small></button>`).join('');
    $('libres').textContent = `${C.COLORES.filter((c) => !tom[c.id]).length} de ${C.COLORES.length} colores libres`;
  };
  window.__pintarFallback();
}
document.querySelectorAll('#vest .flecha').forEach((b) => b.addEventListener('click', () => vest && vest.mover(+b.dataset.dir)));
const tabs = $('cat-tabs');
tabs.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  tabs.querySelectorAll('button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  cat = b.dataset.c; vest ? vest.setCategoria(cat) : window.__pintarFallback();
  $('vest-msg').textContent = 'Tocá una camiseta para verla de cerca.';
});

/* Partidos, horarios, resultados y posiciones: salen de la pestaña "Fixture web" */
let ptCat = 'masculino', ptDia = '7';
const diaNum = (d) => { const m = String(d || '').match(/\d+/); return m ? m[0] : ''; };
const esCat = (p, c) => (p.categoria || '').toLowerCase().startsWith(c.slice(0, 3));
const jugado = (p) => p.golesA !== '' && p.golesA != null && p.golesB !== '' && p.golesB != null;
function posiciones(fx) {
  const zonas = {};
  fx.filter((p) => /^zona/i.test(p.fase || '')).forEach((p) => {
    const z = (zonas[p.fase.trim()] = zonas[p.fase.trim()] || {});
    [p.equipoA, p.equipoB].forEach((e) => { if (e && !z[e]) z[e] = { e, pj: 0, g: 0, em: 0, p: 0, gf: 0, gc: 0, pts: 0 }; });
    if (!jugado(p) || !p.equipoA || !p.equipoB) return;
    const a = z[p.equipoA], b = z[p.equipoB], ga = +p.golesA, gb = +p.golesB;
    a.pj++; b.pj++; a.gf += ga; a.gc += gb; b.gf += gb; b.gc += ga;
    if (ga > gb) { a.g++; b.p++; a.pts += 3; } else if (ga < gb) { b.g++; a.p++; b.pts += 3; } else { a.em++; b.em++; a.pts++; b.pts++; }
  });
  return Object.keys(zonas).sort().map((n) => ({ n, filas: Object.values(zonas[n]).sort((x, y) => y.pts - x.pts || (y.gf - y.gc) - (x.gf - x.gc) || y.gf - x.gf || x.e.localeCompare(y.e)) }));
}
function pintarPartidos() {
  const fx = ((estado && estado.fixture) || []).filter((p) => esCat(p, ptCat));
  const lista = $('pt-lista'), tablas = $('pt-tablas');
  if (!fx.length) {
    lista.innerHTML = `<div class="pt-vacio"><b>El fixture sale al cerrar la inscripción</b><p>Cuando estén las zonas armadas, acá vas a ver los horarios de cada partido y, durante el torneo, los resultados y las posiciones al momento.</p></div>`;
    tablas.innerHTML = ''; return;
  }
  const delDia = fx.filter((p) => diaNum(p.dia) === ptDia).sort((x, y) => String(x.hora).localeCompare(String(y.hora)));
  lista.innerHTML = delDia.length ? delDia.map((p) => {
    const j = jugado(p), ga = +p.golesA, gb = +p.golesB;
    return `<div class="partido"><time>${esc(p.hora)}</time><span class="partido__eq a${j && ga > gb ? ' gana' : ''}">${esc(p.equipoA || 'A definir')}</span>` +
      `<span class="partido__sc${j ? '' : ' vs'}">${j ? esc(p.golesA) + ' - ' + esc(p.golesB) : 'vs'}</span>` +
      `<span class="partido__eq${j && gb > ga ? ' gana' : ''}">${esc(p.equipoB || 'A definir')}</span>` +
      (p.fase || p.cancha ? `<small>${esc([p.fase, p.cancha ? 'Cancha ' + p.cancha : ''].filter(Boolean).join(', '))}</small>` : '') + '</div>';
  }).join('') : '<div class="pt-vacio"><p>No hay partidos de esta categoría este día.</p></div>';
  const zs = posiciones(fx);
  tablas.innerHTML = zs.length ? zs.map((z) => `<div><h3>${esc(z.n)}</h3><table><thead><tr><th>Equipo</th><th title="Partidos jugados">PJ</th><th title="Ganados">G</th><th title="Empatados">E</th><th title="Perdidos">P</th><th title="Diferencia de gol">DG</th><th>Pts</th></tr></thead><tbody>` +
    z.filas.map((f, i) => `<tr class="${i < 2 ? 'pasa' : ''}"><td>${esc(f.e)}</td><td>${f.pj}</td><td>${f.g}</td><td>${f.em}</td><td>${f.p}</td><td>${f.gf - f.gc > 0 ? '+' : ''}${f.gf - f.gc}</td><td class="pts">${f.pts}</td></tr>`).join('') +
    '</tbody></table></div>').join('') + '<p class="nota">Los dos primeros de cada zona pasan a semifinales.</p>' : '';
}
function tabsDe(id, attr, fn) {
  const el = $(id);
  el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; el.querySelectorAll('button').forEach((x) => x.setAttribute('aria-selected', String(x === b))); fn(b.dataset[attr]); });
}
tabsDe('pt-cat', 'c', (c) => { ptCat = c; pintarPartidos(); });
tabsDe('pt-dias', 'd', (d) => { ptDia = d; pintarPartidos(); });
// durante el torneo arranca en el día de hoy
(() => { const h = new Date(); if (h.getFullYear() === 2027 && h.getMonth() === 0 && [7, 8, 9].includes(h.getDate())) { ptDia = String(h.getDate()); $('pt-dias').querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.d === ptDia))); } })();
pintarPartidos();

function cargar() {
  S.estado().then((e) => {
    estado = e;
    if (vest) vest.setTomados(e.tomados); else window.__pintarFallback();
    pintarPartidos();
    $('cierre-libres').textContent = C.COLORES.filter((c) => !e.tomados.masculino[c.id]).length;
    $('cierre-libres-f').textContent = C.COLORES.filter((c) => !e.tomados.femenino[c.id]).length;
  }).catch(() => {});
}
cargar(); setInterval(cargar, 60000);

/* La llave: líneas de tiza que unen zonas, semis y final */
const llave = $('llave'), svg = $('llave-svg');
function trazar() {
  const r = llave.getBoundingClientRect();
  if (getComputedStyle(svg).display === 'none') return;
  const box = (n) => { const b = llave.querySelector(`[data-n="${n}"]`).getBoundingClientRect(); return { l: b.left - r.left, r: b.right - r.left, y: b.top - r.top + b.height / 2 }; };
  const za = box('za'), zb = box('zb'), s1 = box('s1'), s2 = box('s2'), f = box('f');
  const codo = (a, b) => { const mx = (a.r + b.l) / 2; return `M${a.r} ${a.y}H${mx}V${b.y}H${b.l}`; };
  svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
  svg.innerHTML = [codo(za, s1), codo(zb, s1), codo(zb, s2), codo(za, s2), codo(s1, f), codo(s2, f)].map((d) => `<path d="${d}"/>`).join('');
}
trazar(); addEventListener('resize', trazar); document.fonts && document.fonts.ready.then(trazar);

/* Movimiento: una sola entrada de portada y la llave que se dibuja */
if (window.gsap && !reduce) {
  gsap.registerPlugin(ScrollTrigger);
  addEventListener('load', () => { trazar(); ScrollTrigger.refresh(); });
  gsap.timeline({ defaults: { ease: 'expo.out' } })
    .from('.hero__foto img', { scale: 1.08, duration: 2.4, ease: 'power2.out' }, 0)
    .from('.hero__pre, .hero__t, .hero__x', { y: 24, opacity: 0, duration: 1.2, stagger: .1 }, .15)
    .from('.hero__pie', { opacity: 0, duration: 1 }, .7);
  ScrollTrigger.create({
    trigger: llave, start: 'top 75%', once: true,
    onEnter: () => {
      trazar();
      const ps = svg.querySelectorAll('path');
      ps.forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
      gsap.timeline()
        .from('.llave .zona', { opacity: 0, x: -24, duration: .6, stagger: .1, ease: 'power3.out' })
        .to([...ps].slice(0, 4), { strokeDashoffset: 0, duration: .7, ease: 'power2.inOut' }, '-=.1')
        .from('.llave .cruce', { opacity: 0, scale: .94, duration: .5, stagger: .08, ease: 'back.out(2)' }, '-=.3')
        .to([...ps].slice(4), { strokeDashoffset: 0, duration: .6, ease: 'power2.inOut' })
        .from('.llave .final', { opacity: 0, scale: .9, duration: .6, ease: 'back.out(2.2)' }, '-=.2');
    }
  });
}
