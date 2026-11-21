/* Rough Games, the contact page: the word CONTACT on the wall and three steel plates skimmed over with render. Rubbing a plate
   with the pointer (or a finger) scrapes the render off in chips and uncovers what is written on the steel; a cleared plate is
   a link. The same links exist in the page as ordinary, focusable links, and focusing one clears its plate. */
import { THREE, createWorld, reduce, fine, clamp, ss, mix, rnd } from './world.js';

// Where each plate leads. An empty href shows the plate as not opened yet (no link is invented).
const PLATES = [
  { name: 'Instagram', sub: '', href: '' },
  { name: 'LinkedIn', sub: '', href: '' },
  { name: 'Support', sub: 'support@roughgames.studio', href: 'mailto:support@roughgames.studio' },
];

const PW0 = 3.6, PH0 = 1.8;
const W = createWorld(), { scene, camera, canvas } = W; W.lampPower = 85;
const wall = W.surface('cast', { skin: 'plain', tile: 3.2, weather: 0.3, normal: 1.35 });      // plain site-cast concrete: pale, flat, faint horizontal board lines
const cast = W.surface('cast', { tile: 3, weather: 0.5, color: 0xb4b2ac });
const steel = W.surface('rust', { tile: 2.2, metal: 0.22, normal: 1.2 });
const skim = W.surface('cast', { tile: 3, color: 0xe9e2d5, normal: 1.3 });
const enamel = new THREE.MeshStandardMaterial({ color: 0x0e0e12, roughness: 1, metalness: 0 });
const boltM = new THREE.MeshStandardMaterial({ color: 0xc4bfb6, roughness: 0.3, metalness: 0.95 });
const washerM = new THREE.MeshStandardMaterial({ color: 0x77726b, roughness: 0.45, metalness: 0.9 });
const letterM = new THREE.MeshStandardMaterial({ color: 0xdcd6ca, roughness: 0.4, metalness: 0.7 });
// a plate: a slab of dark steel with bevelled edges, standing off the wall on four spacers, held by four hex bolts
const plateGeo = (() => { const w = PW0 / 2, h = PH0 / 2, r = 0.07, sh = new THREE.Shape(); sh.moveTo(-w + r, -h); sh.lineTo(w - r, -h); sh.quadraticCurveTo(w, -h, w, -h + r); sh.lineTo(w, h - r); sh.quadraticCurveTo(w, h, w - r, h); sh.lineTo(-w + r, h); sh.quadraticCurveTo(-w, h, -w, h - r); sh.lineTo(-w, -h + r); sh.quadraticCurveTo(-w, -h, -w + r, -h);
  return new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.016, bevelSize: 0.016, bevelSegments: 3, curveSegments: 6 }); })();
const washerGeo = new THREE.CylinderGeometry(0.105, 0.105, 0.016, 24), headGeo = new THREE.CylinderGeometry(0.068, 0.068, 0.05, 6), capGeo = new THREE.CylinderGeometry(0.046, 0.068, 0.016, 6), postGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.1, 12);
const ZF = 0.176, ZC = 0.224;                    // the plate's face, and the render lying over it

W.facade(-60, 60, -27, 45, 0, 2, { face: wall, body: cast, pour: () => [0, 0], ties: false });
const name = W.word('CONTACT', 0, 2.75, 0, 0.26, 0.45, steel);

/* ---------- the plates ---------- */
const PW = 3.6, PH = 1.8, MW = 512, MH = 256, XS = [-4.2, 0, 4.2];
const blob = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(0.55, 'rgba(0,0,0,.8)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return c; })();
PLATES.forEach((p, i) => {
  const grp = p.grp = new THREE.Group(); scene.add(grp); p.i = i; p.done = 0; p.cleared = 0; p.hot = 0; p.lit = 0;
  const base = new THREE.Mesh(plateGeo, enamel); base.position.z = 0.1; base.castShadow = base.receiveShadow = true; grp.add(base);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const x = sx * (PW / 2 - 0.19), y = sy * (PH / 2 - 0.19), b = new THREE.Group(); b.position.set(x, y, ZF); b.rotation.z = rnd() * 1.05; grp.add(b);
    const post = new THREE.Mesh(postGeo, washerM); post.rotation.x = Math.PI / 2; post.position.set(x, y, 0.05); post.castShadow = true; grp.add(post);
    for (const [g, m, z] of [[washerGeo, washerM, 0.008], [headGeo, boltM, 0.041], [capGeo, boltM, 0.074]]) { const q = new THREE.Mesh(g, m); q.rotation.x = Math.PI / 2; q.position.z = z; q.castShadow = q.receiveShadow = true; b.add(q); } }
  // the name stands off the plate in real letters; the line under it is painted
  const U = 0.07; W.word(p.name.toUpperCase(), -PW / 2 + 0.3 + W.wordWidth(p.name.toUpperCase(), U) / 2, 0.02, ZF, U, 0.045, letterM, grp);
  const label = W.paint(1024, 512, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#ece6da'; g.textBaseline = 'alphabetic';
    g.fillRect(86, 296, 120, 5); g.font = '600 40px SairaSC, Inter, sans-serif'; g.fillStyle = p.href ? '#ece6da' : '#9a9286'; g.fillText(p.sub || (p.href ? '' : 'Opening soon'), 86, 372); });
  p.face = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshStandardMaterial({ map: label, transparent: true, roughness: 0.7, emissive: 0xffffff, emissiveMap: label, emissiveIntensity: 0.25, depthWrite: false })); p.face.position.z = ZF + 0.003; grp.add(p.face);
  // the render over the plate: a mask decides where it is still there
  const mc = p.mask = document.createElement('canvas'); mc.width = MW; mc.height = MH; const mg = p.mg = mc.getContext('2d');
  const id = mg.createImageData(MW, MH); for (let k = 0; k < MW * MH; k++) { const v = 150 + rnd() * 105; id.data[k * 4] = id.data[k * 4 + 1] = id.data[k * 4 + 2] = v; id.data[k * 4 + 3] = 255; } mg.putImageData(id, 0, 0);
  mg.filter = 'blur(1.6px)'; mg.drawImage(mc, 0, 0); mg.filter = 'none';
  p.alpha = new THREE.CanvasTexture(mc);
  const cm = skim.clone(); cm.alphaMap = p.alpha; cm.alphaTest = 0.5; cm.onBeforeCompile = skim.onBeforeCompile;
  const cg = new THREE.PlaneGeometry(PW + 0.06, PH + 0.06), uv = cg.attributes.uv, ox = rnd(), oy = rnd(); for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 1.2 + ox, uv.getY(k) * 0.6 + oy);      // the photograph at its true scale, a different patch per plate;
  p.alpha.repeat.set(1 / 1.2, 1 / 0.6); p.alpha.offset.set(-ox / 1.2, -oy / 0.6);                                              // the mask undoes that and covers the plate once
  p.coat = new THREE.Mesh(cg, cm); p.coat.position.z = ZC; p.coat.castShadow = p.coat.receiveShadow = true; grp.add(p.coat);
  // someone has already had a go at one corner: the steel shows, so it is clear what to do
  let s = 5 + i * 13; const r = () => (s = (s * 16807) % 2147483647) / 2147483647, x0 = MW * (0.72 + 0.12 * r()), y0 = MH * (0.2 + 0.2 * r());
  for (let k = 0; k < 9; k++) scrape(p, (x0 + k * 9 + r() * 6) / MW, 1 - (y0 + k * 6 + r() * 8) / MH, 0.6, true);
});
function scrape(p, u, v, size = 1, quiet) {
  const g = p.mg, n = quiet ? 1 : 3; g.globalAlpha = 0.8;
  for (let k = 0; k < n; k++) { const r = (20 + rnd() * 26) * size, x = u * MW + (rnd() - 0.5) * 22 * size, y = (1 - v) * MH + (rnd() - 0.5) * 22 * size; g.drawImage(blob, x - r, y - r, r * 2, r * 2); }
  g.globalAlpha = 1; p.alpha.needsUpdate = true; p.dirty = true;
}
const probe = document.createElement('canvas'); probe.width = 32; probe.height = 16; const pg = probe.getContext('2d', { willReadFrequently: true });
function measure(p) { pg.drawImage(p.mask, 0, 0, 32, 16); const d = pg.getImageData(0, 0, 32, 16).data; let n = 0; for (let k = 0; k < d.length; k += 4) if (d[k] < 128) n++; p.cleared = n / 512; p.dirty = false; if (p.cleared > 0.58 && !p.done) finish(p); }
function finish(p) { if (p.done) return; p.done = W.time || 0.001; live.textContent = p.href ? `${p.name} uncovered: ${p.sub || 'link ready'}` : `${p.name} uncovered: opening soon`; }

/* ---------- chips ---------- */
const CN = 500, cp = new Float32Array(CN * 3), cv = new Float32Array(CN * 3), cl = new Float32Array(CN); let ci = 0;
for (let i = 0; i < CN; i++) cp[i * 3 + 1] = -999;
const chips = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(cp, 3)), new THREE.PointsMaterial({ color: 0xd8d0c2, size: 0.055, sizeAttenuation: true })); chips.frustumCulled = false; scene.add(chips);
function chip(x, y, n = 3) { if (reduce) return; for (let k = 0; k < n; k++) { const j = ci = (ci + 1) % CN; cp[j * 3] = x + (rnd() - 0.5) * 0.2; cp[j * 3 + 1] = y + (rnd() - 0.5) * 0.2; cp[j * 3 + 2] = ZC + 0.04; cv[j * 3] = (rnd() - 0.5) * 1.6; cv[j * 3 + 1] = rnd() * 1.4; cv[j * 3 + 2] = 0.4 + rnd() * 1.4; cl[j] = 1.6; } }

/* ---------- pointing, rubbing, opening ---------- */
const live = document.getElementById('live'), hint = document.querySelector('.hint'), foot = document.querySelector('.foot'), hit = new THREE.Vector3(), P = new THREE.Vector3(), T = new THREE.Vector3(), v = new THREE.Vector3();
function plateAt(sx, sy) { if (!W.pointAt(ZC, hit, sx, sy)) return null; for (const p of PLATES) { const u = (hit.x - p.grp.position.x) / PW + 0.5, w = (hit.y - p.grp.position.y) / PH + 0.5; if (u > 0 && u < 1 && w > 0 && w < 1) return { p, u, w }; } return null; }
let lastHit = null;
function rub(sx, sy) {
  const h = plateAt(sx, sy); if (!h || h.p.done) { lastHit = null; return h; }
  if (lastHit && lastHit.p === h.p) { const d = Math.hypot((h.u - lastHit.u) * MW, (h.w - lastHit.w) * MH), n = Math.min(8, Math.ceil(d / 16)); for (let k = 1; k <= n; k++) scrape(h.p, mix(lastHit.u, h.u, k / n), mix(lastHit.w, h.w, k / n)); if (d > 3) chip(hit.x, hit.y, Math.min(5, 1 + (d / 14 | 0))); }
  else scrape(h.p, h.u, h.w);
  lastHit = h; S.used = true; return h;
}
const aim = new THREE.Vector3(), S = { used: false, over: null }, N = e => [e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1];
canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { const h = rub(...N(e)); S.over = h && h.p.done ? h.p : null; } });
canvas.addEventListener('pointerleave', () => { lastHit = null; S.over = null; });
canvas.addEventListener('touchstart', e => { const t = e.touches[0], h = plateAt(...N(t)); if (h && !h.p.done) { e.preventDefault(); S.touch = true; lastHit = null; rub(...N(t)); } }, { passive: false });     // a finger on the render rubs; anywhere else it scrolls
canvas.addEventListener('touchmove', e => { if (S.touch) { e.preventDefault(); rub(...N(e.touches[0])); } }, { passive: false });
canvas.addEventListener('touchend', () => { S.touch = false; lastHit = null; });
canvas.addEventListener('click', e => { const h = plateAt(...N(e)); if (h && h.p.done && W.time - h.p.done > 0.5 && h.p.href) { if (h.p.href.startsWith('mailto:')) location.href = h.p.href; else open(h.p.href, '_blank', 'noopener'); } });
document.querySelectorAll('[data-plate]').forEach(a => { const p = PLATES[+a.dataset.plate]; a.addEventListener('focus', () => { finish(p); p.focus = true; }); a.addEventListener('blur', () => { p.focus = false; }); });

let acc = 0;
W.start((dt, go) => {
  const t = W.t, asp = camera.aspect, port = asp < 1, fov = port ? 58 : 34, tan = Math.tan(fov * Math.PI / 360);
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  PLATES.forEach((p, i) => p.grp.position.set(port ? 0 : XS[i], port ? -0.9 - 2.4 * i : -0.1, 0));
  if (port) { const a = ss(0.03, 0.3, t), d = clamp((t - 0.3) / 0.7); P.set(0, 3.2, 5.7 / (tan * asp)).lerp(v.set(0, mix(-0.9, -5.7, d), 2.15 / (tan * asp)), a); T.set(0, 3.2, 0).lerp(v.set(0, mix(-0.9, -5.7, d), 0), a); }
  else { const z = Math.max(7.0 / (tan * asp), 3.7 / tan); P.set(W.px * 0.6, 1.45 - W.py * 0.3, z); T.set(0, 1.45, 0); }
  camera.position.copy(P); camera.lookAt(T);
  W.idle = [0, port ? 0 : 0.15, 0.4, 0.3]; W.aimLamp(0);

  const aimed = !!W.pointAt(ZC, aim) && (fine ? W.moved : true);
  acc += dt; if (acc > 0.12) { acc = 0; for (const p of PLATES) if (p.dirty && !p.done) measure(p); }
  for (const p of PLATES) {
    if (p.done && p.coat.visible) {                 // the rest of the render lets go
      const k = W.time - p.done; p.mg.globalAlpha = reduce ? 1 : 0.22; p.mg.fillStyle = '#000'; p.mg.fillRect(0, 0, MW, MH); p.mg.globalAlpha = 1; p.alpha.needsUpdate = true;
      if (k < 0.5) chip(p.grp.position.x + (rnd() - 0.5) * PW, p.grp.position.y + (rnd() - 0.5) * PH, 6); if (k > 0.7 || reduce) p.coat.visible = false;
    }
    const on = p.done && (S.over === p || p.focus) && p.href ? 1 : 0; p.hot += (on - p.hot) * (1 - Math.exp(-dt / 0.15)); p.lit += ((p.done ? 1 : 0) - p.lit) * (1 - Math.exp(-dt / 0.5));
    p.face.material.emissiveIntensity = 0.12 + 0.3 * p.lit + 0.6 * p.hot; p.grp.position.z = 0.08 * p.hot;
    // the plate turns a little toward the pointer, so its edges, bolts and letters catch the light as real depth
    const dx = (aim.x - p.grp.position.x) / PW, dy = (aim.y - p.grp.position.y) / PH, nearP = aimed ? Math.exp(-(dx * dx + dy * dy * 2.5) * 2.2) : 0, idle = reduce ? 0 : 0.035 * Math.sin(W.time * 0.7 + p.i * 2.1);
    const k2 = 1 - Math.exp(-dt / 0.14); p.grp.rotation.y += (clamp(dx, -0.7, 0.7) * 0.42 * nearP + idle - p.grp.rotation.y) * k2; p.grp.rotation.x += (-clamp(dy, -0.7, 0.7) * 0.3 * nearP - p.grp.rotation.x) * k2;
  }
  canvas.style.cursor = S.over && S.over.href ? 'pointer' : '';
  for (let j = 0; j < CN; j++) if (cl[j] > 0) { cl[j] -= dt; cv[j * 3 + 1] -= 9.8 * dt; cp[j * 3] += cv[j * 3] * dt; cp[j * 3 + 1] += cv[j * 3 + 1] * dt; cp[j * 3 + 2] += cv[j * 3 + 2] * dt; if (cl[j] <= 0) cp[j * 3 + 1] = -999; }
  chips.geometry.attributes.position.needsUpdate = true;

  const since = W.shownAt != null ? W.time - W.shownAt : -1;
  name.forEach((L, i) => { const k = clamp((since - 0.2 - i * 0.07) / 0.5); L.grp.position.z = reduce ? 0 : (1 - k) * (1 - k) * 6; L.grp.visible = k > 0 || reduce; });
  if (hint) hint.style.opacity = (since > 1.2 && !PLATES.every(p => p.done) ? 1 : 0) * (port ? ss(0.2, 0.32, t) : 1);
  if (foot) { const f = port ? ss(0.9, 0.99, t) : 1; foot.style.opacity = f; foot.style.pointerEvents = f > 0.5 ? 'auto' : 'none'; }
  const cue = document.querySelector('.cue'); if (cue) cue.style.opacity = port ? (since > 1.6 ? 1 : 0) * (1 - ss(0, 0.03, W.raw)) : 0;
});
window.HOME = W; W.PLATES = PLATES;
W.rect = i => { const p = PLATES[i].grp.position, a = new THREE.Vector3(p.x - PW / 2, p.y + PH / 2, 0.12).project(camera), b = new THREE.Vector3(p.x + PW / 2, p.y - PH / 2, 0.12).project(camera); return [(a.x + 1) / 2, (1 - a.y) / 2, (b.x + 1) / 2, (1 - b.y) / 2].map(n => +n.toFixed(3)); };     // for tests: a plate's place on screen
