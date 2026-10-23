// Oasis Cup · la soga de las camisetas
// Cada color es una foto real, impresa en papel y colgada con broches de una soga.
// La soga responde suave al mouse y al scroll. Al elegir una foto, se separa de la soga
// y viene al frente, sin giros, con el nombre de tu equipo estampado.
import * as THREE from 'three';

const C = window.OASIS;
const FOTO = (id) => `assets/img/fotos/${id}.webp`;
const FW = 1200, FH = 896, B = 22, BB = 64;           // foto, borde de papel y borde inferior con leyenda
const CW = FW + B * 2, CH = FH + B + BB;
const PW = 1.62, PH = PW * CH / CW;                   // copia en la escena
const A = PW * 0.36;                                   // distancia del centro a cada broche
const TOP = 1.62;                                      // altura de la soga
const ESPALDA = { x: 862, y: 658, w: 290 };            // dónde va el nombre, en píxeles de la foto

const cargarImg = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const suave = (t) => t * t * (3 - 2 * t);

/* ---------- Papel fotográfico: leve curva, brillo que corre con el ángulo ---------- */
const vert = `
  uniform float uTime, uWind, uSeed, uBillow;
  varying vec2 vUv; varying float vShade;
  void main(){
    vUv = uv;
    float hang = 1.0 - uv.y;
    float t = uTime * 1.3 + uSeed * 6.283;
    float curl = (uv.x - 0.5) * (uv.x - 0.5) * -0.06;
    float wave = sin(uv.x * 3.0 + t) * 0.016 * hang * uWind;
    float z = curl + wave + uBillow * hang * hang * 0.14;
    vShade = cos(uv.x * 3.0 + t) * 0.045 * hang * uWind - uBillow * hang * 0.05;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position + vec3(0.0, 0.0, z), 1.0);
  }`;
const frag = `
  uniform sampler2D uMap, uMask; uniform float uDim, uGray, uHover, uTintOn, uSheen; uniform vec3 uTint;
  varying vec2 vUv; varying float vShade;
  void main(){
    if (!gl_FrontFacing) {
      gl_FragColor = vec4(vec3(0.86, 0.85, 0.81) * (1.0 - uDim * 0.4) * (0.94 + vUv.y * 0.06), 1.0);
      #include <colorspace_fragment>
      return;
    }
    vec3 c = texture2D(uMap, vUv).rgb;
    float m = texture2D(uMask, vUv).r * uTintOn;
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(c, uTint * min(1.08, 0.12 + lum * 1.05), m * smoothstep(0.1, 0.24, lum));
    c *= 1.0 + vShade + uHover * 0.03;
    float g = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(c, vec3(g), max(uGray, uDim));
    c *= 1.0 - uDim * 0.42;
    // brillo del papel: una franja que se mueve según hacia dónde mira la foto
    float d = vUv.x * 0.85 + vUv.y * 0.55 - uSheen;
    c += exp(-d * d * 38.0) * 0.13 * (1.0 - uDim);
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
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const tan = Math.tan(THREE.MathUtils.degToRad(15));

  /* ---------- la soga ---------- */
  const SP = PW + 0.42;
  const lista = C.COLORES.map((c) => ({ ...c })).concat([{ id: 'otro', n: 'Otro color', hex: '#E86A1A', otro: true }]);
  const rack = new THREE.Group(); scene.add(rack);
  const X0 = -SP - PW / 2 - 0.5, X1 = (lista.length - 1) * SP + PW / 2 + 0.5;
  const DX = 0.08, N = Math.ceil((X1 - X0) / DX) + 1;
  const ry = new Float32Array(N), rv = new Float32Array(N);           // desplazamiento y velocidad de cada punto
  const ropeGeo = new THREE.BufferGeometry(), ropePos = new Float32Array(N * 2 * 3), idx = [];
  for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  ropeGeo.setIndex(idx); ropeGeo.setAttribute('position', new THREE.BufferAttribute(ropePos, 3));
  const rope = new THREE.Mesh(ropeGeo, new THREE.MeshBasicMaterial({ color: 0xF4F1E8 })); rope.frustumCulled = false; rack.add(rope);
  const blanco = new THREE.MeshBasicMaterial({ color: 0xF4F4EE });
  [X0, X1].forEach((x) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 4, 12), blanco); p.position.set(x, TOP - 2, -0.02); rack.add(p); });
  const ropeY = (x) => { const f = clamp((x - X0) / DX, 0, N - 1.001), i = Math.floor(f), t = f - i; return ry[i] * (1 - t) + ry[i + 1] * t; };
  function pulsar(x, v, ancho = 4) {
    const c = Math.round((x - X0) / DX);
    for (let k = -ancho; k <= ancho; k++) { const i = c + k; if (i > 0 && i < N - 1) rv[i] += v * Math.cos((k / ancho) * Math.PI / 2); }
  }
  function soga(dt) {
    const pasos = Math.ceil(dt / (1 / 240)), h = dt / pasos, c2 = 26 / (DX * DX);
    for (let s = 0; s < pasos; s++) {
      for (let i = 1; i < N - 1; i++) rv[i] += (c2 * (ry[i + 1] - 2 * ry[i] + ry[i - 1]) * DX * DX / (DX * DX) - 3.4 * rv[i] - 3 * ry[i]) * h;
      for (let i = 1; i < N - 1; i++) { ry[i] += rv[i] * h; ry[i] = clamp(ry[i], -0.5, 0.5); }
    }
    for (let i = 0; i < N; i++) {
      const x = X0 + i * DX, y = TOP + ry[i], o = i * 6;
      ropePos[o] = x; ropePos[o + 1] = y + 0.009; ropePos[o + 2] = 0.004;
      ropePos[o + 3] = x; ropePos[o + 4] = y - 0.009; ropePos[o + 5] = 0.004;
    }
    ropeGeo.attributes.position.needsUpdate = true;
  }

  /* ---------- texturas ---------- */
  const fuentes = Promise.all(document.fonts ? ['900 60px "Big Shoulders"', '800 40px "Big Shoulders"', '700 30px Archivo', '500 30px Archivo'].map((f) => document.fonts.load(f)) : []).catch(() => {});
  const mkCanvas = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return { cv, tex }; };
  const mascaraCv = mkCanvas(CW, CH); mascaraCv.tex.colorSpace = THREE.NoColorSpace;
  cargarImg('assets/img/fotos/mascara.webp').then((m) => { if (!m) return; const x = mascaraCv.cv.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, CW, CH); x.drawImage(m, B, B, FW, FH); mascaraCv.tex.needsUpdate = true; });
  // sombra suave detrás de cada copia
  const sombraTex = (() => { const { cv, tex } = mkCanvas(256, 200); const x = cv.getContext('2d'); x.filter = 'blur(14px)'; x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(34, 30, 188, 140); tex.needsUpdate = true; return tex; })();

  function revelar(it) {
    const { cv, tex } = it.copia; const x = cv.getContext('2d');
    x.fillStyle = '#F6F4EE'; x.fillRect(0, 0, CW, CH);
    if (it.img) x.drawImage(it.img, B, B, FW, FH);
    // leyenda impresa en el borde, como en las copias de laboratorio
    x.fillStyle = 'rgba(30,34,30,.6)'; x.textBaseline = 'middle'; x.font = '500 27px Archivo, sans-serif';
    x.textAlign = 'left'; x.fillText('Maqueta de referencia: el diseño final puede variar', B + 4, FH + B + BB / 2);
    x.textAlign = 'right'; x.font = '700 27px Archivo, sans-serif';
    x.fillText(it.fija ? 'Arqueros, color a definir' : it.data.otro ? 'Otro color, a pedido' : it.data.n, CW - B - 4, FH + B + BB / 2);
    if (st.equipo && !it.fija && st.elegido === it) {
      x.save(); x.translate(B, B);
      x.fillStyle = it.data.id === 'blanco' ? '#3E8DC6' : it.data.otro ? '#1B2433' : 'rgba(246,246,244,.95)';
      x.textAlign = 'center'; x.textBaseline = 'alphabetic';
      const t = st.equipo.toUpperCase();
      let s = 58; x.font = `900 ${s}px "Big Shoulders", sans-serif`;
      while (x.measureText(t).width > ESPALDA.w && s > 20) { s -= 2; x.font = `900 ${s}px "Big Shoulders", sans-serif`; }
      x.globalAlpha = 0.94; x.fillText(t, ESPALDA.x, ESPALDA.y);
      x.restore();
    }
    tex.needsUpdate = true;
  }

  // etiqueta de cartón colgada del broche
  const TGW = 512, TGH = 780;
  function etiqueta(it, titulo, arriba, quien, texto, pie) {
    const { cv, tex } = it.tag; const x = cv.getContext('2d');
    x.clearRect(0, 0, TGW, TGH);
    const corte = 74;
    x.save();
    x.beginPath(); x.moveTo(corte, 0); x.lineTo(TGW - corte, 0); x.lineTo(TGW, corte); x.lineTo(TGW, TGH - 14); x.quadraticCurveTo(TGW, TGH, TGW - 14, TGH); x.lineTo(14, TGH); x.quadraticCurveTo(0, TGH, 0, TGH - 14); x.lineTo(0, corte); x.closePath();
    const g = x.createLinearGradient(0, 0, TGW, TGH); g.addColorStop(0, '#D6BF90'); g.addColorStop(1, '#C4A973');
    x.fillStyle = g; x.fill(); x.clip();
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) { x.fillStyle = rnd() > 0.5 ? 'rgba(80,58,25,.10)' : 'rgba(255,245,220,.12)'; x.fillRect(rnd() * TGW, rnd() * TGH, 1 + rnd() * 5, 1); }
    x.restore();
    x.fillStyle = '#7D6A45'; x.beginPath(); x.arc(TGW / 2, 66, 30, 0, 7); x.fill();
    x.fillStyle = '#A8925F'; x.beginPath(); x.arc(TGW / 2, 66, 25, 0, 7); x.fill();
    x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(TGW / 2, 66, 15, 0, 7); x.fill(); x.globalCompositeOperation = 'source-over';
    x.textAlign = 'center'; x.fillStyle = '#231B10';
    x.font = '500 30px Archivo, sans-serif'; x.fillText(arriba, TGW / 2, 150);
    let s = 150; x.font = `900 ${s}px "Big Shoulders", sans-serif`;
    while (x.measureText(titulo).width > TGW - 60 && s > 50) { s -= 4; x.font = `900 ${s}px "Big Shoulders", sans-serif`; }
    x.fillText(titulo, TGW / 2, 286);
    x.fillRect(48, 314, TGW - 96, 4);
    x.globalAlpha = 0.75; x.font = '500 30px Archivo, sans-serif'; x.fillText(quien, TGW / 2, 366); x.globalAlpha = 1;
    const palabras = String(texto || '').toUpperCase().split(/\s+/).filter(Boolean);
    let size = 84, lineas = [];
    for (; size >= 34; size -= 4) {
      x.font = `800 ${size}px "Big Shoulders", sans-serif`; lineas = []; let l = '';
      palabras.forEach((w) => { const p = l ? l + ' ' + w : w; if (x.measureText(p).width > TGW - 70 && l) { lineas.push(l); l = w; } else l = p; });
      if (l) lineas.push(l);
      if (lineas.length <= 3 && lineas.every((li) => x.measureText(li).width <= TGW - 70)) break;
    }
    lineas.forEach((li, i) => x.fillText(li, TGW / 2, 444 + i * size * 0.98));
    x.setLineDash([10, 9]); x.strokeStyle = 'rgba(35,27,16,.5)'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(24, 668); x.lineTo(TGW - 24, 668); x.stroke(); x.setLineDash([]);
    x.font = '700 30px Archivo, sans-serif'; x.fillText(pie, TGW / 2, 728);
    tex.needsUpdate = true;
  }

  /* ---------- copias colgadas ---------- */
  const geo = new THREE.PlaneGeometry(PW, PH, 24, 16); geo.translate(0, -PH / 2, 0);
  const sombraGeo = new THREE.PlaneGeometry(PW * 1.3, PH * 1.3); sombraGeo.translate(0.05, -PH / 2 - 0.08, 0);
  const sombraMat = new THREE.MeshBasicMaterial({ map: sombraTex, transparent: true, opacity: 0.5, depthWrite: false });
  const TAGW = 0.5, TAGH = TAGW * TGH / TGW;
  const tagGeo = new THREE.PlaneGeometry(TAGW, TAGH); tagGeo.translate(0, -TAGH / 2 + TAGW * 66 / TGW, 0);
  const brocheGeo = new THREE.BoxGeometry(0.045, 0.15, 0.032), resorteGeo = new THREE.TorusGeometry(0.018, 0.005, 6, 12);
  const madera = new THREE.MeshBasicMaterial({ color: 0xC69C6D }), maderaOsc = new THREE.MeshBasicMaterial({ color: 0x9E764A }), metal = new THREE.MeshBasicMaterial({ color: 0x8D9196 });
  const hiloGeo = new THREE.CylinderGeometry(0.003, 0.003, 1, 4); hiloGeo.translate(0, -0.5, 0);
  const hiloMat = new THREE.MeshBasicMaterial({ color: 0x2a2116 });
  const items = [];
  function broche() {
    const g = new THREE.Group();
    const a = new THREE.Mesh(brocheGeo, madera); a.position.set(-0.012, 0, 0.018);
    const b = new THREE.Mesh(brocheGeo, maderaOsc); b.position.set(0.012, 0, 0.018);
    const r = new THREE.Mesh(resorteGeo, metal); r.position.set(0, 0.015, 0.036);
    g.add(a, b, r); return g;
  }
  function crear(data, xpos, opciones = {}) {
    const copia = mkCanvas(CW, CH), tag = mkCanvas(TGW, TGH);
    const tinte = !!data.otro;
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uWind: { value: 1 }, uSeed: { value: Math.random() }, uBillow: { value: 0 }, uMap: { value: copia.tex }, uMask: { value: mascaraCv.tex }, uDim: { value: 0 }, uGray: { value: opciones.fija ? 1 : 0 }, uHover: { value: 0 }, uTintOn: { value: tinte ? 1 : 0 }, uTint: { value: new THREE.Color(data.hex || '#888') }, uSheen: { value: -1 } }
    });
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(geo, mat);
    const sombra = new THREE.Mesh(sombraGeo, sombraMat); sombra.position.z = -0.06; sombra.renderOrder = -1;
    pivot.add(sombra, mesh);
    // dos broches de madera la sostienen de la soga
    const bL = broche(), bR = broche(); bL.position.set(-A, 0.03, 0); bR.position.set(A, 0.03, 0); pivot.add(bL, bR);
    const tagPivot = new THREE.Group(); tagPivot.position.set(A, -0.04, 0.05); tagPivot.visible = false;
    const hilo = new THREE.Mesh(hiloGeo, hiloMat); hilo.scale.y = 0.12; tagPivot.add(hilo);
    const tagMesh = new THREE.Mesh(tagGeo, new THREE.MeshBasicMaterial({ map: tag.tex, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }));
    tagMesh.position.set(0, -0.12, 0.004); tagPivot.add(tagMesh); pivot.add(tagPivot);
    const it = { data, mesh, pivot, bL, copia, tag, tagPivot, mat, sw: 0, swv: 0, tagSw: 0, hover: 0, lean: 0, t: 0, fija: !!opciones.fija, x: xpos };
    pivot.position.set(xpos, TOP, 0);
    rack.add(pivot); mesh.userData.it = it;
    const lab = document.createElement('button'); lab.type = 'button'; lab.className = 'vest__label'; labels.appendChild(lab); it.lab = lab;
    lab.addEventListener('click', () => elegir(it));
    cargarImg(FOTO(tinte || it.fija ? 'blanco' : data.id)).then((img) => { it.img = img; fuentes.then(() => revelar(it)); });
    if (it.fija) fuentes.then(() => { etiqueta(it, 'Arqueros', 'Oasis Cup', 'Camiseta única', 'Color a definir', 'Igual para todos'); tagPivot.visible = true; });
    items.push(it);
    return it;
  }
  lista.forEach((c, i) => crear(c, i * SP));
  crear({ id: 'arquero', n: 'Arqueros', hex: C.ARQUERO.hex }, -SP, { fija: true });

  function estadoItems() {
    items.forEach((it) => {
      if (it.fija) return;
      const tom = it.data.id !== 'otro' && (st.tomados[st.categoria] || {})[it.data.id];
      it.tomado = !!tom; it.tomadoPor = tom ? tom.equipo : '';
      it.tagPivot.visible = it.tomado;
      if (it.tomado) fuentes.then(() => etiqueta(it, 'Reservada', st.categoria === 'femenino' ? 'Oasis Cup femenino' : 'Oasis Cup masculino', 'La reservó', it.tomadoPor, it.data.n));
    });
    actualizarLabels(); st.onCambio(resumen());
  }
  function resumen() { const libres = C.COLORES.filter((c) => !(st.tomados[st.categoria] || {})[c.id]).length; return { libres, total: C.COLORES.length }; }
  estadoItems();

  /* ---------- cámara y tamaño ---------- */
  let W = 1, H = 1, avance = 1, camZ = 5;
  function resize() {
    W = root.clientWidth; H = root.clientHeight;
    renderer.setSize(W, H, false); cam.aspect = W / H;
    const zAlto = (PH + 0.95) / (2 * tan), zAncho = (PW * 1.25) / cam.aspect / (2 * tan);
    camZ = Math.max(zAlto, zAncho);
    const d = Math.max(PH / (0.8 * 2 * tan), PW / (0.92 * cam.aspect * 2 * tan));
    avance = Math.max(0, camZ - d);
    cam.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(root); resize();
  const camY = () => TOP - PH / 2 - 0.12;

  /* ---------- puntero: arrastrar, rasguear la soga, elegir ---------- */
  let off = 0, vel = 0, target = null, dragging = false, lastX = 0, moved = 0, prevOff = 0;
  const minOff = -(lista.length - 1) * SP, maxOff = SP;
  const el = renderer.domElement;
  el.style.touchAction = 'pan-y';
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plano = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), pt = new THREE.Vector3();
  let hovered = null, mouse = { x: 0, y: 0, in: false }, prevRel = null;
  function aNdc(e) { const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); }
  function pick(e) { aNdc(e); const hit = ray.intersectObjects(items.map((i) => i.mesh))[0]; return hit ? hit.object.userData.it : null; }
  function enSoga(e) { aNdc(e); if (!ray.ray.intersectPlane(plano, pt)) return null; return { x: pt.x - off, y: pt.y }; }
  el.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; moved = 0; target = null; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect(); mouse = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1, in: true };
    // rasguear: si el puntero cruza la soga, la empuja en esa dirección
    const p = enSoga(e);
    if (p && !reduce) {
      const rel = p.y - (TOP + ropeY(p.x));
      if (prevRel !== null && Math.sign(rel) !== Math.sign(prevRel) && Math.abs(rel - prevRel) < 0.6) pulsar(p.x, clamp((rel - prevRel) * 16, -1.2, 1.2), 5);
      prevRel = rel;
    }
    if (!dragging) { hovered = pick(e); el.style.cursor = hovered ? (hovered.fija || hovered.tomado ? 'default' : 'pointer') : 'grab'; return; }
    const px = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(px);
    const anchoVisible = 2 * tan * camZ * cam.aspect;
    const dx = px / W * anchoVisible; off += dx; vel = dx;
  });
  el.addEventListener('pointerup', (e) => {
    dragging = false;
    if (moved < 6) {
      const it = pick(e);
      if (it) elegir(it);
      else { if (st.elegido) { soltar(); st.onPick(null, {}); } const p = enSoga(e); if (p && !reduce) pulsar(p.x, -0.9, 6); }
    }
  });
  el.addEventListener('pointercancel', () => { dragging = false; });
  el.addEventListener('pointerleave', () => { hovered = null; mouse.in = false; prevRel = null; });

  function elegir(it) {
    target = -it.x;
    if (it.fija) { st.onPick(null, { arquero: true }); pulsar(it.x, -0.6); return; }
    if (it.tomado) { st.onPick(null, { tomado: true, por: it.tomadoPor, color: it.data }); pulsar(it.x, -0.7); return; }
    if (st.elegido === it) { soltar(); st.onPick(null, {}); return; }
    const antes = st.elegido; st.elegido = it;
    if (antes) revelar(antes);
    revelar(it);
    pulsar(it.x, 0.5, 8);            // la soga se acomoda cuando la foto se va
    st.onPick(it.data, st.mode === 'pick' ? {} : { vista: true });
    actualizarLabels();
  }
  function soltar() { const a = st.elegido; st.elegido = null; if (a) { revelar(a); } actualizarLabels(); }

  function actualizarLabels() {
    items.forEach((it) => {
      const d = it.data;
      it.lab.className = 'vest__label' + (it.tomado ? ' is-taken' : '') + (it.fija ? ' is-fixed' : '') + (st.elegido === it ? ' is-on' : '');
      it.lab.setAttribute('aria-disabled', String(!!it.tomado));
      const estado = it.fija ? 'Color a definir' : it.tomado ? 'Reservada por ' + it.tomadoPor : d.id === 'otro' ? 'Elegí el tono' : 'Libre';
      const sw = it.fija ? '<i class="sw-def"></i>' : `<i style="background:${d.hex}"></i>`;
      it.lab.innerHTML = `${sw}<b>${d.n}</b><small>${estado}</small>`;
      it.lab.setAttribute('aria-label', d.n + (it.tomado ? ', reservada por ' + it.tomadoPor : it.fija ? ', camiseta única de arqueros, color a definir' : ', libre'));
    });
  }

  /* ---------- animación ---------- */
  const clock = new THREE.Clock(), v = new THREE.Vector3();
  let visible = true, camX = 0, camYoff = 0;
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(root);
  // la onda también responde al scroll de la página
  let lastScroll = scrollY;
  addEventListener('scroll', () => { const d = scrollY - lastScroll; lastScroll = scrollY; if (!reduce && visible) for (let k = 0; k < 4; k++) pulsar(X0 + (k + 0.5) * (X1 - X0) / 4, clamp(d * 0.003, -0.18, 0.18), 10); }, { passive: true });

  function loop() {
    requestAnimationFrame(loop);
    if (!visible) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (!dragging) {
      if (target !== null) { off += (target - off) * Math.min(1, dt * 4.5); vel = 0; if (Math.abs(target - off) < 0.002) target = null; }
      else { off += vel; vel *= 0.92; }
    }
    off = clamp(off, minOff, maxOff);
    const acc = (off - prevOff) / Math.max(dt, 0.001); prevOff = off;
    rack.position.x = off;
    soga(dt);
    // la cámara sigue apenas al puntero
    camX += ((mouse.in && !reduce ? mouse.x * 0.07 : 0) - camX) * Math.min(1, dt * 2);
    camYoff += ((mouse.in && !reduce ? mouse.y * 0.03 : 0) - camYoff) * Math.min(1, dt * 2);
    cam.position.set(camX, camY() + camYoff, camZ); cam.lookAt(0, camY(), 0);

    items.forEach((it, i) => {
      const sel = st.elegido === it;
      // cuánto avanzó el viaje al frente (va y vuelve)
      it.t = clamp(it.t + (sel ? dt : -dt * 1.3) * (reduce ? 8 : 1), 0, 1.1);
      const tf = suave(suave(clamp(it.t / 1.1, 0, 1)));
      // colgada de dos broches: sigue la soga
      const yL = ropeY(it.x - A), yR = ropeY(it.x + A);
      const inclin = Math.atan2(yR - yL, 2 * A);
      // péndulo hacia adelante y atrás, empujado por el arrastre y por la soga
      const vy = (rv[Math.round((it.x - X0) / DX)] || 0);
      it.swv += (-20 * it.sw - 4.2 * it.swv + acc * 0.03 + vy * 0.5) * dt; it.sw += it.swv * dt;
      it.sw = clamp(it.sw, -0.5, 0.5);
      it.hover += ((hovered === it && !it.tomado && !it.fija && !sel ? 1 : 0) - it.hover) * Math.min(1, dt * 8);
      const ang = inclin;
      const hx = it.x, hy = TOP + (yL + yR) / 2;
      // pose al frente
      const fx = -off, fy = camY() + PH / 2, fz = avance;
      it.pivot.position.set(hx + (fx - hx) * tf, hy + (fy - hy) * tf + Math.sin(tf * Math.PI) * 0.06, it.hover * 0.06 + fz * tf);
      it.pivot.rotation.z = ang * (1 - tf);
      it.pivot.rotation.x = (it.sw + (reduce ? 0 : Math.sin(t * 0.7 + i * 1.7) * 0.015)) * (1 - tf) - Math.sin(tf * Math.PI) * 0.05;
      it.lean += ((hovered === it ? clamp(mouse.x * 0.12, -0.1, 0.1) : 0) - it.lean) * Math.min(1, dt * 5);
      it.pivot.rotation.y = it.lean * (1 - tf);
      it.tagPivot.rotation.z = (it.tagSw += ((-ang * 0.6 + it.sw * 1.2 + (reduce ? 0 : Math.sin(t * 1.1 + i) * 0.04)) - it.tagSw) * Math.min(1, dt * 3));
      const u = it.mat.uniforms;
      u.uTime.value = t;
      u.uWind.value = reduce ? 0 : (0.35 + Math.min(0.9, Math.abs(acc) * 0.08) + it.hover * 0.25 + Math.min(0.6, Math.abs(vy) * 0.5)) * (1 - tf);
      u.uBillow.value = it.hover * 0.16 + Math.min(0.3, Math.abs(it.swv) * 0.25);
      u.uHover.value = it.hover;
      u.uSheen.value = 0.7 + it.pivot.rotation.y * 1.4 + it.pivot.rotation.x * 1.2 + inclin * 2 + (mouse.in ? mouse.x * 0.25 : 0);
      u.uDim.value += (((st.elegido && !sel) ? 0.62 : it.tomado ? 0.55 : it.fija ? 0.15 : 0) - u.uDim.value) * Math.min(1, dt * 5);
      // etiqueta HTML debajo de cada copia colgada
      v.set(it.x + off, TOP - PH - 0.12, 0); v.project(cam);
      it.lab.style.transform = `translate(${(v.x * 0.5 + 0.5) * W}px, ${(-v.y * 0.5 + 0.5) * H}px) translate(-50%, 0)`;
      const oculta = Math.abs(v.x) > 1.05 || it.t > 0.02 || !!st.elegido;
      it.lab.style.opacity = oculta ? 0 : 1;
      it.lab.style.pointerEvents = oculta ? 'none' : '';
    });
    renderer.render(scene, cam);
  }
  off = 0; prevOff = off;
  loop();

  return {
    setCategoria(c) { st.categoria = c; if (st.elegido && (st.tomados[c] || {})[st.elegido.data.id]) soltar(); estadoItems(); if (!reduce) pulsar(-off, -0.9, 30); },
    setTomados(tm) { st.tomados = tm; if (st.elegido && (tm[st.categoria] || {})[st.elegido.data.id]) soltar(); estadoItems(); },
    setEquipo(n) { st.equipo = n; if (st.elegido) revelar(st.elegido); },
    setOtro(hex) { const it = items.find((i) => i.data.id === 'otro'); it.data.hex = hex; it.mat.uniforms.uTint.value.set(hex); actualizarLabels(); },
    elegir(id) { const it = items.find((i) => i.data.id === id); if (it && st.elegido !== it) elegir(it); },
    soltar,
    mover(dir) { target = clamp((target === null ? off : target) - dir * SP, minOff, maxOff); },
    resumen
  };
}
