// Oasis Cup · las camisetas
// Cada color es una foto real del vestuario, limpia, sobre una pared curva apenas marcada.
// Se desliza con el dedo o el mouse y se frena en cada camiseta. Al elegir una, avanza
// suave hacia el frente con el nombre de tu equipo estampado en la espalda.
import * as THREE from 'three';

const C = window.OASIS;
const FOTO = (id) => `assets/img/fotos/${id}.webp`;
const FW = 1200, FH = 896;
const PW = 1.9, PH = PW * FH / FW;
const RADIO = 7;                                    // radio de la pared curva
const PASO = (PW * 1.16) / RADIO;                     // ángulo entre fotos
const ESPALDA = { x: 862, y: 658, w: 290 };          // dónde va el nombre, en píxeles de la foto

const cargarImg = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const vert = `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const frag = `
  uniform sampler2D uMap, uMask; uniform float uDim, uGray, uLift, uTintOn, uAspect; uniform vec3 uTint;
  varying vec2 vUv;
  void main(){
    // esquinas apenas redondeadas
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
    vec2 q = abs(p) - vec2(uAspect * 0.5, 0.5) + 0.018;
    float d = length(max(q, 0.0)) - 0.018;
    if (d > 0.0) discard;
    vec3 c = texture2D(uMap, vUv).rgb;
    float m = texture2D(uMask, vUv).r * uTintOn;
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(c, uTint * min(1.08, 0.12 + lum * 1.05), m * smoothstep(0.1, 0.24, lum));
    float g = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(c, vec3(g), max(uGray, uDim * 0.9));
    c *= (1.0 - uDim * 0.55) * (0.96 + uLift * 0.04);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;

export function createVestuario(root, opts = {}) {
  const st = {
    mode: opts.mode || 'view', categoria: opts.categoria || 'masculino', tomados: opts.tomados || { masculino: {}, femenino: {} },
    equipo: opts.equipo || '', elegido: null, onPick: opts.onPick || (() => {}), onCambio: opts.onCambio || (() => {})
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return null; }
  if (!renderer.getContext()) return null;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.domElement.className = 'vest__canvas';
  root.appendChild(renderer.domElement);
  const labels = document.createElement('div'); labels.className = 'vest__labels'; root.appendChild(labels);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
  const tan = Math.tan(THREE.MathUtils.degToRad(14));

  /* ---------- texturas ---------- */
  const fuentes = Promise.all(document.fonts ? ['800 60px "Big Shoulders"', '900 60px "Big Shoulders"', '500 30px Archivo'].map((f) => document.fonts.load(f)) : []).catch(() => {});
  const mkCanvas = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return { cv, tex }; };
  const mascara = new THREE.TextureLoader().load('assets/img/fotos/mascara.webp');

  function pintar(it) {
    const { cv, tex } = it.copia; const x = cv.getContext('2d');
    x.fillStyle = '#1a1f1c'; x.fillRect(0, 0, FW, FH);
    if (it.img) x.drawImage(it.img, 0, 0, FW, FH);
    // el nombre del equipo en la espalda de la camiseta elegida
    if (st.equipo && !it.fija && st.elegido === it) {
      x.fillStyle = it.data.id === 'blanco' ? '#3E8DC6' : it.data.otro ? '#1B2433' : 'rgba(246,246,244,.95)';
      x.textAlign = 'center'; x.textBaseline = 'alphabetic';
      const t = st.equipo.toUpperCase();
      let s = 58; x.font = `900 ${s}px "Big Shoulders", sans-serif`;
      while (x.measureText(t).width > ESPALDA.w && s > 20) { s -= 2; x.font = `900 ${s}px "Big Shoulders", sans-serif`; }
      x.globalAlpha = 0.94; x.fillText(t, ESPALDA.x, ESPALDA.y); x.globalAlpha = 1;
    }
    // franja sobria para las reservadas y para la de arqueros
    const franja = it.fija ? ['Arqueros', 'Camiseta única para todos. Color a definir.'] : it.tomado ? ['Reservada', it.tomadoPor] : null;
    if (franja) {
      const h = 150, y = FH - h;
      x.fillStyle = 'rgba(9,18,13,.82)'; x.fillRect(0, y, FW, h);
      x.fillStyle = '#D6AC55'; x.fillRect(0, y, 8, h);
      x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.fillStyle = '#F7F7F2';
      x.font = '800 64px "Big Shoulders", sans-serif'; x.fillText(franja[0].toUpperCase(), 52, y + 72);
      x.font = '500 34px Archivo, sans-serif'; x.globalAlpha = 0.85;
      let t = franja[1]; while (x.measureText(t).width > FW - 110 && t.length > 4) t = t.slice(0, -2);
      x.fillText(t === franja[1] ? t : t + '…', 52, y + 120); x.globalAlpha = 1;
    }
    tex.needsUpdate = true;
  }

  /* ---------- fotos sobre la pared curva ---------- */
  const lista = C.COLORES.map((c) => ({ ...c })).concat([{ id: 'otro', n: 'Otro color', hex: '#E86A1A', otro: true }]);
  const geo = new THREE.PlaneGeometry(PW, PH);
  const items = [];
  function crear(data, idx, opciones = {}) {
    const copia = mkCanvas(FW, FH);
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, transparent: false,
      uniforms: { uMap: { value: copia.tex }, uMask: { value: mascara }, uDim: { value: 0 }, uGray: { value: opciones.fija ? 1 : 0 }, uLift: { value: 0 }, uTintOn: { value: data.otro ? 1 : 0 }, uTint: { value: new THREE.Color(data.hex || '#888') }, uAspect: { value: PW / PH } }
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    const it = { data, mesh, mat, copia, idx, fija: !!opciones.fija, f: 0, hover: 0 };
    mesh.userData.it = it;
    const lab = document.createElement('button'); lab.type = 'button'; lab.className = 'vest__label'; labels.appendChild(lab); it.lab = lab;
    lab.addEventListener('click', () => elegir(it));
    cargarImg(FOTO(data.otro || it.fija ? 'blanco' : data.id)).then((img) => { it.img = img; fuentes.then(() => pintar(it)); });
    items.push(it);
    return it;
  }
  crear({ id: 'arquero', n: 'Arqueros', hex: C.ARQUERO.hex }, 0, { fija: true });
  lista.forEach((c, i) => crear(c, i + 1));
  const MAX = items.length - 1;

  function estadoItems() {
    items.forEach((it) => {
      if (it.fija) return;
      const tom = it.data.id !== 'otro' && (st.tomados[st.categoria] || {})[it.data.id];
      const antes = it.tomadoPor;
      it.tomado = !!tom; it.tomadoPor = tom ? tom.equipo : '';
      if (antes !== it.tomadoPor && it.img) fuentes.then(() => pintar(it));
    });
    actualizarLabels(); st.onCambio(resumen());
  }
  function resumen() { const libres = C.COLORES.filter((c) => !(st.tomados[st.categoria] || {})[c.id]).length; return { libres, total: C.COLORES.length }; }
  estadoItems();

  /* ---------- cámara ---------- */
  let W = 1, H = 1, camZ = 6, avance = 0.6;
  function resize() {
    W = root.clientWidth; H = root.clientHeight;
    renderer.setSize(W, H, false); cam.aspect = W / H;
    const zAlto = (PH + 0.9) / (2 * tan), zAncho = (PW * 1.22) / cam.aspect / (2 * tan);
    camZ = Math.max(zAlto, zAncho);
    // la elegida avanza hasta ocupar cerca del 80% del alto (o del ancho, en el celular)
    const d = Math.max(PH / (0.78 * 2 * tan), PW / (0.92 * cam.aspect * 2 * tan));
    avance = clamp(camZ - d, 0, 2.5);
    cam.position.set(0, 0.12, camZ); cam.lookAt(0, 0.12, 0);
    root.style.setProperty('--foto-w', (W * PW / (2 * tan * camZ * cam.aspect)).toFixed(0) + 'px');
    cam.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(root); resize();

  /* ---------- deslizar y frenar en cada foto ---------- */
  let pos = 1, vel = 0, target = 1, dragging = false, lastX = 0, moved = 0, lastT = 0;
  const el = renderer.domElement;
  el.style.touchAction = 'pan-y';
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let hovered = null;
  function pick(e) {
    const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObjects(items.map((i) => i.mesh))[0];
    return hit ? hit.object.userData.it : null;
  }
  const pxPorFoto = () => (W / (2 * tan * camZ * cam.aspect)) * PW * 1.16;
  el.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastT = performance.now(); moved = 0; vel = 0; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) { hovered = pick(e); el.style.cursor = hovered && !hovered.fija && !hovered.tomado ? 'pointer' : 'grab'; return; }
    const now = performance.now(), dx = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(dx);
    const d = -dx / pxPorFoto(); pos = clamp(pos + d, -0.3, MAX + 0.3);
    vel = d / Math.max(1, now - lastT) * 16; lastT = now;
    if (moved > 6 && st.elegido) { soltar(); st.onPick(null, {}); }
  });
  el.addEventListener('pointerup', (e) => {
    dragging = false;
    if (moved < 6) { const it = pick(e); if (it) elegir(it); else if (st.elegido) { soltar(); st.onPick(null, {}); } return; }
    target = clamp(Math.round(pos + vel * 6), 0, MAX);    // frena en la foto más cercana
  });
  el.addEventListener('pointercancel', () => { dragging = false; target = clamp(Math.round(pos), 0, MAX); });
  el.addEventListener('pointerleave', () => { hovered = null; });

  function elegir(it) {
    target = it.idx;
    if (it.fija) { st.onPick(null, { arquero: true }); return; }
    if (it.tomado) { st.onPick(null, { tomado: true, por: it.tomadoPor, color: it.data }); return; }
    if (st.elegido === it) { soltar(); st.onPick(null, {}); return; }
    const antes = st.elegido; st.elegido = it;
    if (antes) pintar(antes);
    pintar(it);
    st.onPick(it.data, st.mode === 'pick' ? {} : { vista: true });
    actualizarLabels();
  }
  function soltar() { const a = st.elegido; st.elegido = null; if (a) pintar(a); actualizarLabels(); }

  function actualizarLabels() {
    items.forEach((it) => {
      const d = it.data;
      it.lab.className = 'vest__label' + (it.tomado ? ' is-taken' : '') + (it.fija ? ' is-fixed' : '') + (st.elegido === it ? ' is-on' : '');
      it.lab.setAttribute('aria-disabled', String(!!it.tomado));
      const estado = it.fija ? 'Color a definir' : it.tomado ? 'Reservada' : d.id === 'otro' ? 'Elegí el tono' : 'Libre';
      const sw = it.fija ? '<i class="sw-def"></i>' : `<i style="background:${d.hex}"></i>`;
      it.lab.innerHTML = `${sw}<b>${d.n}</b><small>${estado}</small>`;
      it.lab.setAttribute('aria-label', d.n + (it.tomado ? ', reservada por ' + it.tomadoPor : it.fija ? ', camiseta única de arqueros, color a definir' : ', libre'));
    });
  }

  /* ---------- animación ---------- */
  const clock = new THREE.Clock(), v = new THREE.Vector3();
  const prevBtn = root.querySelector('.flecha--prev'), nextBtn = root.querySelector('.flecha--next');
  let lastTi = -1;
  let visible = true;
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(root);
  function loop() {
    requestAnimationFrame(loop);
    if (!visible) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!dragging) pos += (target - pos) * (reduce ? 1 : Math.min(1, dt * 5));
    const ti = Math.round(dragging ? pos : target);
    if (ti !== lastTi) { lastTi = ti; prevBtn && (prevBtn.disabled = ti <= 0); nextBtn && (nextBtn.disabled = ti >= MAX); }
    items.forEach((it) => {
      const sel = st.elegido === it;
      it.f += ((sel ? 1 : 0) - it.f) * (reduce ? 1 : Math.min(1, dt * 4));
      it.hover += ((hovered === it && !it.tomado && !it.fija && !sel ? 1 : 0) - it.hover) * Math.min(1, dt * 8);
      const e = it.f * it.f * (3 - 2 * it.f);
      // posición sobre el arco: las de los costados se alejan y miran hacia el centro
      const dist = Math.abs(it.idx - pos);
      it.mesh.visible = dist < 3.2 || e > 0.01;   // las que quedan muy al costado no se dibujan
      const a = (it.idx - pos) * PASO;
      const x = Math.sin(a) * RADIO, z = -(1 - Math.cos(a)) * RADIO;
      it.mesh.position.set(x * (1 - e), 0.12 * e, z * (1 - e) + it.hover * 0.06 + e * avance);
      it.mesh.rotation.set(0, -a * (1 - e), 0);
      const u = it.mat.uniforms;
      u.uLift.value = it.hover + e;
      const lejos = clamp(Math.abs(it.idx - pos) - 0.3, 0, 2) * 0.3;
      u.uDim.value += ((st.elegido && !sel ? 0.75 : (it.tomado ? 0.7 : 0) + lejos) - u.uDim.value) * Math.min(1, dt * 6);
      // etiqueta HTML debajo de cada foto
      v.set(x, -PH / 2 - 0.1, z); v.project(cam);
      it.lab.style.transform = `translate(${(v.x * 0.5 + 0.5) * W}px, ${(-v.y * 0.5 + 0.5) * H}px) translate(-50%, 0)`;
      const oculta = !it.mesh.visible || Math.abs(v.x) > 1.02 || !!st.elegido;
      it.lab.style.opacity = oculta ? 0 : Math.max(0.35, 1 - Math.abs(it.idx - pos) * 0.25);
      it.lab.style.pointerEvents = oculta ? 'none' : '';
    });
    renderer.render(scene, cam);
  }
  loop();

  return {
    setCategoria(c) { st.categoria = c; if (st.elegido && (st.tomados[c] || {})[st.elegido.data.id]) soltar(); estadoItems(); },
    setTomados(tm) { st.tomados = tm; if (st.elegido && (tm[st.categoria] || {})[st.elegido.data.id]) soltar(); estadoItems(); },
    setEquipo(n) { st.equipo = n; if (st.elegido) pintar(st.elegido); },
    setOtro(hex) { const it = items.find((i) => i.data.id === 'otro'); it.data.hex = hex; it.mat.uniforms.uTint.value.set(hex); actualizarLabels(); },
    elegir(id) { const it = items.find((i) => i.data.id === id); if (it && st.elegido !== it) elegir(it); },
    soltar,
    mover(dir) { if (st.elegido) { soltar(); st.onPick(null, {}); } target = clamp(Math.round(target) + dir, 0, MAX); },
    resumen
  };
}
