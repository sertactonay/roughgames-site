/* The shared world of the Rough Games studio pages (home, studio, contact): one brutalist concrete building, a work lamp that
   follows the pointer and throws real shadows, the studio's own block letters in weathered steel. Surfaces are photographs of
   real concrete and steel (Poly Haven, CC0: assets/tex/CREDITS.txt); everything else is built here in code. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
export { THREE };

export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const fine = matchMedia('(pointer: fine)').matches;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const mix = (a, b, t) => a + (b - a) * t;
let seed = 7; export const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const Q = new URLSearchParams(location.search);
export const param = k => Q.get(k);

const WEATHER_V = ['#include <common>', '#include <common>\nvarying vec3 vWp;'], WEATHER_V2 = ['#include <begin_vertex>', '#include <begin_vertex>\nvWp=(modelMatrix*vec4(transformed,1.)).xyz;'];
const WEATHER_F = `#include <common>
varying vec3 vWp;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return .5*vn(p)+.25*vn(p*2.03+7.)+.125*vn(p*4.1+13.)+.0625*vn(p*8.3+3.);}
float wB=0.,wC=0.;`;
// large, slow changes of tone and rain streaks, laid over the photographed surface from where each point stands in the world:
// a wall forty metres wide never shows the same patch twice
const WEATHER_M = k => `#include <map_fragment>
{ vec2 q=vWp.xy+vWp.z*vec2(.37,.11); wB=smoothstep(.4,.6,fbm(q*.62+17.)+.22*(vn(q*2.7)-.5)); wC=smoothstep(.42,.6,fbm(q*.17+41.));
  #ifdef USE_MAP
  vec4 s2=texture2D(map,vec2(-vMapUv.x,vMapUv.y)*.71+vec2(.37,.61)), s3=texture2D(map,vMapUv.yx*.83+vec2(.13,.29)); diffuseColor.rgb*=mix(mix(vec3(1.),s2.rgb/max(sampledDiffuseColor.rgb,vec3(.02)),wB),s3.rgb/max(sampledDiffuseColor.rgb,vec3(.02)),wC*.0);
  #endif
  float a=fbm(q*.085), st=smoothstep(.48,.86,fbm(vec2(q.x*1.25,q.y*.06)+31.)), wm=smoothstep(.5,.82,fbm(q*.2+9.));
  float K=${k.toFixed(2)}; diffuseColor.rgb*=mix(1.,mix(.7,1.12,a)*(1.-.24*st),K); diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.07,.97,.86),wm*.55*K); }`;

const NORMAL_MIX = THREE.ShaderChunk.normal_fragment_maps.replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', 'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0; { vec3 n2 = texture2D( normalMap, vec2( -vNormalMapUv.x, vNormalMapUv.y ) * .71 + vec2( .37, .61 ) ).xyz * 2.0 - 1.0; n2.x = -n2.x; mapN = normalize( mix( mapN, n2, wB ) ); }');
if (NORMAL_MIX === THREE.ShaderChunk.normal_fragment_maps) console.warn('normal mix not applied');
export function createWorld({ bg = 0x191715, fog = [30, 100], exposure = 1.0, fov = 34 } = {}) {
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const phone = !fine || Math.min(screen.width, screen.height) < 700;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, +param('ratio') || (phone ? 2 : 1.75)));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(bg); scene.fog = new THREE.Fog(bg, fog[0], fog[1]);
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 260);
  { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.22; pm.dispose(); }     // soft reflections, so steel is never dead black
  const W = { renderer, scene, camera, canvas, phone, time: 0, px: 0.2, py: -0.15, tpx: 0.2, tpy: -0.15, moved: false, go: 0, going: 0, frames: [], ready: false };

  /* ---------- surfaces ---------- */
  let pending = 0; const manager = new THREE.LoadingManager(() => { W.ready = true; }); const loader = new THREE.TextureLoader(manager);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy()), cache = {};
  const big = !phone && renderer.capabilities.maxTextureSize >= 8192;
  function tex(file, srgb) { if (cache[file]) return cache[file]; pending++; const t = loader.load('assets/tex/' + file); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return cache[file] = t; }
  // name: wall | cast | rust | shutter.  tile = metres of surface one copy of the photograph covers
  W.surface = (name, { tile = 4, color = 0xffffff, rough = 1, metal = 0, normal = 1, weather = 0, skin = name } = {}) => {      // skin: another photograph for the colour, over the same relief
    const size = name === 'wall' && big ? 4096 : 2048, m = tex(`${name}_m_${size}.jpg`);
    const mat = new THREE.MeshStandardMaterial({ map: tex(`${skin}_d_${size}.jpg`, true), normalMap: tex(`${name}_n_${size}.jpg`), normalScale: new THREE.Vector2(normal, normal), aoMap: m, roughnessMap: m, roughness: rough, metalness: metal, color });
    mat.userData.tile = tile;
    if (weather) mat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace(...WEATHER_V).replace(...WEATHER_V2); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', WEATHER_F).replace('#include <map_fragment>', WEATHER_M(weather)).replace('#include <normal_fragment_maps>', NORMAL_MIX); }; mat.customProgramCacheKey = () => 'w' + weather;
    return mat;
  };
  // every solid takes its texture from where it stands in the world, so pieces that touch never show a seam
  function worldUV(geo, m, scale) {
    const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv, v = new THREE.Vector3(), nn = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); nn.fromBufferAttribute(n, i).applyMatrix3(nm);
      const ax = Math.abs(nn.x), ay = Math.abs(nn.y), az = Math.abs(nn.z);
      if (az >= ax && az >= ay) uv.setXY(i, v.x / scale, v.y / scale); else if (ax >= ay) uv.setXY(i, v.z / scale, v.y / scale); else uv.setXY(i, v.x / scale, v.z / scale); }
  }
  W.worldUV = worldUV;
  W.slab = (w, h, d, x, y, z, mat, cast = true, parent = scene) => {
    const g = new THREE.BoxGeometry(w, h, d), m = new THREE.Mesh(g, mat); m.position.set(x, y, z); parent.add(m); m.updateWorldMatrix(true, false); worldUV(g, m.matrixWorld, mat.userData.tile || 4);
    m.castShadow = cast; m.receiveShadow = true; return m;
  };
  // the dark cone left in the concrete by each formwork tie: drawn once, placed by the hundred
  const tieTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 30, 2, 32, 32, 30);
    r.addColorStop(0, 'rgba(6,5,4,.96)'); r.addColorStop(0.55, 'rgba(10,9,8,.9)'); r.addColorStop(0.72, 'rgba(20,18,16,.35)'); r.addColorStop(0.86, 'rgba(255,245,230,.10)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const tieMat = new THREE.MeshBasicMaterial({ map: tieTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true });
  /* A cast wall face: a solid mass with rectangular openings, clad in formwork panels. Each panel shows its own patch of the
     photographed concrete, panels are separated by real recessed joints, and every panel carries two tie holes.
     holes: [x0, x1, y0, y1, depth]; all edges on the cell grid (cw x ch). pour(cx, cy) names the pour a cell belongs to: cells of one
     pour share one continuous patch of concrete, and joints are only cut where two pours meet. */
  W.facade = (x0, x1, y0, y1, zf, depth, { holes = [], cw = 2.4, ch = 1.2, face, body, backs = body, gap = 0.03, ties: withTies = true, pour = (cx, cy) => [Math.floor(cx / 4.8), Math.floor(cy / 3.6)] } = {}) => {
    const tile = face.userData.tile || 4, inHole = (cx, cy) => holes.find(h => cx > h[0] && cx < h[1] && cy > h[2] && cy < h[3]);
    const pos = [], uv = [], nor = [], idx = [], ties = [];
    const nx = Math.round((x1 - x0) / cw), ny = Math.round((y1 - y0) / ch);
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const x = x0 + i * cw, y = y0 + j * ch; if (inHole(x + cw / 2, y + ch / 2)) continue;
      const id = pour(x + cw / 2, y + ch / 2), same = (dx, dy) => { const q = pour(x + cw / 2 + dx * cw, y + ch / 2 + dy * ch); return q[0] === id[0] && q[1] === id[1]; };
      const hs = Math.sin(id[0] * 127.1 + id[1] * 311.7) * 43758.5453, ox = hs - Math.floor(hs), ht = Math.sin(id[0] * 269.5 + id[1] * 183.3) * 43758.5453, oy = ht - Math.floor(ht);
      const a = x + (same(-1, 0) ? 0 : gap / 2), b = x + cw - (same(1, 0) ? 0 : gap / 2), c = y + (same(0, -1) ? 0 : gap / 2), d = y + ch - (same(0, 1) ? 0 : gap / 2), n = pos.length / 3, z = zf + 0.03;
      pos.push(a, c, z, b, c, z, b, d, z, a, d, z); nor.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1);
      uv.push(a / tile + ox, c / tile + oy, b / tile + ox, c / tile + oy, b / tile + ox, d / tile + oy, a / tile + ox, d / tile + oy); idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
      if (withTies) ties.push(x + cw * 0.5, y + ch / 2);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const skin = new THREE.Mesh(g, face); skin.receiveShadow = true; scene.add(skin);
    if (ties.length) { const im = new THREE.InstancedMesh(new THREE.CircleGeometry(0.034, 12), tieMat, ties.length / 2), M = new THREE.Matrix4();
    for (let i = 0; i < ties.length / 2; i++) { M.makeTranslation(ties[i * 2], ties[i * 2 + 1], zf + 0.034); im.setMatrixAt(i, M); } im.frustumCulled = false; scene.add(im); }
    // the mass behind the panels: bands between the openings' edges, split around each opening
    const ys = [...new Set([y0, y1, ...holes.flatMap(h => [h[2], h[3]])])].filter(y => y >= y0 && y <= y1).sort((a, b) => a - b);
    for (let k = 0; k < ys.length - 1; k++) { const ya = ys[k], yb = ys[k + 1], cy = (ya + yb) / 2, cut = holes.filter(h => cy > h[2] && cy < h[3]).sort((a, b) => a[0] - b[0]); let x = x0;
      for (const h of [...cut, [x1]]) { if (h[0] - x > 1e-4) W.slab(h[0] - x, yb - ya, depth, (x + h[0]) / 2, cy, zf - depth / 2, body); x = h[1]; } }
    for (const h of holes) if (h[4] < depth) W.slab(h[1] - h[0], h[3] - h[2], depth - h[4], (h[0] + h[1]) / 2, (h[2] + h[3]) / 2, zf - h[4] - (depth - h[4]) / 2, backs);
    return skin;
  };

  /* ---------- the studio's block letters: each a few bars on a 4 x 6 grid ---------- */
  const GL = {      // bars as [x0, y0, x1, y1]; p = a four-point polygon for a diagonal
    R: [[0, 0, 1, 6], [0, 5, 4, 6], [3, 2.5, 4, 6], [0, 2.5, 4, 3.5], { p: [[1.9, 2.6], [3.1, 2.6], [4, 0], [2.8, 0]] }],
    O: [[0, 0, 1, 6], [3, 0, 4, 6], [0, 5, 4, 6], [0, 0, 4, 1]],
    U: [[0, 0, 1, 6], [3, 0, 4, 6], [0, 0, 4, 1]],
    G: [[0, 0, 1, 6], [0, 5, 4, 6], [0, 0, 4, 1], [3, 0, 4, 3], [2, 2, 4, 3]],
    H: [[0, 0, 1, 6], [3, 0, 4, 6], [0, 2.5, 4, 3.5]],
    A: [[0, 0, 1, 6], [3, 0, 4, 6], [0, 5, 4, 6], [0, 2.3, 4, 3.3]],
    M: [[0, 0, 1, 6], [4, 0, 5, 6], [0, 5, 5, 6], [2, 2.6, 3, 6]],
    E: [[0, 0, 1, 6], [0, 5, 4, 6], [0, 0, 4, 1], [0, 2.5, 3.2, 3.5]],
    S: [[0, 5, 4, 6], [0, 2.5, 1, 6], [0, 2.5, 4, 3.5], [3, 0, 4, 3.5], [0, 0, 4, 1]],
    T: [[0, 5, 4, 6], [1.5, 0, 2.5, 6]],
    D: [[0, 0, 1, 6], [0, 5, 3, 6], [0, 0, 3, 1], [3, 1, 4, 5]],
    I: [[0, 0, 1, 6]],
    C: [[0, 0, 1, 6], [0, 5, 4, 6], [0, 0, 4, 1]],
    N: [[0, 0, 1, 6], [3, 0, 4, 6], { p: [[1, 6], [1, 3.9], [3, 0], [3, 2.1]] }],
    L: [[0, 0, 1, 6], [0, 0, 4, 1]],
    P: [[0, 0, 1, 6], [0, 5, 4, 6], [3, 2.5, 4, 6], [0, 2.5, 4, 3.5]],
    K: [[0, 0, 1, 6], { p: [[1, 2.5], [2.3, 2.5], [4, 6], [2.7, 6]] }, { p: [[1, 3.5], [2.3, 3.5], [4, 0], [2.7, 0]] }],
  };
  const GW = c => c === 'M' ? 5 : c === 'I' ? 1 : 4;
  W.word = (text, x0, y, z, U, depth, mat, parent = scene) => {     // centred on x0, baseline at y, standing out from z
    const widths = [...text].map(GW), total = widths.reduce((a, b) => a + b, 0) + (text.length - 1); let x = -total / 2; const out = [];
    [...text].forEach((ch, i) => {
      const grp = new THREE.Group(); grp.position.set(x0 + x * U, y, z); parent.add(grp);
      for (const b of GL[ch]) {
        let g;
        if (b.p) { const s = new THREE.Shape(b.p.map(q => new THREE.Vector2(q[0] * U, q[1] * U))); g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); }
        else { g = new THREE.BoxGeometry((b[2] - b[0]) * U, (b[3] - b[1]) * U, depth); g.translate((b[0] + b[2]) / 2 * U, (b[1] + b[3]) / 2 * U, depth / 2); }
        const m = new THREE.Mesh(g, mat); grp.add(m); grp.updateWorldMatrix(true, true); worldUV(g, m.matrixWorld, mat.userData.tile || 2.2); m.castShadow = m.receiveShadow = true;
      }
      out.push({ grp, z, cx: x0 + (x + widths[i] / 2) * U, cy: y + 3 * U, push: 0 }); x += widths[i] + 1;
    });
    return out;
  };
  W.wordWidth = (text, U) => ([...text].map(GW).reduce((a, b) => a + b, 0) + text.length - 1) * U;

  /* ---------- light: a dim building and one lamp you hold ---------- */
  W.hemi = new THREE.HemisphereLight(0xc4cee0, 0x3d352d, 1.0); scene.add(W.hemi);
  W.fill = new THREE.DirectionalLight(0xbfcbe0, 0.3); W.fill.position.set(-8, 14, 10); scene.add(W.fill);
  // a work lamp held close to the wall: its light falls off quickly, and every block throws a shadow away from it.
  // One very wide spot instead of a point light: a single sharp shadow map rather than six coarse ones.
  const lamp = W.lamp = new THREE.SpotLight(0xffdcb0, 190, 50, 1.32, 1, 1.9); lamp.castShadow = true; lamp.shadow.mapSize.set(phone ? 2048 : 4096, phone ? 2048 : 4096); lamp.shadow.bias = -0.0012; lamp.shadow.normalBias = 0.06; lamp.shadow.radius = 4;
  lamp.shadow.camera.near = 0.3; lamp.shadow.camera.far = 46; scene.add(lamp, lamp.target);
  W.lampPower = 190; W.lampAt = new THREE.Vector3();
  const DN = 260, dp = new Float32Array(DN * 3), dseed = new Float32Array(DN * 3); for (let i = 0; i < DN * 3; i++) dseed[i] = rnd();
  const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(dp, 3)), new THREE.PointsMaterial({ color: 0xffe6c4, size: 0.045, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.frustumCulled = false; scene.add(dust);
  const ray = new THREE.Raycaster(), hit = new THREE.Vector3(), v = new THREE.Vector3();
  // where the pointer's ray meets the plane z = pz
  W.pointAt = (pz, out, sx = W.px, sy = W.py) => { ray.setFromCamera(v.set(sx, -sy, 0), camera); const d = ray.ray.direction, o = ray.ray.origin, k = (pz - o.z) / d.z; return k > 0 ? out.set(o.x + d.x * k, o.y + d.y * k, pz) : null; };
  W.aimLamp = (pz, dim = 1, off = 3.4) => {
    if (W.pointAt(pz + 0.2, hit)) { W.lampAt.copy(hit); lamp.position.set(hit.x, hit.y, pz + off + 0.25 * Math.sin(W.time * 0.9)); lamp.target.position.set(hit.x, hit.y, pz - 2); }
    lamp.intensity = W.lampPower * dim * (0.97 + 0.03 * Math.sin(W.time * 9.1) * Math.sin(W.time * 3.7));
    for (let i = 0; i < DN; i++) { const j = i * 3; dp[j] = W.lampAt.x + (dseed[j] - 0.5) * 22 + Math.sin(W.time * 0.2 + i) * 0.6; dp[j + 1] = ((dseed[j + 1] * 16 - W.time * (0.06 + dseed[j + 2] * 0.08)) % 16 + 16) % 16 - 8 + W.lampAt.y; dp[j + 2] = pz + 1 + dseed[j + 2] * 7; }
    dust.geometry.attributes.position.needsUpdate = true;
  };

  /* ---------- text painted on a surface ---------- */
  W.paint = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    const run = () => { draw(c.getContext('2d'), w, h); t.needsUpdate = true; }; run(); if (document.fonts) document.fonts.ready.then(run); return t; };

  /* ---------- pointer, scroll, leaving for another page ---------- */
  addEventListener('pointermove', e => { W.tpx = e.clientX / innerWidth * 2 - 1; W.tpy = e.clientY / innerHeight * 2 - 1; if (e.pointerType === 'mouse') W.moved = true; }, { passive: true });
  const veil = document.getElementById('veil');
  W.leave = (href, e) => { if (reduce || (e && (e.metaKey || e.ctrlKey))) { if (!e) location.href = href; return false; } if (e) e.preventDefault(); if (W.going) return true; W.going = performance.now(); W.dest = href; setTimeout(() => { location.href = href; }, 1200); return true; };
  addEventListener('pageshow', e => { if (e.persisted) { W.going = 0; W.go = 0; W.dest = null; veil.style.opacity = 0; } });     // back with the browser's Back button
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  const forced = param('t'); W.t = 0; let a = 0, b = 0;
  W.start = frame => {
    let last = performance.now(), first = true, shown = false;
    function tick(now) {
      const dt = clamp((now - last) / 1000, 0.001, 0.05); last = now; W.time += dt; W.frames.push(dt); if (W.frames.length > 600) W.frames.shift();
      const raw = forced != null && isFinite(+forced) ? +forced : clamp(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight));
      const k = 1 - Math.exp(-dt / (reduce ? 0.05 : 0.085)); if (first || forced != null) a = b = raw; else { a += (raw - a) * k; b += (a - b) * k; } W.t = b; W.raw = raw;
      if (!fine || !W.moved) { const c = W.idle || [0, -0.1, 0.45, 0.25]; W.tpx = c[0] + c[2] * Math.sin(W.time * 0.35); W.tpy = c[1] + c[3] * Math.sin(W.time * 0.27 + 1); }     // no mouse: the lamp wanders
      const kp = 1 - Math.exp(-dt / 0.22); W.px += (W.tpx - W.px) * kp; W.py += (W.tpy - W.py) * kp;
      if (W.going) W.go = clamp((now - W.going) / 1100);
      frame(dt, W.go * W.go * (3 - 2 * W.go));
      renderer.render(scene, camera); veil.style.opacity = ss(0.45, 1, W.go); first = false;
      if (!shown && (W.ready || pending === 0)) { shown = true; const l = document.getElementById('load'); if (l) { l.style.opacity = 0; setTimeout(() => l.remove(), 900); } W.shownAt = W.time; }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  };
  return W;
}
