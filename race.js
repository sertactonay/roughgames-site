/* The race part: the whole arsenal in one run, then the crew.
   Forward view: Strike, Seeker, EMP. The camera swings round to look back: Disc, Spike strip, Decoy, Shield.
   Forward again: Repair, then three friends pull alongside. Everything is placed relative to the player's car,
   which keeps driving by itself; `r` (0..1, from scroll) only says where in the sequence we are. */
import * as THREE from 'three';
import { createCar } from './car.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const win = (a, b, x, f = 0.012) => ss(a, a + f, x) * (1 - ss(b - f, b, x));
const after = (r0, r, k) => r >= r0 ? Math.exp(-(r - r0) * k) : 0;

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

export const CAPS = [['steer', 0.06, 0.115], ['strike', 0.125, 0.25], ['seeker', 0.27, 0.37], ['emp', 0.385, 0.455], ['disc', 0.49, 0.555], ['spike', 0.565, 0.63], ['decoy', 0.642, 0.705], ['shield', 0.712, 0.80], ['repair', 0.83, 0.885], ['crew', 0.895, 0.95]];

export async function createRace(scene, renderer, GROUND, car, emit, glowTex) {
  const spot = car.group.position.clone();
  const [A, B, C, ghost] = await Promise.all([
    createCar(scene, renderer, GROUND, spot, { model: '32', paint: 0x8f1218, plate: 'BRT 914', tailGain: 0.4 }), createCar(scene, renderer, GROUND, spot, { model: '21', paint: 0x0d0e12, plate: 'VLT 208', tailGain: 0.55 }),   // BRUTE, VELVET
    createCar(scene, renderer, GROUND, spot, { model: '33', paint: 0x0f5a3c, plate: 'KDE 733' }), createCar(scene, renderer, GROUND, spot, { ghost: true })]);              // the new sport car; the decoy is our own twin
  for (const c of [A, B, C, ghost]) c.group.visible = false;
  B.setRim(0x8a5a2b); C.setRim(0xc9ccd4);

  const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false };
  const flat = (tex, col, w = 1, h = 1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, color: col, ...add })); m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 3; scene.add(m); return m; };
  const spr = col => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, ...add })); s.visible = false; scene.add(s); return s; };
  // lock ring (Strike), pulse ring (EMP), mine (Disc), spike strip
  const ringTex = canvasTex(512, 512, (g, w) => {
    g.translate(w / 2, w / 2); g.strokeStyle = '#fff';
    g.lineWidth = 10; g.beginPath(); g.arc(0, 0, 236, 0, 6.2832); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 206, 0, 6.2832); g.stroke();
    g.lineWidth = 16; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(0, 0, 176, i * 1.5708 + 0.25, i * 1.5708 + 1.32); g.stroke(); }
    g.lineWidth = 4; for (let i = 0; i < 36; i++) { g.rotate(6.2832 / 36); g.beginPath(); g.moveTo(0, 214); g.lineTo(0, 228); g.stroke(); }
  });
  const waveTex = canvasTex(512, 512, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 150, w / 2, w / 2, 254); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.72, 'rgba(255,255,255,.12)'); gr.addColorStop(0.93, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  const discTex = canvasTex(256, 256, (g, w) => { g.translate(w / 2, w / 2); g.fillStyle = '#16130a'; g.beginPath(); g.arc(0, 0, 70, 0, 6.2832); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 70, 0, 6.2832); g.stroke(); g.fillStyle = '#fff'; for (let i = 0; i < 8; i++) { g.rotate(0.7854); g.fillRect(-5, 46, 10, 14); } g.lineWidth = 3; g.setLineDash([10, 12]); g.beginPath(); g.arc(0, 0, 118, 0, 6.2832); g.stroke(); });
  const spikeTex = canvasTex(512, 64, (g, w) => { g.fillStyle = '#fff'; g.fillRect(0, 26, w, 12); for (let x = 8; x < w; x += 26) { g.beginPath(); g.moveTo(x, 26); g.lineTo(x + 7, 2); g.lineTo(x + 14, 26); g.fill(); g.beginPath(); g.moveTo(x + 6, 38); g.lineTo(x + 13, 62); g.lineTo(x + 20, 38); g.fill(); } });
  const ring = flat(ringTex, new THREE.Color(2.4, 1.0, 5.0)), wave = flat(waveTex, new THREE.Color(0.5, 2.6, 4.5)), wave2 = flat(waveTex, new THREE.Color(0.5, 2.6, 4.5));
  const disc = flat(discTex, new THREE.Color(4.0, 2.6, 0.4)), spikes = flat(spikeTex, new THREE.Color(2.6, 2.8, 3.4), 3.4, 0.42);
  // the bolt: two drawn variants, flickered
  const bolts = [0, 1].map(k => canvasTex(128, 1024, (g, w, h) => {
    let s = 1; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const path = wd => { s = 77 + k * 31; g.lineWidth = wd; g.beginPath(); let x = w / 2; g.moveTo(x, 0); for (let y = 40; y <= h; y += 40) { x = clamp(x + (rnd() - 0.5) * 46, 24, w - 24); if (y >= h - 40) x = w / 2; g.lineTo(x, y); } g.stroke(); };
    g.lineJoin = 'miter'; g.strokeStyle = 'rgba(170,120,255,.5)'; path(18); g.strokeStyle = 'rgba(210,190,255,.9)'; path(7); g.strokeStyle = '#fff'; path(2.5);
  }));
  const boltGeo = new THREE.PlaneGeometry(2.4, 26); boltGeo.translate(0, 13, 0);
  const bolt = new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({ map: bolts[0], color: new THREE.Color(3.5, 2.6, 7), side: THREE.DoubleSide, ...add })); bolt.visible = false; scene.add(bolt);
  // honeycomb shell: amber for Shield, green with a sweeping band for Repair
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uI: { value: 0 }, uHit: { value: 0 }, uTime: { value: 0 }, uCol: { value: new THREE.Color() }, uCells: { value: 1 } },
    vertexShader: `varying vec3 vN, vV, vP; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uI, uHit, uTime, uCells; uniform vec3 uCol; varying vec3 vN, vV, vP;
      float hexD(vec2 p){ p = abs(p); return max(dot(p, vec2(0.5, 0.8660254)), p.x); }
      vec4 hexC(vec2 uv){ vec2 r = vec2(1.0, 1.7320508), h = r * 0.5; vec2 a = mod(uv, r) - h, b = mod(uv - h, r) - h; vec2 gv = dot(a,a) < dot(b,b) ? a : b; return vec4(gv, uv - gv); }
      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main(){ vec2 uv = vec2(atan(vP.x, vP.z) / 6.2832 * 30.0, acos(clamp(vP.y, -1.0, 1.0)) / 3.1416 * 15.0);
        vec4 hc = hexC(uv); float d = hexD(hc.xy); float edge = smoothstep(0.40, 0.48, d);
        float cell = hash(hc.zw); float pulse = 0.5 + 0.5 * sin(uTime * 3.0 + cell * 6.2832);
        float fres = pow(max(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0), 2.2);
        float band = smoothstep(0.25, 0.0, abs(vP.z - (1.0 - uHit * 2.4)));     // runs from the tail forward
        vec3 col = uCol * ((edge * 1.5 + cell * pulse * 0.18) * uCells + 0.05 + fres * 1.3) + mix(vec3(1.0, 0.9, 0.7), uCol * 1.6, 1.0 - uCells) * band * uHit * 3.0 * (0.3 + edge);
        gl_FragColor = vec4(col * uI * (0.55 + fres), 1.0); }`,
  }));
  shell.scale.set(1.45, 0.92, 2.95); shell.visible = false; shell.renderOrder = 4; scene.add(shell);
  const U = shell.material.uniforms, AMBER = new THREE.Color(1.0, 0.56, 0.12), MEND = new THREE.Color(0.2, 1.0, 0.5);
  const shot = [0, 1, 2].map(() => ({ head: spr(new THREE.Color(1.2, 6.0, 2.4)), tail: spr(new THREE.Color(0.4, 2.2, 0.9)) }));
  const fire = (o, on, p, q) => { o.head.visible = o.tail.visible = on; if (!on) return; o.head.position.copy(p); o.head.scale.setScalar(0.85 + 0.25 * Math.sin(performance.now() / 22)); o.tail.position.copy(p).lerp(q, 0.12); o.tail.scale.setScalar(1.6); };

  const v = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), done = {}; let lastB = 0;
  const once = (id, r0, r, fn) => { if (r >= r0 && r < r0 + 0.05) { if (!done[id]) { done[id] = true; fn(); } } else if (r < r0 - 0.004) done[id] = false; };
  const api = { flash: 0, cap: '',
    update(r, time, dt, camera) {
      const cp = car.group.position, on = r > 0, X = cp.x - car.steer;     // X: the centre of the player's lane
      const put = (c, x, z, vis, yaw = 0, lift = 0) => { c.group.visible = on && vis; if (!c.group.visible) return; c.group.position.set(X + x, cp.y + lift, cp.z + z); c.group.rotation.y = yaw; c.spin(dt, 58); };
      const wob = k => k > 0 && k < 1 ? Math.sin(k * 16) * (1 - k) : 0;
      let flash = 0;

      // ---- cars ----
      const crew = ss(0.865, 0.925, r);
      const kA = clamp((r - 0.215) / 0.07), kAd = clamp((r - 0.53) / 0.045);
      if (r < 0.34) put(A, -3.6 + wob(kA) * 0.5, mix(mix(-80, -8.5, ss(0.07, 0.13, r)), 40, ss(0.225, 0.30, r)), r > 0.05 && r < 0.31, wob(kA) * 0.16);
      else if (r < 0.80) put(A, -2.3 + wob(kAd) * 0.7, mix(mix(60, 8.5, ss(0.44, 0.49, r)), 75, ss(0.535, 0.59, r)), r > 0.44 && r < 0.59, wob(kAd) * 0.35, Math.sin(clamp(kAd) * Math.PI) * 0.7);
      else put(A, -3.6, mix(45, -4.5, crew), r > 0.86);
      A.lights(6 + 10 * win(0.218, 0.27, r), r > 0.4 && r < 0.8 ? 0.55 : 2.4);
      const kB = clamp((r - 0.325) / 0.07), kBs = clamp((r - 0.60) / 0.06);
      if (r < 0.46) put(B, -3.6 + wob(kB) * 0.6, mix(mix(-80, -12, ss(0.22, 0.28, r)), 45, ss(0.33, 0.41, r)), r > 0.22 && r < 0.42, wob(kB) * 0.2);
      else if (r < 0.80) put(B, -2.3 + wob(kBs) * 1.1, mix(mix(60, 8.5, ss(0.55, 0.585, r)), 75, ss(0.61, 0.66, r)), r > 0.55 && r < 0.66, wob(kBs) * 0.3);
      else put(B, -7.0, mix(60, -9.5, crew), r > 0.86);
      B.lights(6 + 10 * win(0.326, 0.38, r), r > 0.4 && r < 0.8 ? 0.55 : 2.4);
      const dead = win(0.425, 0.52, r, 0.004);
      if (r < 0.56) put(C, -3.6, mix(mix(50, -1.5, ss(0.34, 0.39, r)), 60, ss(0.445, 0.51, r)), r > 0.34 && r < 0.52);
      else if (r < 0.845) put(C, -2.6, mix(mix(60, 12, ss(0.625, 0.65, r)), 70, ss(0.78, 0.83, r)), r > 0.625 && r < 0.83);
      else put(C, -3.6, mix(-70, -14, crew), r > 0.86);
      C.lights(6 * (1 - dead), (r > 0.56 && r < 0.845 ? 0.55 : 2.4) * (1 - dead));

      // ---- Strike ----
      const ra = win(0.13, 0.24, r, 0.02), ap = A.group.position;
      ring.visible = on && ra > 0.01;
      if (ring.visible) { const sc = mix(9.5, 5.2, ss(0.135, 0.20, r)); ring.scale.set(sc, sc, 1); ring.position.set(ap.x, GROUND + 0.03, ap.z); ring.rotation.z = time * 1.4; ring.material.opacity = ra * (0.75 + 0.25 * Math.sin(time * 20) * ss(0.19, 0.205, r)); }
      const hit = r > 0.205 && r < 0.229;
      bolt.visible = on && hit && Math.sin(time * 70) > -0.35;
      if (hit) { bolt.position.set(ap.x, GROUND, ap.z); bolt.rotation.y = Math.atan2(camera.position.x - ap.x, camera.position.z - ap.z); if (time - lastB > 0.06) { lastB = time; bolt.material.map = bolts[Math.random() * 2 | 0]; bolt.scale.x = Math.random() < 0.5 ? 1 : -1; emit(v.set(ap.x, GROUND + 0.9, ap.z), 6, 3.2); } }
      if (bolt.visible) flash = 0.07;

      // ---- Seeker (ours) ----
      const s0 = clamp((r - 0.29) / 0.035), bp = B.group.position;
      v.set(cp.x, cp.y + 0.7, cp.z - 2.6); v2.set(bp.x, bp.y + 0.8, bp.z + 2.2);
      fire(shot[0], on && s0 > 0 && s0 < 1, v3.copy(v).lerp(v2, s0 * s0), v);
      once('seek', 0.325, r, () => emit(v.set(bp.x, bp.y + 0.8, bp.z + 2), 46, 4.4)); flash = Math.max(flash, after(0.325, r, 55) * 0.06);

      // ---- EMP ----
      const e1 = clamp((r - 0.40) / 0.05), e2 = clamp((r - 0.415) / 0.05);
      for (const [m, e] of [[wave, e1], [wave2, e2]]) { m.visible = on && e > 0 && e < 1; if (m.visible) { const sc = mix(3, 30, e); m.scale.set(sc, sc, 1); m.position.set(cp.x, GROUND + 0.04, cp.z); m.material.opacity = (1 - e) * (1 - e); } }
      flash = Math.max(flash, after(0.40, r, 90) * 0.06);

      // ---- Disc: dropped behind, the car on your tail finds it ----
      const dk = ss(0.50, 0.53, r);
      disc.visible = on && r > 0.497 && r < 0.531;
      if (disc.visible) { disc.scale.setScalar(3.2); disc.position.set(X + mix(0, -2.3, dk), GROUND + 0.035, cp.z + mix(2.8, 8.5, dk)); disc.rotation.z = time * 2; disc.material.opacity = 0.75 + 0.25 * Math.sin(time * 26); }
      once('disc', 0.53, r, () => emit(v.set(X - 2.3, GROUND + 0.5, cp.z + 8.5), 60, 5.2)); flash = Math.max(flash, after(0.53, r, 55) * 0.06);

      // ---- Spike strip ----
      spikes.visible = on && r > 0.572 && r < 0.602;
      if (spikes.visible) spikes.position.set(X - 1.3, GROUND + 0.035, cp.z + mix(2.8, 8.5, ss(0.575, 0.60, r)));
      if (on && r > 0.60 && r < 0.645 && Math.random() < 0.5) emit(v.set(bp.x + (Math.random() - 0.5) * 1.8, GROUND + 0.1, bp.z - 1.4), 3, 2.2);

      // ---- Decoy: the twin slides out and takes the lock ----
      const gv = win(0.648, 0.70, r, 0.006), gx = mix(0, 3.5, ss(0.65, 0.672, r));
      ghost.group.visible = on && gv > 0.01;
      if (ghost.group.visible) { ghost.group.position.set(cp.x + gx, cp.y, cp.z); ghost.group.rotation.y = car.group.rotation.y; ghost.group.userData.ghost.opacity = gv * (0.3 + 0.08 * Math.sin(time * 34)) * (r > 0.69 ? 0.5 + 0.5 * Math.sin(time * 90) : 1); }
      const cpos = C.group.position, s1 = clamp((r - 0.655) / 0.035);
      v.set(cpos.x, cpos.y + 0.7, cpos.z - 2.4); v2.set(cp.x + gx, cp.y + 0.8, cp.z + 2.6);
      fire(shot[1], on && s1 > 0 && s1 < 1, v3.copy(v).lerp(v2, s1), v);
      once('decoy', 0.69, r, () => emit(v.set(cp.x + gx, cp.y + 0.8, cp.z + 2), 46, 4.4)); flash = Math.max(flash, after(0.69, r, 60) * 0.05);

      // ---- Shield, then Repair (the same shell, mended green) ----
      const si = win(0.712, 0.80, r, 0.03), hk = after(0.76, r, 38), mend = win(0.825, 0.89, r, 0.012), mp = clamp((r - 0.83) / 0.05);
      shell.visible = on && (si > 0.01 || mend > 0.01);
      if (shell.visible) { shell.position.set(cp.x, cp.y + 0.5, cp.z); shell.rotation.y = car.group.rotation.y; U.uTime.value = time;
        if (si > 0.01) { U.uCol.value.copy(AMBER); U.uCells.value = 1; U.uI.value = si * (0.7 + hk * 0.3); U.uHit.value = hk * 0.6; }
        else { U.uCol.value.copy(MEND); U.uCells.value = 0.12; U.uI.value = mend * 0.55; U.uHit.value = mp * 0.83; } }
      const s2 = clamp((r - 0.725) / 0.035);
      v.set(cpos.x, cpos.y + 0.7, cpos.z - 2.4); v2.set(cp.x, cp.y + 0.85, cp.z + 3.0);
      fire(shot[2], on && s2 > 0 && s2 < 1, v3.copy(v).lerp(v2, s2), v);
      once('shield', 0.76, r, () => emit(v.set(cp.x, cp.y + 0.8, cp.z + 3.0), 40, 4.2)); flash = Math.max(flash, hk * 0.05);

      api.flash = on ? flash : 0;
      let cap = ''; for (const [id, a, b] of CAPS) if (r > a && r < b) cap = id; api.cap = cap;
    } };
  return api;
}
