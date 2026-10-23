// Oasis Cup · página principal
import { createVestuario } from './vestuario.js';

const C = window.OASIS, S = window.OasisStore;
const $ = (id) => document.getElementById(id);
const plata = (n) => '$' + Number(n).toLocaleString('es-AR');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const shirtSVG = (hex) => `<svg class="shirt" viewBox="0 0 32 32" aria-hidden="true"><path d="M11 4c1.2 2 8.8 2 10 0l6 2 4 7-4 3-2-2v15H7V14l-2 2-4-3 4-7z" fill="${hex}" stroke="rgba(244,241,232,.55)" stroke-width="1.2"/></svg>`;

if (S.demo) $('demo-ribbon').hidden = false;
['p-sena', 'precio-sena'].forEach((id) => { $(id).textContent = plata(C.PRECIO_SENA); });
['p-total', 'precio-total'].forEach((id) => { $(id).textContent = plata(C.PRECIO_TOTAL); });
$('pl-precio').textContent = plata(C.PRECIO_TOTAL) + ' por equipo';
$('mapa').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(C.SEDE_MAPA);
$('faq-cierre').textContent = 'Te podés inscribir hasta completar el cupo de cada categoría (masculino de 8 a 12 equipos, femenino hasta 6).';
const eligen = Date.now() < new Date(C.ELECCION_HASTA).getTime();
$('faq-eleccion').textContent = `Hasta el ${C.ELECCION_TEXTO} elegís el color de la camiseta y el talle de cada jugador. Si te inscribís después, te asignamos un color libre y las camisetas van con talles genéricos variados, de ${C.TALLES_GENERICOS}.`;
$('plazo').innerHTML = eligen ? `Color y talles se eligen hasta el <b>${C.ELECCION_TEXTO}</b>. Después, color asignado y talles genéricos de ${C.TALLES_GENERICOS}.` : `Ya cerró la elección: los equipos nuevos van con color asignado y talles genéricos de ${C.TALLES_GENERICOS}.`;
document.querySelectorAll('.js-eleccion').forEach((e) => { e.textContent = C.ELECCION_TEXTO; });

/* Cuenta regresiva */
function contar() {
  const ms = new Date(C.INICIO).getTime() - Date.now();
  if (ms <= 0) { $('count').innerHTML = '<span>Estado</span><b>¡Se juega!</b>'; return; }
  const m = Math.floor(ms / 60000);
  $('c-d').textContent = Math.floor(m / 1440); $('c-h').textContent = Math.floor(m / 60) % 24; $('c-m').textContent = m % 60;
}
contar(); setInterval(contar, 30000);

/* Vestuario */
let cat = 'masculino', estado = null;
const vest = createVestuario($('vest'), {
  mode: 'view',
  onCambio: ({ libres, total }) => { $('libres').textContent = `${libres} de ${total} colores disponibles`; },
  onPick: (color, info) => {
    if (info.arquero) { $('vest-msg').textContent = 'Arqueros: todos usan la misma camiseta, de un color distinto a los equipos. El color lo confirmamos antes del torneo.'; return; }
    if (info.tomado) { $('vest-msg').textContent = `${info.color.n}: ya la eligió ${info.por}.`; return; }
    if (color) {
      $('vest-msg').innerHTML = `<b>${esc(color.n)}</b> está libre en ${cat}. <a href="inscripcion.html?cat=${cat}&color=${color.id}">Reservala para tu equipo</a>`;
    }
  }
});
if (!vest) {
  // sin WebGL: lista simple de colores
  const fb = $('vest-fallback'); fb.hidden = false;
  window.__pintarFallback = () => {
    const tom = (estado && estado.tomados[cat]) || {};
    fb.innerHTML = C.COLORES.map((c) => `<button ${tom[c.id] ? 'disabled' : ''} onclick="location.href='inscripcion.html?cat=${cat}&color=${c.id}'"><i style="background:${c.hex}"></i><b>${c.n}</b><small>${tom[c.id] ? 'Elegida' : 'Disponible'}</small></button>`).join('');
    $('libres').textContent = `${C.COLORES.filter((c) => !tom[c.id]).length} de ${C.COLORES.length} colores disponibles`;
  };
  window.__pintarFallback();
}
document.querySelectorAll('.vest__bar .round').forEach((b) => b.addEventListener('click', () => vest && vest.mover(+b.dataset.dir)));
function tabs(id, fn) {
  const el = $(id);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    el.querySelectorAll('button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    fn(b.dataset.c);
  });
}
tabs('cat-tabs', (c) => { cat = c; vest ? vest.setCategoria(c) : window.__pintarFallback(); $('vest-msg').textContent = 'Los arqueros de todos los equipos usan la misma camiseta, para distinguirlos bien.'; });

/* Equipos confirmados y fixture */
let torCat = 'masculino';
tabs('tor-tabs', (c) => { torCat = c; pintarTorneo(); });
const colorHex = (id, hex) => (C.COLORES.find((c) => c.id === id) || {}).hex || hex || '#888';
function pintarTorneo() {
  if (!estado) return;
  const conf = estado.confirmados[torCat] || [];
  const n = estado.inscriptos[torCat] || 0, cupo = C.CUPO[torCat];
  $('cupo-txt').textContent = `${C.CUPO_TEXTO[torCat]}. ` + (cupo ? (n >= cupo ? 'Cupo completo.' : `${n} de ${cupo} lugares tomados.`) : '');
  $('equipos').innerHTML = conf.length
    ? conf.map((e) => `<li>${shirtSVG(colorHex(e.color, e.hex))}<b>${esc(e.equipo)}</b><small>Confirmado</small></li>`).join('')
    : '<li class="vacio">Todavía no hay equipos confirmados. ¡El tuyo puede ser el primero!</li>';
  const fx = (estado.fixture || []).filter((p) => (p.categoria || '').toLowerCase().startsWith(torCat.slice(0, 3)));
  if (!fx.length) {
    $('fixture').innerHTML = '<div class="pronto"><b>Próximamente</b><p>Al cerrar las inscripciones publicamos los grupos, los horarios de cada partido y, durante el torneo, los resultados en vivo.</p></div>';
    return;
  }
  let html = '', dia = '';
  fx.forEach((p) => {
    if (p.dia !== dia) { html += `<p class="fx-day">${esc(p.dia)}</p>`; dia = p.dia; }
    const jugado = p.golesA !== '' && p.golesA != null;
    html += `<div class="fx"><time>${esc(p.hora)}</time><b class="a">${esc(p.equipoA)}</b><span class="sc">${jugado ? esc(p.golesA) + ' - ' + esc(p.golesB) : 'vs'}</span><b>${esc(p.equipoB)}</b>${p.fase || p.cancha ? `<small>${esc([p.fase, p.cancha].filter(Boolean).join(', '))}</small>` : ''}</div>`;
  });
  $('fixture').innerHTML = html;
}
function cargar() {
  S.estado().then((e) => {
    estado = e;
    if (vest) vest.setTomados(e.tomados); else window.__pintarFallback();
    pintarTorneo();
    $('cierre-libres').textContent = C.COLORES.filter((c) => !e.tomados.masculino[c.id]).length;
    $('cierre-libres-f').textContent = C.COLORES.filter((c) => !e.tomados.femenino[c.id]).length;
  }).catch(() => { $('equipos').innerHTML = '<li class="vacio">No pudimos cargar los equipos. Probá recargar la página.</li>'; });
}
cargar(); setInterval(cargar, 60000);

/* Animaciones */
if (window.gsap && !reduce) {
  gsap.registerPlugin(ScrollTrigger);
  addEventListener('load', () => ScrollTrigger.refresh());
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from('.hero__photo img', { scale: 1.12, duration: 2.2, ease: 'power2.out' }, 0)
    .from('.hero__pre', { opacity: 0, x: -20, duration: .8 }, .1)
    .from('.hero__title span', { yPercent: 105, duration: 1.1, stagger: 0.1 }, 0.15)
    .from('.hero__x, .chips li, .hero__cta', { opacity: 0, y: 14, stagger: .06, duration: .7 }, .6)
    .from('.planilla__in > div', { opacity: 0, y: 12, stagger: .07, duration: .6 }, .8);
  gsap.to('.hero__photo img', { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.utils.toArray('.ping').forEach((p, i) => gsap.from(p, { scale: .5, rotation: i % 2 ? 14 : -14, opacity: 0, duration: 1, ease: 'back.out(1.8)', scrollTrigger: { trigger: p, start: 'top 92%', once: true } }));
  ScrollTrigger.batch('.pasos li, .kit li, .podio, .equipos li', { start: 'top 88%', once: true, onEnter: (els) => gsap.from(els, { y: 30, opacity: 0, duration: .8, stagger: .1, ease: 'expo.out' }) });
  gsap.utils.toArray('.h-big, .h-giant').forEach((h) => gsap.from(h, { y: 40, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 88%', once: true } }));
}
