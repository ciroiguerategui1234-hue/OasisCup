// Oasis Cup · el vestuario 3D
// Cada color es una foto real del vestuario, impresa en papel y colgada con pinzas del perchero.
// Arrastrás el perchero y las copias se balancean con inercia. Al elegir una, se descuelga,
// viene al frente y le estampamos el nombre de tu equipo en la espalda de la camiseta.
import * as THREE from 'three';

const C = window.OASIS;
const FOTO = (id) => `assets/img/fotos/${id}.webp`;
const FW = 1200, FH = 896, B = 22;                   // foto y borde blanco de la copia
const BB = 64;                                        // borde inferior más ancho, con la leyenda
const CW = FW + B * 2, CH = FH + B + BB;
const PW = 1.62, PH = PW * CH / CW;                  // copia en la escena
const TOP = 1.6;                                      // altura de las pinzas
const ESPALDA = { x: 862, y: 658, w: 290 };           // donde va el nombre en la foto

const cargarImg = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });

/* ---------- Material: papel fotográfico apenas curvado ---------- */
const vert = `
  uniform float uTime, uWind, uSeed, uBillow;
  varying vec2 vUv; varying float vShade;
  void main(){
    vUv = uv;
    float hang = 1.0 - uv.y;
    float t = uTime * 1.2 + uSeed * 6.283;
    float curl = (uv.x - 0.5) * (uv.x - 0.5) * -0.05;
    float wave = sin(uv.x * 3.2 + t) * 0.018 * hang * uWind;
    float z = curl + wave + uBillow * hang * hang * 0.12;
    vShade = cos(uv.x * 3.2 + t) * 0.05 * hang * uWind - uBillow * hang * 0.05;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position + vec3(0.0, 0.0, z), 1.0);
  }`;
const frag = `
  uniform sampler2D uMap, uMask; uniform float uDim, uGray, uHover, uTintOn; uniform vec3 uTint;
  varying vec2 vUv; varying float vShade;
  void main(){
    if (!gl_FrontFacing) { gl_FragColor = vec4(vec3(0.83, 0.81, 0.76) * (1.0 - uDim * 0.5), 1.0);
      #include <colorspace_fragment>
      return; }
    vec3 c = texture2D(uMap, vUv).rgb;
    float m = texture2D(uMask, vUv).r * uTintOn;
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(c, uTint * min(1.08, 0.12 + lum * 1.05), m * smoothstep(0.1, 0.24, lum));
    c *= 1.0 + vShade + uHover * 0.04;
    float g = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(c, vec3(g), max(uGray, uDim));
    c *= 1.0 - uDim * 0.45;
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
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(0, 1.0, 5);

  /* ---------- perchero de metal negro ---------- */
  const SP = PW + 0.34;
  const lista = C.COLORES.map((c) => ({ ...c })).concat([{ id: 'otro', n: 'Otro color', hex: '#C9A227', otro: true }]);
  const negro = new THREE.MeshBasicMaterial({ color: 0x0c0d0c });
  const rack = new THREE.Group(); scene.add(rack);
  const x0 = -SP - PW / 2 - 0.3, x1 = (lista.length - 1) * SP + PW / 2 + 0.3;
  const barra = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.045, 0.045), negro); barra.position.set((x0 + x1) / 2, TOP + 0.16, 0); rack.add(barra);
  [x0, x1].forEach((x) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.045, 3.4, 0.045), negro); p.position.set(x, TOP + 0.16 - 1.7, 0); rack.add(p); });

  /* ---------- texturas ---------- */
  const fuentes = document.fonts ? document.fonts.ready : Promise.resolve();
  const mascara = new THREE.TextureLoader().load('assets/img/fotos/mascara.webp');
  const mkCanvas = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return { cv, tex }; };
  // la máscara está en coordenadas de la foto: la paso al lienzo con borde
  const mascaraCv = mkCanvas(CW, CH); mascaraCv.tex.colorSpace = THREE.NoColorSpace;
  cargarImg('assets/img/fotos/mascara.webp').then((m) => { if (!m) return; const x = mascaraCv.cv.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, CW, CH); x.drawImage(m, B, B, FW, FH); mascaraCv.tex.needsUpdate = true; });

  function revelar(it) {
    // la copia: borde de papel, la foto y el nombre del equipo en la espalda
    const { cv, tex } = it.copia; const x = cv.getContext('2d');
    x.fillStyle = '#F1EEE6'; x.fillRect(0, 0, CW, CH);
    if (it.img) x.drawImage(it.img, B, B, FW, FH);
    // leyenda impresa en el borde, como en las copias de laboratorio
    x.fillStyle = 'rgba(40,36,28,.62)'; x.font = '700 26px "Roboto Condensed", sans-serif'; x.textBaseline = 'middle';
    x.textAlign = 'left'; x.fillText('MAQUETA DE REFERENCIA  ·  EL DISEÑO FINAL PUEDE VARIAR', B + 4, FH + B + BB / 2);
    x.textAlign = 'right'; x.fillText((it.fija ? 'ARQUEROS · COLOR A DEFINIR' : it.data.otro ? 'OTRO COLOR · A PEDIDO' : it.data.n.toUpperCase()), CW - B - 4, FH + B + BB / 2);
    if (st.equipo && !it.fija && st.elegido === it) {
            x.save(); x.translate(B, B);
      x.fillStyle = it.data.id === 'blanco' ? '#3E8DC6' : it.data.otro ? '#1B2433' : 'rgba(246,246,244,.95)';
      x.textAlign = 'center'; x.textBaseline = 'alphabetic';
      const t = st.equipo.toUpperCase().split('').join(String.fromCharCode(8202));
      let s = 48; x.font = `400 ${s}px "Archivo Black", sans-serif`;
      while (x.measureText(t).width > ESPALDA.w && s > 16) { s -= 2; x.font = `400 ${s}px "Archivo Black", sans-serif`; }
      x.globalAlpha = 0.94; x.fillText(t, ESPALDA.x, ESPALDA.y);
      x.restore();
    }
    tex.needsUpdate = true;
  }

  // etiqueta de cartón, colgada de la pinza
  const TGW = 512, TGH = 780;
  function etiqueta(it, titulo, linea1, nombre, pie) {
    const { cv, tex } = it.tag; const x = cv.getContext('2d');
    x.clearRect(0, 0, TGW, TGH);
    const corte = 74;
    x.save();
    x.beginPath(); x.moveTo(corte, 0); x.lineTo(TGW - corte, 0); x.lineTo(TGW, corte); x.lineTo(TGW, TGH - 14); x.quadraticCurveTo(TGW, TGH, TGW - 14, TGH); x.lineTo(14, TGH); x.quadraticCurveTo(0, TGH, 0, TGH - 14); x.lineTo(0, corte); x.closePath();
    const g = x.createLinearGradient(0, 0, TGW, TGH); g.addColorStop(0, '#D3BC8E'); g.addColorStop(1, '#C3A874');
    x.fillStyle = g; x.fill(); x.clip();
    // fibras del cartón
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) { x.fillStyle = rnd() > 0.5 ? 'rgba(80,58,25,.10)' : 'rgba(255,245,220,.12)'; x.fillRect(rnd() * TGW, rnd() * TGH, 1 + rnd() * 5, 1); }
    x.restore();
    // ojal con arandela
    x.fillStyle = '#7D6A45'; x.beginPath(); x.arc(TGW / 2, 66, 30, 0, 7); x.fill();
    x.fillStyle = '#A8925F'; x.beginPath(); x.arc(TGW / 2, 66, 25, 0, 7); x.fill();
    x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(TGW / 2, 66, 15, 0, 7); x.fill(); x.globalCompositeOperation = 'source-over';
    const tinta = '#231B10';
    x.textAlign = 'center'; x.fillStyle = tinta;
    x.font = '700 30px "Roboto Condensed", sans-serif'; espaciado(x, 'OASIS CUP · ' + linea1, TGW / 2, 152, 4);
    let s = 104; x.font = `400 ${s}px "Archivo Black", sans-serif`;
    while (x.measureText(titulo).width > TGW - 70 && s > 40) { s -= 4; x.font = `400 ${s}px "Archivo Black", sans-serif`; }
    x.fillText(titulo, TGW / 2, 262);
    x.fillRect(48, 296, TGW - 96, 4);
    x.font = '700 30px "Roboto Condensed", sans-serif'; x.globalAlpha = 0.75; espaciado(x, nombre.etiqueta, TGW / 2, 354, 4); x.globalAlpha = 1;
    // nombre del equipo: hasta 3 renglones, lo más grande posible
    const palabras = String(nombre.texto || '').toUpperCase().split(/\s+/).filter(Boolean);
    let size = 76, lineas = [];
    for (; size >= 30; size -= 4) {
      x.font = `700 ${size}px "Roboto Condensed", sans-serif`; lineas = []; let l = '';
      palabras.forEach((w) => { const p = l ? l + ' ' + w : w; if (x.measureText(p).width > TGW - 80 && l) { lineas.push(l); l = w; } else l = p; });
      if (l) lineas.push(l);
      if (lineas.length <= 3 && lineas.every((li) => x.measureText(li).width <= TGW - 80)) break;
    }
    lineas.forEach((li, i) => x.fillText(li, TGW / 2, 420 + i * size * 1.02));
    // troquel y pie
    x.setLineDash([10, 9]); x.strokeStyle = 'rgba(35,27,16,.5)'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(24, 666); x.lineTo(TGW - 24, 666); x.stroke(); x.setLineDash([]);
    x.font = '700 32px "Roboto Condensed", sans-serif'; espaciado(x, pie, TGW / 2, 730, 5);
    tex.needsUpdate = true;
  }
  function espaciado(x, txt, cx, y, ls) {
    const chars = txt.split(''); const w = chars.reduce((a, ch) => a + x.measureText(ch).width + ls, -ls);
    let px = cx - w / 2; x.textAlign = 'left';
    chars.forEach((ch) => { x.fillText(ch, px, y); px += x.measureText(ch).width + ls; });
    x.textAlign = 'center';
  }

  /* ---------- copias colgadas ---------- */
  const geo = new THREE.PlaneGeometry(PW, PH, 24, 16); geo.translate(0, -PH / 2, 0);
  const TAGW = 0.5, TAGH = TAGW * TGH / TGW;
  const tagGeo = new THREE.PlaneGeometry(TAGW, TAGH); tagGeo.translate(0, -TAGH / 2 + TAGW * 66 / TGW, 0);
  const pinzaGeo = new THREE.BoxGeometry(0.05, 0.12, 0.03), aroGeo = new THREE.TorusGeometry(0.035, 0.006, 6, 16, Math.PI);
  const hiloGeo = new THREE.CylinderGeometry(0.003, 0.003, 1, 4); hiloGeo.translate(0, -0.5, 0);
  const hiloMat = new THREE.MeshBasicMaterial({ color: 0x2a2116 });
  const items = [];
  function crear(data, xpos, opciones = {}) {
    const copia = mkCanvas(CW, CH), tag = mkCanvas(TGW, TGH);
    const tinte = !!data.otro;
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uWind: { value: 1 }, uSeed: { value: Math.random() }, uBillow: { value: 0 }, uMap: { value: copia.tex }, uMask: { value: mascaraCv.tex }, uDim: { value: 0 }, uGray: { value: opciones.fija ? 1 : 0 }, uHover: { value: 0 }, uTintOn: { value: tinte ? 1 : 0 }, uTint: { value: new THREE.Color(data.hex || '#888') } }
    });
    const mesh = new THREE.Mesh(geo, mat);
    const pivot = new THREE.Group(); pivot.add(mesh);
    // dos pinzas negras que la sostienen de la barra
    [-1, 1].forEach((s) => {
      const p = new THREE.Mesh(pinzaGeo, negro); p.position.set(s * PW * 0.36, 0.02, 0.012); pivot.add(p);
      const a = new THREE.Mesh(aroGeo, negro); a.position.set(s * PW * 0.36, 0.1, 0); pivot.add(a);
    });
    // etiqueta: cuelga de un hilo atado a la pinza derecha
    const tagPivot = new THREE.Group(); tagPivot.position.set(PW * 0.36, -0.02, 0.04); tagPivot.visible = false;
    const hilo = new THREE.Mesh(hiloGeo, hiloMat); hilo.scale.y = 0.12; tagPivot.add(hilo);
    const tagMesh = new THREE.Mesh(tagGeo, new THREE.MeshBasicMaterial({ map: tag.tex, transparent: true, side: THREE.DoubleSide, alphaTest: 0.5 }));
    tagMesh.position.set(0, -0.12, 0.004); tagPivot.add(tagMesh); pivot.add(tagPivot);
    const it = { data, mesh, pivot, copia, tag, tagPivot, mat, sw: 0, swv: 0, tagSw: 0, hover: 0, flight: 0, fija: !!opciones.fija, x: xpos };
    pivot.position.set(xpos, TOP, 0);
    rack.add(pivot); mesh.userData.it = it;
    const lab = document.createElement('button'); lab.type = 'button'; lab.className = 'vest__label'; labels.appendChild(lab); it.lab = lab;
    lab.addEventListener('click', () => elegir(it));
    cargarImg(FOTO(tinte || it.fija ? 'blanco' : data.id)).then((img) => { it.img = img; fuentes.then(() => revelar(it)); });
    if (it.fija) fuentes.then(() => { etiqueta(it, 'ARQUEROS', 'TODOS', { etiqueta: 'CAMISETA ÚNICA', texto: 'Color a definir' }, 'IGUAL PARA TODOS'); tagPivot.visible = true; });
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
      if (it.tomado) fuentes.then(() => etiqueta(it, 'ELEGIDA', st.categoria === 'femenino' ? 'FEMENINO' : 'MASCULINO', { etiqueta: 'LA RESERVÓ', texto: it.tomadoPor }, it.data.n.toUpperCase()));
    });
    actualizarLabels(); st.onCambio(resumen());
  }
  function resumen() { const libres = C.COLORES.filter((c) => !(st.tomados[st.categoria] || {})[c.id]).length; return { libres, total: C.COLORES.length }; }
  estadoItems();

  /* ---------- tamaño ---------- */
  let W = 1, H = 1, avance = 1;
  function resize() {
    W = root.clientWidth; H = root.clientHeight;
    renderer.setSize(W, H, false); cam.aspect = W / H;
    const tan = Math.tan(THREE.MathUtils.degToRad(15));
    const zAlto = (PH + 0.75) / (2 * tan), zAncho = (PW * 1.22) / cam.aspect / (2 * tan);
    cam.position.z = Math.max(zAlto, zAncho);
    cam.position.y = TOP - PH / 2 - 0.08;
    // la copia elegida avanza hasta ocupar casi todo el ancho
    const d = Math.max(PH / (0.84 * 2 * tan), PW / (0.94 * cam.aspect * 2 * tan));
    avance = Math.max(0, cam.position.z - d);
    cam.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(root); resize();

  /* ---------- arrastrar el perchero ---------- */
  let off = 0, vel = 0, target = null, dragging = false, lastX = 0, moved = 0, prevOff = 0;
  const minOff = -(lista.length - 1) * SP, maxOff = SP;
  const el = renderer.domElement;
  el.style.touchAction = 'pan-y';
  el.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; moved = 0; target = null; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => {
    hoverCheck(e);
    if (!dragging) return;
    const px = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(px);
    const anchoVisible = 2 * Math.tan(THREE.MathUtils.degToRad(15)) * cam.position.z * cam.aspect;
    const dx = px / W * anchoVisible; off += dx; vel = dx;
  });
  el.addEventListener('pointerup', (e) => { dragging = false; if (moved < 6) { const it = pick(e); if (it) elegir(it); else if (st.elegido) soltar(); } });
  el.addEventListener('pointercancel', () => { dragging = false; });
  el.addEventListener('pointerleave', () => { hovered = null; });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let hovered = null;
  function pick(e) {
    const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObjects(items.map((i) => i.mesh))[0];
    return hit ? hit.object.userData.it : null;
  }
  function hoverCheck(e) { if (dragging) return; hovered = pick(e); el.style.cursor = hovered ? (hovered.fija || hovered.tomado ? 'default' : 'pointer') : 'grab'; }

  function elegir(it) {
    target = -it.x;
    if (it.fija) { st.onPick(null, { arquero: true }); it.swv += 0.9; return; }
    if (it.tomado) { st.onPick(null, { tomado: true, por: it.tomadoPor, color: it.data }); it.swv += 1.2; return; }
    if (st.mode !== 'pick') { st.onPick(it.data, { vista: true }); it.swv += 0.9; return; }
    if (st.elegido === it) { soltar(); st.onPick(null, {}); return; }
    const antes = st.elegido; st.elegido = it;
    if (antes) revelar(antes);
    revelar(it);
    st.onPick(it.data, {});
    actualizarLabels();
  }
  function soltar() { const a = st.elegido; st.elegido = null; if (a) revelar(a); actualizarLabels(); }

  function actualizarLabels() {
    items.forEach((it) => {
      const d = it.data;
      it.lab.className = 'vest__label' + (it.tomado ? ' is-taken' : '') + (it.fija ? ' is-fixed' : '') + (st.elegido === it ? ' is-on' : '');
      it.lab.setAttribute('aria-disabled', String(!!it.tomado));
      const estado = it.fija ? 'Color a definir' : it.tomado ? 'Elegida por ' + it.tomadoPor : d.id === 'otro' ? 'Elegí el tono' : 'Libre';
      const sw = it.fija ? '<i class="sw-def"></i>' : `<i style="background:${d.hex}"></i>`;
      it.lab.innerHTML = `${sw}<b>${d.n}</b><small>${estado}</small>`;
      it.lab.setAttribute('aria-label', d.n + (it.tomado ? ', elegida por ' + it.tomadoPor : it.fija ? ', camiseta única de arqueros, color a definir' : ', libre'));
    });
  }

  /* ---------- animación ---------- */
  const clock = new THREE.Clock(), v = new THREE.Vector3();
  let visible = true;
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(root);
  function loop() {
    requestAnimationFrame(loop);
    if (!visible) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (!dragging) {
      if (target !== null) { off += (target - off) * Math.min(1, dt * 4.5); vel = 0; if (Math.abs(target - off) < 0.002) target = null; }
      else { off += vel; vel *= 0.92; }
    }
    off = Math.max(minOff, Math.min(maxOff, off));
    const acc = (off - prevOff) / Math.max(dt, 0.001); prevOff = off;
    rack.position.x = off;

    items.forEach((it, idx) => {
      // péndulo: mover el perchero empuja las copias (y más todavía a las etiquetas)
      it.swv += (-18 * it.sw - 3 * it.swv + acc * 0.6) * dt; it.sw += it.swv * dt;
      it.sw = Math.max(-0.4, Math.min(0.4, it.sw));
      it.tagSw += ((it.sw * 1.6 + (reduce ? 0 : Math.sin(t * 1.1 + idx) * 0.04)) - it.tagSw) * Math.min(1, dt * 3);
      const idle = reduce ? 0 : Math.sin(t * 0.7 + idx * 1.7) * 0.012;
      const sel = st.elegido === it;
      it.flight += ((sel ? 1 : 0) - it.flight) * Math.min(1, dt * (reduce ? 20 : 3.2));
      it.hover += ((hovered === it && !it.tomado && !it.fija && !sel ? 1 : 0) - it.hover) * Math.min(1, dt * 8);
      const e = it.flight * it.flight * (3 - 2 * it.flight);
      it.pivot.rotation.z = (it.sw + idle) * (1 - e);
      it.pivot.position.z = e * avance + it.hover * 0.1;
      it.pivot.position.y = TOP + e * 0.05;
      // al descolgarse da una vuelta corta, como quien la levanta para mirarla
      it.pivot.rotation.y = reduce ? 0 : Math.sin(e * Math.PI) * 0.35;
      it.tagPivot.rotation.z = it.tagSw;
      const u = it.mat.uniforms;
      u.uTime.value = t;
      u.uWind.value = reduce ? 0 : 0.5 + Math.min(1.4, Math.abs(acc) * 0.14) + it.hover * 0.4;
      u.uBillow.value = it.hover * 0.35 + Math.min(0.5, Math.abs(it.swv) * 0.4);
      u.uHover.value = it.hover;
      u.uDim.value += (((st.elegido && !sel) ? 0.6 : it.tomado ? 0.55 : it.fija ? 0.15 : 0) - u.uDim.value) * Math.min(1, dt * 5);
      v.set(it.x + off, TOP - PH - 0.1, it.pivot.position.z); v.project(cam);
      it.lab.style.transform = `translate(${(v.x * 0.5 + 0.5) * W}px, ${(-v.y * 0.5 + 0.5) * H}px) translate(-50%, 0)`;
      it.lab.style.opacity = Math.abs(v.x) > 1.05 || e > 0.05 || (st.elegido && !sel) ? 0 : 1;
      it.lab.style.pointerEvents = it.lab.style.opacity === '0' ? 'none' : '';
    });
    renderer.render(scene, cam);
  }
  off = 0; prevOff = off;
  loop();

  return {
    setCategoria(c) { st.categoria = c; if (st.elegido && (st.tomados[c] || {})[st.elegido.data.id]) soltar(); estadoItems(); },
    setTomados(tm) { st.tomados = tm; if (st.elegido && (tm[st.categoria] || {})[st.elegido.data.id]) soltar(); estadoItems(); },
    setEquipo(n) { st.equipo = n; if (st.elegido) revelar(st.elegido); },
    setOtro(hex) { const it = items.find((i) => i.data.id === 'otro'); it.data.hex = hex; it.mat.uniforms.uTint.value.set(hex); actualizarLabels(); },
    elegir(id) { const it = items.find((i) => i.data.id === id); if (it && st.elegido !== it) elegir(it); },
    soltar,
    mover(dir) { target = Math.max(minOff, Math.min(maxOff, (target === null ? off : target) - dir * SP)); },
    resumen
  };
}
