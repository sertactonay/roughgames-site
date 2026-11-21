/* Hotwire site, proof scene: the opening, rendered live in the browser.
   Everything here is our own: the HOTWIRE letters (Tools/title/build_letters.py), the wire path
   (Assets/_Game/Art/Title/Data/wire_path.json) and a street built in code. No game footage, no car models.
   Scroll only sets a destination; the camera and the wire glide there, and the world keeps moving when you stop. */
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createCar } from './car.js';
import { createRace } from './race.js';
import { createAudio } from './audio.js';

const q = new URLSearchParams(location.search);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;
const lite = innerWidth < 760 || !fine;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const rnd = (() => { let s = 20261120; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();

await document.fonts.load('52px SairaXC').catch(() => {});
const FOG = new THREE.Color(0x04050d), EMBER = new THREE.Color(0xff5a1f);
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
// resolution follows a pixel budget and then adapts to the measured frame time (see adapt() below)
const DPR = devicePixelRatio || 1, BUDGET = lite ? 1.2e6 : 1.6e6;
let ratio = Math.min(DPR, 1.75, Math.sqrt(BUDGET / (innerWidth * innerHeight)));
renderer.setPixelRatio(ratio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
scene.background = FOG; scene.fog = new THREE.FogExp2(FOG, 0.021);
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 600);

/* ---------- small canvas textures ---------- */
function tex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = opts.data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8; return t;
}
const glowTex = tex(128, 128, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.18, 'rgba(255,255,255,.55)'); r.addColorStop(.5, 'rgba(255,255,255,.1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
const brushTex = tex(256, 256, (g, w, h) => { g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const v = 90 + rnd() * 110 | 0; g.fillStyle = `rgba(${v},${v},${v},.35)`; g.fillRect(0, rnd() * h, w, 1 + rnd() * 1.5); } }, { data: true, repeat: true });
const ropeTex = tex(32, 32, (g, w) => { g.fillStyle = '#ffb060'; g.fillRect(0, 0, w, w); g.strokeStyle = '#fff3d0'; g.lineWidth = 7; for (let i = -2; i < 3; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16 + 32, 32); g.stroke(); } }, { repeat: true });

/* ---------- reflections for the metal: a dark room with a few coloured light strips ---------- */
{
  const env = new THREE.Scene(); env.background = new THREE.Color(0x010103);
  const strip = (col, w, h, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
  strip(new THREE.Color(1.6, 1.9, 4.2), 14, 2.2, 0, 9, 4);        // cool overhead
  strip(new THREE.Color(5.0, 1.6, 0.4), 9, 0.9, -7, -1.5, 6);     // ember, low left
  strip(new THREE.Color(3.2, 0.5, 2.2), 1.2, 7, 10, 2, 3);        // magenta sign, right
  strip(new THREE.Color(0.3, 2.6, 2.0), 1.0, 5, -11, 3, -2);      // green sign, left
  strip(new THREE.Color(2.2, 2.2, 2.6), 3, 0.5, 3, 3, 10);        // small white kicker
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, 0.03).texture; pm.dispose();
}

/* ---------- lights ---------- */
scene.add(new THREE.HemisphereLight(0x39407a, 0x05050a, 0.12));
const key = new THREE.DirectionalLight(0x9fb0ff, 0); key.position.set(-4, 6, 8); scene.add(key);
const headLight = new THREE.PointLight(0xff7a2a, 0, 7, 2); scene.add(headLight);
const cursorLight = new THREE.PointLight(0xc8d6ff, 0, 3.2, 2); scene.add(cursorLight);

/* ---------- wet road: a real mirror of the scene, broken up by asphalt, puddles and rain ---------- */
const GROUND = -1.62;
const ground = new Reflector(new THREE.PlaneGeometry(700, 900), {
  textureWidth: Math.round(innerWidth * (lite ? 0.45 : 0.5)), textureHeight: Math.round(innerHeight * (lite ? 0.45 : 0.5)), clipBias: 0.003, multisample: 0,
  shader: {
    name: 'WetRoad',
    uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, time: { value: 0 }, headPos: { value: new THREE.Vector3() }, headI: { value: 0 }, carP: { value: new THREE.Vector3() }, carI: { value: 0 }, fogCol: { value: FOG }, fogD: { value: 0.021 } },
    vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
      void main(){ vUv = textureMatrix * vec4(position,1.0); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float time, headI, fogD, carI; uniform vec3 headPos, fogCol, carP; varying vec4 vUv; varying vec3 vW;
      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<3;i++){ s += a*noise(p); p *= 2.03; a *= 0.5; } return s * 1.07; }
      void main(){
        vec2 xz = vW.xz; float d = distance(cameraPosition, vW); vec3 V = normalize(cameraPosition - vW);
        float pud = smoothstep(0.44, 0.60, fbm(xz * 0.21 + 3.1));
        float detail = clamp(1.0 - d / 22.0, 0.0, 1.0);
        float grain = mix(0.5, noise(xz * 42.0), detail);
        vec2 rip = vec2(noise(xz * 8.0 + vec2(0.0, time * 1.7)), noise(xz * 8.0 + vec2(time * 1.3, 7.0))) - 0.5;
        vec2 rough = (vec2(noise(xz * 64.0), noise(xz * 64.0 + 9.0)) - 0.5) * detail;
        float near = 1.0 / (1.0 + d * 0.08);
        vec2 off = (rip * 0.0035 * (0.35 + pud) + rough * 0.004 * (1.0 - pud)) * near;
        vec2 uv = vUv.xy / vUv.w; vec3 r = vec3(0.0);
        float sp = mix(0.05, 0.004, pud) * near;
        for(int i=0;i<7;i++){ float f = (float(i) - 3.0) / 3.0; r += texture2D(tDiffuse, uv + off + vec2(0.0, f * sp * (0.5 + grain))).rgb * (1.0 - abs(f) * 0.5); }
        r /= 5.0;
        float F = mix(0.05, 1.0, pow(1.0 - max(V.y, 0.0), 4.0));
        vec3 base = vec3(0.010, 0.010, 0.016) * (0.6 + grain * 0.8);
        float lane = (1.0 - smoothstep(0.06, 0.09, abs(xz.x))) * step(0.5, fract(xz.y / 7.0));
        float edge = 1.0 - smoothstep(0.05, 0.08, abs(abs(xz.x) - 5.6));
        base += vec3(0.045, 0.045, 0.05) * (lane + edge * 0.6) * (0.4 + grain);
        for(int k=0;k<2;k++){ float sd = k == 0 ? 1.0 : -1.0; float dz = mod(xz.y - (22.0 + sd * 6.0) + 13.0, 26.0) - 13.0; float dx = xz.x - sd * 6.4;
          base += vec3(1.0, 0.6, 0.25) * 0.075 * exp(-(dx*dx + dz*dz) / 16.0) * (0.45 + grain); }
        float hd = distance(vW, headPos);
        base += vec3(1.0, 0.36, 0.09) * headI * (0.012 + grain * 0.02) / (0.12 + hd * hd);
        vec2 hc = xz - carP.xz; float ah = max(-hc.y, 0.0);   // metres ahead of the car; clamped, or the maths blows up behind it
        base += vec3(0.8, 0.88, 1.0) * carI * 0.11 * smoothstep(1.6, 4.5, ah) * exp(-ah / 15.0) * exp(-min((hc.x * hc.x) / (2.2 + ah * 0.55), 40.0)) * (0.5 + grain);
        vec3 col = base + r * F * mix(0.42, 1.0, pud);
        col = mix(col, fogCol, 1.0 - exp(-fogD * fogD * d * d));
        gl_FragColor = vec4(col, 1.0);
      }`,
  },
});
ground.rotation.x = -Math.PI / 2; ground.position.set(0, GROUND, -200); scene.add(ground);
const gU = ground.material.uniforms;

let skyRef = null, goMat = null, wrapList = [], wrapped = false;
const PA = 0.34, PB = 0.60, CITY_L = 572, SPOT = new THREE.Vector3(1.9, -1.62, -322);   // scroll: logo 0..PA | car PA..PB | race PB..1; the street repeats every CITY_L metres; the SPIRE's place on the grid
/* ---------- the street: built in code, kept in the dark and the fog ---------- */
{
  const winTex = [0, 1, 2].map(() => tex(256, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const cols = 8, rows = 8, cw = w / cols, ch = h / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (rnd() > 0.27) continue;
      const c = ['#ffb347', '#ff9a3c', '#ffcf8f', '#e07f2a', '#8fa6e8'][rnd() * 4.25 | 0];
      const gr = g.createLinearGradient(0, y * ch, 0, (y + 1) * ch); gr.addColorStop(0, c); gr.addColorStop(1, '#3a1f08');
      g.fillStyle = gr; g.globalAlpha = 0.3 + rnd() * 0.7;
      g.fillRect(x * cw + cw * 0.26, y * ch + ch * 0.2, cw * 0.48, ch * 0.5);
    }
  }, { repeat: true }));
  const city = new THREE.Group();
  for (const side of [-1, 1]) {
    for (let z = 34; z > -520;) {
      const w = 10 + rnd() * 12, d = 12 + rnd() * 16, h = 16 + rnd() * 44;
      const t = winTex[rnd() * 3 | 0].clone(); t.repeat.set(Math.max(1, Math.round(d / 24)), Math.max(1, Math.round(h / 24))); t.offset.set(rnd(), rnd()); t.needsUpdate = true;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0x06060b, roughness: 0.85, metalness: 0.1, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.95, envMapIntensity: 0.1 }));
      b.position.set(side * (11.5 + w / 2), GROUND + h / 2, z - d / 2); city.add(b);
      z -= d + 0.6 + (rnd() < 0.2 ? 6 : 0);
    }
  }
  // projecting neon signs with the city's own words
  const words = ['KTV', 'BAR', 'INN', 'FOOD', 'SAUNA', 'TATTOO', 'CLUB', 'VOLT'], cols = [[3.4, .5, 1.8], [.4, 2.8, 1.6], [.4, 2.2, 3.2], [3.2, 1.6, .4], [2.2, .9, 3.4]];
  const signGeo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < 26; i++) {
    const word = words[i % words.length], n = word.length;
    const t = tex(64, 64 * n, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '52px SairaXC, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; [...word].forEach((ch, k) => g.fillText(ch, w / 2, 34 + k * 64)); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8); });
    const c = cols[i % cols.length];
    const m = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(c[0] * 0.8, c[1] * 0.8, c[2] * 0.8), toneMapped: false, side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const s = 0.9 + rnd() * 0.5, side = i % 2 ? 1 : -1;
    m.scale.set(s, s * n, 1); m.position.set(side * (10.2 + rnd() * 0.8), GROUND + 4 + rnd() * 9, -8 - i * 17 - rnd() * 8); city.add(m);
  }
  // street lamps: poles and a sodium glow
  const pole = new THREE.CylinderGeometry(0.07, 0.09, 7, 6), poleMat = new THREE.MeshStandardMaterial({ color: 0x08080c, roughness: 0.6, metalness: 0.6 });
  const lampMat = new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(1.5, 0.9, 0.38), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  for (let z = 22; z > -540; z -= 26) for (const side of [-1, 1]) {
    const p = new THREE.Mesh(pole, poleMat); p.position.set(side * 7.2, GROUND + 3.5, z + side * 6); city.add(p);
    const l = new THREE.Sprite(lampMat); l.scale.setScalar(1.25); l.position.set(side * 6.4, GROUND + 6.9, z + side * 6); city.add(l);
  }
  const WRAP_N = city.children.length;   // everything so far (buildings, signs, lamps) repeats along the street
  // city haze behind the roofs, so the buildings read as silhouettes
  const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 24, 12), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vD; void main(){ float h = smoothstep(-0.02, 0.32, vD.y); vec3 c = mix(vec3(0.030,0.024,0.060), vec3(0.008,0.009,0.022), h); gl_FragColor = vec4(c, 1.0); }` }));
  sky.renderOrder = -10; sky.frustumCulled = false; city.add(sky); city.userData.sky = sky;
  // the grid waiting at the far end: tail lights in the rain and five reds above the road
  const tail = new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(3.2, 0.16, 0.08), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const hotRed = new THREE.MeshBasicMaterial({ color: new THREE.Color(5.5, 0.22, 0.1), toneMapped: false, fog: false });
  const bar = new THREE.PlaneGeometry(0.46, 0.065), dot = new THREE.CircleGeometry(0.2, 24);
  for (const z of [-322, -330, -338]) for (const x of [-1.9, 1.9]) for (const o of [-0.58, 0.58]) {
    if (z === -322) continue;   // back row: the real car stands here, with room to walk around it
    const px = x + o + (z % 3) * 0.2, pz = z + x * 0.8;
    const b = new THREE.Mesh(bar, hotRed); b.position.set(px, GROUND + 0.8, pz); city.add(b);
    const l = new THREE.Sprite(tail); l.scale.set(0.55, 0.26, 1); l.position.set(px, GROUND + 0.8, pz + 0.02); l.material.opacity = 0.5; city.add(l); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(15, 0.45, 0.45), poleMat); beam.position.set(0, GROUND + 4.9, -346); city.add(beam);
  for (const x of [-7.2, 7.2]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6.4, 0.4), poleMat); p.position.set(x, GROUND + 3.2, -346); city.add(p); }
  const red = new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(4.5, 0.2, 0.1), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  goMat = hotRed.clone();
  for (let i = -2; i <= 2; i++) { const c = new THREE.Mesh(dot, goMat); c.position.set(i * 1.1, GROUND + 4.35, -345.7); city.add(c); const l = new THREE.Sprite(red); l.scale.setScalar(0.9); l.material.opacity = 0.45; l.position.set(i * 1.1, GROUND + 4.35, -345.6); city.add(l); }
  scene.add(city); skyRef = sky; wrapList = city.children.slice(0, WRAP_N).map(o => ({ o, z: o.position.z }));
}

/* ---------- rain: streaks that wrap around the camera ---------- */
const RAIN = lite ? 3500 : 7000;
const rainGeo = new THREE.BufferGeometry();
{
  const seed = new Float32Array(RAIN * 6), end = new Float32Array(RAIN * 2);
  for (let i = 0; i < RAIN; i++) { const a = rnd(), b = rnd(), c = rnd(); seed.set([a, b, c, a, b, c], i * 6); end[i * 2 + 1] = 1; }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(seed, 3)); rainGeo.setAttribute('end', new THREE.BufferAttribute(end, 1));
}
const rainMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { time: { value: 0 }, nearF: { value: 0.3 }, cam: { value: new THREE.Vector3() }, box: { value: new THREE.Vector3(26, 16, 26) } },
  vertexShader: `uniform float time, nearF; uniform vec3 cam, box; attribute float end; varying float vA;
    void main(){ vec3 p = position * box; float sp = 15.0 + position.z * 7.0; p.y -= time * sp; p.x += time * 1.2;
      p = mod(p - cam + box * 0.5, box) - box * 0.5 + cam; p.y += end * (0.16 + position.x * 0.14); p.x += end * 0.03;
      vec4 mv = viewMatrix * vec4(p, 1.0); vA = (1.0 - end * 0.7) * smoothstep(26.0, 6.0, -mv.z) * smoothstep(nearF, nearF + 1.2, -mv.z); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vA; void main(){ gl_FragColor = vec4(vec3(0.55, 0.62, 0.9) * vA * 0.2, 1.0); }`,
});
const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; scene.add(rain);

/* ---------- sparks at the wire's hot end ---------- */
const NS = 280, sPos = new Float32Array(NS * 3).fill(-999), sVel = new Float32Array(NS * 3), sLife = new Float32Array(NS);
const sparkGeo = new THREE.BufferGeometry(); sparkGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ map: glowTex, size: 0.035, sizeAttenuation: true, color: new THREE.Color(4, 1.6, 0.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
sparks.frustumCulled = false; scene.add(sparks);
let sNext = 0;
function emit(p, n, power) {
  for (let k = 0; k < n; k++) {
    const i = sNext = (sNext + 1) % NS, a = rnd() * 6.283, u = rnd() * 0.9 + 0.1;
    sPos.set([p.x, p.y, p.z], i * 3);
    sVel.set([Math.cos(a) * u * power, (0.4 + rnd()) * power, Math.sin(a) * u * power * 0.7 + 0.3], i * 3); sLife[i] = 0.35 + rnd() * 0.7;
  }
}
const headGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(2.4, 0.9, 0.25), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
scene.add(headGlow);

/* ---------- post: bloom, speed streaks, lens fringe, vignette, grain ---------- */
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: lite ? 0 : 2 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.42, 0.35, 1.0); composer.addPass(bloom);
const lens = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, speed: { value: 0 }, fade: { value: 0 }, flash: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, speed, fade, flash; varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main(){ vec2 c = vUv - 0.5; float r = length(c); vec3 col = vec3(0.0);
      if (speed > 0.015) { for(int i=0;i<6;i++){ float k = 1.0 - speed * 0.16 * (float(i) / 6.0) * r * 2.0; col += texture2D(tDiffuse, 0.5 + c * k).rgb; } col /= 6.0; } else col = texture2D(tDiffuse, vUv).rgb;
      float ca = 0.003 * r * (1.0 + speed * 0.7);
      col.r = mix(col.r, texture2D(tDiffuse, 0.5 + c * (1.0 + ca)).r, 0.6); col.b = mix(col.b, texture2D(tDiffuse, 0.5 + c * (1.0 - ca)).b, 0.6);
      col *= 1.0 - smoothstep(0.32, 0.95, r) * 0.78;
      col += (hash(vUv * 900.0 + fract(time) * 31.0) - 0.5) * 0.010;
      gl_FragColor = vec4((max(col, 0.0) + vec3(0.7, 0.6, 1.0) * flash) * (1.0 - fade), 1.0); }`,
});
composer.addPass(lens); composer.addPass(new OutputPass());

function resize() {
  const w = innerWidth, h = innerHeight; renderer.setPixelRatio(ratio); renderer.setSize(w, h, false); composer.setPixelRatio(ratio); composer.setSize(w, h);
  bloom.setSize(w * ratio * 0.5, h * ratio * 0.5);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
// keep it fluid: if frames run long, render fewer pixels; if there is headroom, sharpen again
let acc = 0, cnt = 0, good = 0, ceil = 9, probe = 0;
function adapt(dt) {
  if (q.has('ratio')) { if (ratio !== +q.get('ratio')) { ratio = +q.get('ratio'); resize(); } return; }   // QA: pin the resolution
  if (S.time < 3 || document.hidden) { acc = cnt = 0; return; }           // ignore loading hitches
  acc += dt; cnt++; if (acc < 1) return; const avg = acc / cnt * 1000; acc = 0; cnt = 0;
  const maxR = Math.min(DPR, 1.75);
  if (++probe > 20) { probe = 0; ceil = Math.min(maxR, ceil * 1.1); }     // now and then, allow another try upward
  if (avg > 19.5 && ratio > 0.7) { ratio = Math.max(0.7, ratio * 0.87); ceil = ratio * 1.03; good = 0; resize(); }
  // frames are capped by the display, so "fast" just means no drops: hold three clean seconds, then sharpen one step
  else if (avg < 17.4) { if (++good >= 3 && ratio < Math.min(maxR, ceil) - 0.01) { ratio = Math.min(maxR, ceil, ratio * 1.07); good = 0; resize(); } }
  else good = 0;
}

/* ---------- letters and wire ---------- */
const data = await (await fetch('assets/title.json')).json();
/* The cable is the game's own: the baked rope of the current title sequence (rope_b5_title, exported by tools/export_rope.py).
   Frames are 30 a second on a fixed grid of the cable's arc length; the page blends neighbouring frames, so scroll never steps. */
const rj = await (await fetch('assets/rope.json')).json();
const rb = new Int16Array(await (await fetch('assets/rope.bin')).arrayBuffer());
const OY = GROUND - rj.asphalt;      // put the title's road level on this scene's road
const loadEl = document.getElementById('load'); let loaded = 0;
const objs = await Promise.all(data.letters.map(l => new OBJLoader().loadAsync('assets/letters/' + l.obj).then(o => { loadEl.style.setProperty('--k', ++loaded / data.letters.length); return o; })));
const letters = objs.map((o, i) => {
  const mesh = o.children[0]; const names = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(m => m.name);
  const mk = n => n === 'title_face' ? new THREE.MeshStandardMaterial({ color: 0x6a63e2, metalness: 0.55, roughness: 0.5, roughnessMap: brushTex, emissive: 0x3d37b0, emissiveIntensity: 0 })
    : n === 'title_chamfer' ? new THREE.MeshStandardMaterial({ color: 0xd4d6ff, metalness: 1, roughness: 0.14, emissive: EMBER, emissiveIntensity: 0 })
    : n === 'title_side' ? new THREE.MeshStandardMaterial({ color: 0x2a2478, metalness: 1, roughness: 0.4, emissive: 0xff4a12, emissiveIntensity: 0 })
    : new THREE.MeshStandardMaterial({ color: 0x14122e, metalness: 1, roughness: 0.5, emissive: 0xff4a12, emissiveIntensity: 0 });
  const mats = names.map(mk); mesh.material = mats; mesh.position.fromArray(data.letters[i].pos); mesh.position.y += OY; scene.add(mesh);
  return { mesh, mats, names, lit: 0, heat: 0, on: false, up: false, y0: mesh.position.y, slam: rj.slam[data.letters[i].char], land: rj.land[data.letters[i].char] };
});
const RF = rj.frames, fOff = []; { let o = 0; for (const f of RF) { fOff.push(o); o += f[1] * 3; } }
const NMAX = Math.max(...RF.map(f => f[1])) + 2, RAD = 6, rp = new Float32Array(NMAX * 3);
const ropeGeo = new THREE.BufferGeometry();
{
  const idx = []; for (let a = 0; a < NMAX - 1; a++) for (let b = 0; b < RAD; b++) { const p = a * RAD + b, q = a * RAD + (b + 1) % RAD; idx.push(p, p + RAD, q, q, p + RAD, q + RAD); }
  const uv = new Float32Array(NMAX * RAD * 2); for (let a = 0; a < NMAX; a++) for (let b = 0; b < RAD; b++) { uv[(a * RAD + b) * 2] = a * rj.ds / 0.07; uv[(a * RAD + b) * 2 + 1] = b / RAD; }
  ropeGeo.setIndex(idx); ropeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NMAX * RAD * 3), 3)); ropeGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
const rope = new THREE.Mesh(ropeGeo, new THREE.MeshBasicMaterial({ map: ropeTex, color: new THREE.Color(3.0, 1.15, 0.36), toneMapped: false }));
rope.frustumCulled = false; scene.add(rope);
// the cable at time tau (seconds of the title sequence): blend two baked frames point by point, then skin a tube round it
function ropeAt(tau) {
  const ff = clamp(tau * rj.fps, 0, RF.length - 1), f0 = Math.floor(ff), f1 = Math.min(RF.length - 1, f0 + 1), a = ff - f0;
  const na = RF[f0][1], nb = RF[f1][1], oa = fOff[f0], ob = fOff[f1], s = rj.scale, n = Math.max(na, nb), ha = oa + (na - 1) * 3;
  for (let i = 0; i < n; i++) {
    // a point the earlier frame does not have yet grows out of that frame's head
    const pa = i < na - 1 ? oa + i * 3 : ha, pb = i < nb - 1 ? ob + i * 3 : ob + (nb - 1) * 3;
    rp[i * 3] = (rb[pa] + (rb[pb] - rb[pa]) * a) * s; rp[i * 3 + 1] = (rb[pa + 1] + (rb[pb + 1] - rb[pa + 1]) * a) * s + OY; rp[i * 3 + 2] = (rb[pa + 2] + (rb[pb + 2] - rb[pa + 2]) * a) * s;
  }
  const P = ropeGeo.attributes.position.array, R = rj.radius; let nx = 0, ny = 0, nz = 1;
  for (let i = 0; i < n; i++) {
    const p = Math.max(0, i - 1) * 3, q = Math.min(n - 1, i + 1) * 3; let tx = rp[q] - rp[p], ty = rp[q + 1] - rp[p + 1], tz = rp[q + 2] - rp[p + 2];
    let l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
    const d = nx * tx + ny * ty + nz * tz; nx -= tx * d; ny -= ty * d; nz -= tz * d; l = Math.hypot(nx, ny, nz); if (l < 1e-4) { nx = ty; ny = -tx; nz = 0; l = Math.hypot(nx, ny) || 1; } nx /= l; ny /= l; nz /= l;
    const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
    for (let k = 0; k < RAD; k++) { const an = k / RAD * 6.2832, c = Math.cos(an) * R, sn = Math.sin(an) * R, o = (i * RAD + k) * 3; P[o] = rp[i * 3] + nx * c + bx * sn; P[o + 1] = rp[i * 3 + 1] + ny * c + by * sn; P[o + 2] = rp[i * 3 + 2] + nz * c + bz * sn; }
  }
  ropeGeo.attributes.position.needsUpdate = true; ropeGeo.setDrawRange(0, Math.max(0, n - 1) * RAD * 6);
  return n;
}
let car = null;
try { if (!q.has('nocar')) { car = await createCar(scene, renderer, GROUND, SPOT, { model: q.get('model') || '35' }); /* ?model=32 puts another car on the grid (QA) */ window.CAR = car; window.THREE = THREE; } } catch (e) { console.warn('car scene skipped: ' + e.message); }
let race = null;
if (car) try { race = await createRace(scene, renderer, GROUND, car, emit, glowTex); window.RACE = race; window.CAM = camera; window.SCENE = scene; } catch (e) { console.warn('race skipped: ' + e.message); }
const RED = new THREE.Color(5.5, 0.22, 0.1), GREEN = new THREE.Color(0.3, 5.0, 1.2);
const camQ = q.has('cam') ? q.get('cam').split(',').map(Number) : null;

/* ---------- scroll, pointer, camera ---------- */
const S = { t: 0, a: 0, b: 0, time: 0, px: 0, py: 0, tpx: 0, tpy: 0, u: 0, speed: 0, ignite: 0, frames: [] };
const forced = q.has('t') && isFinite(+q.get('t')) ? +q.get('t') : null;
addEventListener('pointermove', e => { S.tpx = e.clientX / innerWidth * 2 - 1; S.tpy = e.clientY / innerHeight * 2 - 1; S.moved = true; }, { passive: true });
const head = new THREE.Vector3(), prevHead = new THREE.Vector3(), P = new THREE.Vector3(), T = new THREE.Vector3(), camP = new THREE.Vector3(), camT = new THREE.Vector3();
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), right = new THREE.Vector3(), ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.55);
const audio = createAudio(); window.AUDIO = audio;
// one-shots on the scroll's beats: [part (t logo, c car, r race), position, sound, gain]
const CUES = [['t', 0.70, 'whoosh', 0.5], ['t', 0.80, 'rise', 0.45], ['c', 0.02, 'ignite', 0.5], ['c', 0.23, 'tap', 0.5], ['c', 0.70, 'start', 0.6], ['c', 0.815, 'blip', 0.45],
  ['r', 0.012, 'whoosh', 0.5], ['r', 0.13, 'charge', 0.5], ['r', 0.205, 'thunder', 0.7], ['r', 0.29, 'launch', 0.55], ['r', 0.325, 'boom', 0.6], ['r', 0.40, 'emp', 0.6], ['r', 0.425, 'sputter', 0.4],
  ['r', 0.455, 'whoosh', 0.5], ['r', 0.497, 'discdrop', 0.5], ['r', 0.512, 'discarm', 0.35], ['r', 0.53, 'disctrig', 0.5], ['r', 0.532, 'boom', 0.55], ['r', 0.572, 'spike', 0.5], ['r', 0.60, 'pop', 0.55],
  ['r', 0.648, 'decoy', 0.5], ['r', 0.655, 'beep', 0.25], ['r', 0.69, 'blast', 0.55], ['r', 0.697, 'decoyend', 0.4], ['r', 0.712, 'shieldup', 0.5], ['r', 0.725, 'beep', 0.25], ['r', 0.76, 'shieldhit', 0.6],
  ['r', 0.795, 'shielddown', 0.4], ['r', 0.80, 'whoosh', 0.5], ['r', 0.83, 'repair', 0.5], ['r', 0.868, 'squelch', 0.4], ['r', 0.895, 'crew', 0.5], ['r', 0.955, 'rise', 0.4]];
const was = { t: 0, c: 0, r: 0 };
const sndEl = document.getElementById('snd');
sndEl.addEventListener('click', async () => { if (audio.on) { audio.disable(); sndEl.textContent = 'Sound off'; sndEl.setAttribute('aria-pressed', 'false'); } else { sndEl.textContent = 'Sound…'; await audio.enable(); sndEl.textContent = 'Sound on'; sndEl.setAttribute('aria-pressed', 'true'); } });
const caps = [...document.querySelectorAll('[data-cap]')], garageEl = document.getElementById('garage'), homeEl = document.getElementById('home');
garageEl.addEventListener('click', e => {   // the garage: choices stay on the car for the rest of the page
  const b = e.target.closest('button'); if (!b || !car) return; const k = b.dataset.k, v = b.dataset.v;
  if (k === 'paint') car.userPaint = new THREE.Color(v); else if (k === 'rim') car.setRim(v); else if (k === 'glow') car.setGlow(v || null); else if (k === 'wing') car.setWing(v === '1');
  for (const x of garageEl.querySelectorAll(`button[data-k="${k}"]`)) x.classList.toggle('sel', x === b);
  audio.play(k === 'paint' || k === 'glow' ? 'tap' : 'clunk', 0.5);
});
homeEl.addEventListener('click', e => { if (e.target.closest('[data-enter]')) scrollTo({ top: innerHeight * 1.1, behavior: reduce ? 'instant' : 'smooth' }); });
const hint = document.getElementById('hint'), line = document.getElementById('line'), endEl = document.getElementById('end');
let first = true, last = performance.now(), prevZ = 0;

function frame(now) {
  const dt = clamp((now - last) / 1000, 0.001, 0.05); last = now; S.time += dt; adapt(dt); S.ratio = ratio; S.frames.push(dt); if (S.frames.length > 600) S.frames.shift();
  const max = document.documentElement.scrollHeight - innerHeight;
  S.t = forced != null ? forced : clamp(scrollY / Math.max(1, max));
  // two soft stages: a wheel notch becomes a glide, never a step
  const k = 1 - Math.exp(-dt / (reduce ? 0.1 : 0.2));
  if (first || forced != null) { S.a = S.b = S.t; } else { S.a += (S.t - S.a) * k; S.b += (S.a - S.b) * k; }
  const T1 = S.b, t = car ? Math.min(1, T1 / PA) : T1, c = car ? clamp((T1 - PA) / (PB - PA)) : 0, r = car ? clamp((T1 - PB) / (1 - PB)) : 0; S.c = c; S.r = r;
  S.ignite = Math.min(1, S.ignite + dt / 2.2);
  S.px += (S.tpx - S.px) * (1 - Math.exp(-dt / 0.25)); S.py += (S.tpy - S.py) * (1 - Math.exp(-dt / 0.25));

  // the wire
  const x = clamp((t - 0.015) / 0.45), u = Math.max(0.012 * ss(0, 1, S.ignite), x * x * (3 - 2 * x)); S.u = u;
  const tau = mix(0.27, rj.end, u), rn = ropeAt(tau); head.set(rp[(rn - 1) * 3], rp[(rn - 1) * 3 + 1], rp[(rn - 1) * 3 + 2]);
  const hv = head.distanceTo(prevHead) / dt; prevHead.copy(head);
  const flick = 0.85 + 0.15 * Math.sin(S.time * 31) * Math.sin(S.time * 17.3);
  const live = u < 0.999 ? 1 : 0.35;
  headLight.position.copy(head).add(v1.set(0, 0.05, 0.25)); headLight.intensity = 5 * flick * live * S.ignite;
  headGlow.position.copy(head); headGlow.scale.setScalar((0.2 + 0.04 * flick) * (0.6 + 0.4 * live)); headGlow.material.opacity = S.ignite;
  gU.headPos.value.copy(head); gU.headI.value = 1.4 * flick * live * S.ignite; gU.time.value = S.time;
  if (!first) emit(head, Math.min(14, Math.floor(hv * 2.2 + (rnd() < 0.25 * live ? 1 : 0))), 1.1 + Math.min(2.2, hv * 0.35));
  for (let i = 0; i < NS; i++) {
    if (sLife[i] <= 0) continue; sLife[i] -= dt; const j = i * 3;
    sVel[j + 1] -= 7.5 * dt; sPos[j] += sVel[j] * dt; sPos[j + 1] += sVel[j + 1] * dt; sPos[j + 2] += sVel[j + 2] * dt;
    if (sPos[j + 1] < GROUND + 0.01) { sPos[j + 1] = GROUND + 0.01; sVel[j + 1] *= -0.35; sVel[j] *= 0.6; sVel[j + 2] *= 0.6; }
    if (sLife[i] <= 0) sPos[j + 1] = -999;
  }
  sparkGeo.attributes.position.needsUpdate = true;

  // letters wake as the wire reaches them
  let litAll = 0;
  letters.forEach((L, i) => {
    // as in the title sequence: each letter slams in just before the cable reaches it, and wakes when the cable lands on it
    const drop = clamp((tau - (L.slam - 0.17)) / 0.17), up = drop > 0; L.mesh.visible = up; L.mesh.position.y = L.y0 + (1 - drop * drop) * 1.5;
    if (up && drop >= 1 && !L.up && !first) { emit(v1.copy(L.mesh.position).setY(L.y0 - 0.5), 14, 2.0); audio.play('slam', 0.5, 0.88 + i * 0.035); } L.up = up && drop >= 1;
    const on = tau >= L.land; if (on && !L.on && !first) { L.heat = 1; emit(v1.copy(L.mesh.position).setZ(0.2), 26, 2.6); audio.play('zap', 0.42, 0.92 + i * 0.03); } L.on = on;
    L.heat *= Math.exp(-dt / 0.55); L.lit += ((on ? 1 : 0) - L.lit) * (1 - Math.exp(-dt / 0.4)); litAll += L.lit / letters.length;
    L.mats.forEach((m, k) => { const n = L.names[k];
      m.envMapIntensity = 0.05 + L.lit * (n === 'title_chamfer' ? 1.3 : 0.9);
      if (n === 'title_face') m.emissive.setRGB(0.045 + L.heat * 0.9, 0.04 + L.heat * 0.22, 0.42 * (1 - L.heat * 0.8));
      m.emissiveIntensity = n === 'title_face' ? 0.5 * L.lit : n === 'title_chamfer' ? L.heat * 2.2 : 0.22 * L.lit + L.heat * 2.4; });
  });
  key.intensity = 2.6 * litAll;

  // camera: follow the hot end, pull back to the whole word, drop to the road and drive under it
  const asp = camera.aspect, heroFov = asp < 1 ? 58 : 31, wide = Math.max(1, 4.3 / (Math.tan(heroFov * Math.PI / 360) * asp) / 9.6);
  v1.copy(head).add(v2.set(-0.35, 0.3, 4.4 * Math.max(1, 1.1 / asp))); v1.y = Math.max(v1.y, GROUND + 0.16);
  const w1 = ss(0.44, 0.60, t), w2 = ss(0.68, 0.80, t), rr = clamp((t - 0.765) / 0.185), run = rr * rr * rr * (rr * (rr * 6 - 15) + 10);
  P.copy(v1).lerp(v2.set(0, -0.5 + OY * 0.7, 9.6 * wide), w1).lerp(v2.set(0, GROUND + 0.36, 3.2 - 314 * run), w2);
  T.copy(head).add(v2.set(0.5, -0.05, 0)).lerp(v2.set(0, -0.62 + OY * 0.8, 0), w1).lerp(v2.set(0, GROUND + 0.55, -30 - 314 * run), w2);
  // pointer: lean around the scene; a slow breath so it is never frozen
  const lean = reduce ? 0 : 1;
  right.subVectors(T, P).cross(camera.up).normalize();
  P.addScaledVector(right, S.px * (0.35 + 0.9 * w1) * (1 - w2 * 0.6) * lean + Math.sin(S.time * 0.31) * 0.03 * lean);
  P.y = Math.max(GROUND + 0.14, P.y - S.py * (0.12 + 0.3 * w1) * (1 - w2) * lean + Math.sin(S.time * 0.23) * 0.015 * lean);
  let wc = 0;
  if (car) { car.update(c, r, S.time, dt, S.px, S.py, reduce); if (race) race.update(r, S.time, dt, camera); wc = ss(0, 0.1, c); P.lerp(car.pos, wc); T.lerp(car.tgt, wc); goMat.color.lerpColors(RED, GREEN, car.go); rainMat.uniforms.nearF.value = 0.3 + car.inside * 2.4; }
  if (car && c > 0) {   // far from the logo now: its two point lights work for the car instead
    headLight.color.setHex(0xffb060); headLight.distance = 16; headLight.intensity = 26; car.group.localToWorld(headLight.position.copy(car.lampP));
    const inn = car.inside > 0.5;
    cursorLight.color.setHex(inn ? 0xffa860 : 0x7f95ff); cursorLight.distance = inn ? 1.7 : 14; cursorLight.intensity = inn ? 0.14 + car.ign * 0.5 : 3.5; car.group.localToWorld(cursorLight.position.copy(inn ? car.dashP : car.rimP));
  } else { headLight.color.setHex(0xff7a2a); headLight.distance = 7; cursorLight.color.setHex(0xc8d6ff); cursorLight.distance = 3.2; }
  if (camQ) { P.set(camQ[0], camQ[1], camQ[2]); T.set(camQ[3], camQ[4], camQ[5]); }
  const ck = first || forced != null || r > 0 ? 1 : mix(1 - Math.exp(-dt / 0.18), 1, car ? car.inside : 0);
  camP.lerp(P, ck); camT.lerp(T, ck);
  camera.position.copy(camP); camera.lookAt(camT);
  const vz = Math.abs(camP.z - prevZ) / dt; prevZ = camP.z;
  S.speed += ((first ? 0 : clamp(vz / 55) * (r > 0 ? 0.3 : 1)) - S.speed) * 0.1;
  // the street repeats around the camera once the car is moving; the road and its mirror follow
  const moving = car && (c > 0.86 || r > 0);
  if (moving || wrapped) { const zc = camP.z + 90; for (const w of wrapList) w.o.position.z = moving ? zc - ((((zc - w.z) % CITY_L) + CITY_L) % CITY_L) : w.z; wrapped = moving; }
  ground.position.z = camP.z - 200;
  if (car) { gU.carP.value.copy(car.group.position); gU.carI.value = car.headOn; }
  let fov = mix(mix(asp < 1 ? 60 : 42, heroFov, w1), asp < 1 ? 62 : 40, w2) + S.speed * 30 * (reduce ? 0.3 : 1) * (1 - wc);
  if (car) fov = mix(fov, Math.min(88, car.fov * (asp < 1 ? 1.5 : 1)), wc);
  if (camQ && camQ[6]) fov = camQ[6];
  camera.fov = fov; camera.updateProjectionMatrix();

  // pointer light on the metal
  ray.setFromCamera(v2.set(S.px, -S.py, 0), camera);
  if (!(car && c > 0) && ray.ray.intersectPlane(plane, v1)) cursorLight.position.copy(v1);
  if (!(car && c > 0)) { cursorLight.intensity = (S.moved ? 1.6 : 0) * (0.25 + 0.75 * litAll) * (1 - w2); }

  rainMat.uniforms.time.value = S.time; rainMat.uniforms.cam.value.copy(camP);
  lens.uniforms.time.value = S.time; lens.uniforms.speed.value = reduce ? 0 : S.speed; lens.uniforms.flash.value = race && !reduce ? race.flash : 0;
  const fade = car ? Math.max(ss(0.955, 0.995, r), (car.blink || 0) * 0.85) : ss(0.972, 0.998, t); if (skyRef) skyRef.position.copy(camP); lens.uniforms.fade.value = fade;
  bloom.strength = 0.42 + S.speed * 0.3;
  composer.render();

  hint.style.opacity = 0;
  line.style.opacity = t > 0.585 && t < 0.69 ? 1 : 0;
  const eo = car ? ss(0.965, 1, r) : ss(0.982, 1, t); endEl.style.opacity = eo; endEl.style.pointerEvents = eo > 0.6 ? 'auto' : 'none';
  const cp = race ? race.cap : ''; if (cp !== S.cap) { S.cap = cp; for (const el of caps) el.classList.toggle('on', el.dataset.cap === cp); }
  garageEl.classList.toggle('on', !!car && c > 0.07 && c < 0.6 && r === 0);
  if (audio.on) {
    const cur = { t, c, r };
    for (const [p, at, name, g] of CUES) if (was[p] < at && cur[p] >= at && cur[p] - was[p] < 0.25) audio.play(name, g);
    const L = car ? car.launch : 0, driving = r > 0 ? 1 - ss(0.95, 1, r) : 0;
    audio.loop('rain', 0.22 * (1 - 0.5 * (car ? car.inside : 0)));
    audio.loop('hum', c > 0 ? 0 : 0.2 * S.ignite * (u < 0.999 ? 1 : 0.4) * (1 - w2));
    audio.loop('engine', car ? Math.min(0.34, car.ign * 0.15 * (1 - driving) + L * 0.2 + driving * 0.3) : 0, 0.85 + L * 0.6 + (r > 0 ? 0.5 + 0.03 * Math.sin(S.time * 2.1) : 0));
    audio.loop('road', driving * 0.16 + L * 0.08 * (r > 0 ? 0 : 1));
    audio.meter();
  }
  was.t = t; was.c = c; was.r = r;
  homeEl.classList.toggle('on', S.t < 0.004 && S.ignite > 0.6);
  if (first) { first = false; loadEl.style.opacity = 0; setTimeout(() => loadEl.remove(), 1000); }
  requestAnimationFrame(frame);
}
await document.fonts.ready;
window.PROOF = S;
requestAnimationFrame(frame);
