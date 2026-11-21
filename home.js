/* Rough Games, the studio home: the face of a brutalist building. The page opens on a bare wall; scrolling drives the name into it
   letter by letter, then lowers the camera
   under the overhang to three bays behind roller shutters (the games), then to the foot of the wall and two doors (Studio,
   Contact). Nothing here belongs to Hotwire; its logo only appears when its shutter is raised. */
import { THREE, createWorld, reduce, fine, clamp, ss, mix, rnd } from './world.js';

const W = createWorld(), { scene, camera, canvas } = W;
const wall = W.surface('cast', { skin: 'plain', tile: 3.2, weather: 0.3, normal: 1.35 });      // plain site-cast concrete: pale, flat, faint horizontal board lines
const cast = W.surface('cast', { tile: 3, weather: 0.5, color: 0xb4b2ac });
const deep = W.surface('cast', { tile: 3, color: 0x6f6a62 });
const floorM = W.surface('cast', { tile: 3.4, color: 0x86807a, rough: 0.82 });
const steel = W.surface('rust', { tile: 2.2, metal: 0.22, normal: 1.2 });
const shutterM = W.surface('shutter', { tile: 2, metal: 0.2, color: 0xb9bcbd });
const doorM = W.surface('rust', { tile: 3.1, metal: 0.3, color: 0x8d8780 });
const dark = new THREE.MeshStandardMaterial({ color: 0x17171a, roughness: 0.55, metalness: 0.6 });

/* ---------- the building ---------- */
const Y1 = -3.0, FLOOR = -15.0, ZB = -1.2;       // underside of the overhang, the ground, the set-back face the bays are cut into
const BAYS = [-7.2, 0, 7.2].map((x, i) => ({ i, x, x0: x - 2.4, x1: x + 2.4, y0: -7.8, y1: -4.2, open: 0, want: 0, kick: 0, glow: 0 }));
const DOORS = [{ x: -3.6, word: 'STUDIO', href: 'studio.html' }, { x: 3.6, word: 'CONTACT', href: 'contact.html' }].map(d => ({ ...d, x0: d.x - 1.2, x1: d.x + 1.2, y0: FLOOR, y1: -10.2, hot: 0 }));
const pour = (cx, cy) => { const u = cx + 9.6, k = Math.floor(u / 7.2), m = u - k * 7.2; return [k * 2 + (m < 4.8 ? 0 : 1), Math.floor((cy + 7.8) / 3.6)]; };     // a 4.8 m pour over each bay, a 2.4 m pour over each pier
{
  W.facade(-60, 60, Y1, 45, 0, 3, { face: wall, body: cast, backs: deep, pour: () => [0, 0], ties: false });
  W.facade(-60, 60, FLOOR, Y1, ZB, 3, { holes: [...BAYS.map(b => [b.x0, b.x1, b.y0, b.y1, 1.8]), ...DOORS.map(d => [d.x0, d.x1, d.y0, d.y1, 2.4])], face: wall, body: cast, backs: deep, pour: () => [0, 0], ties: false });
  for (let x = 3.6; x < 60; x += 7.2) for (const s of [-1, 1]) W.slab(0.6, 5.4, 1.2, s * x, -5.7, -0.6, cast);      // fins between the bays, flush with the overhang
  W.slab(120, 0.6, 1.5, 0, -8.1, ZB + 0.75, cast);                                                               // the sill the bays stand on
  W.slab(160, 1, 90, 0, FLOOR - 0.5, 34, floorM, false);
}
const name = [...W.word('ROUGH', 0, 2.6, 0, 0.5, 0.9, steel), ...W.word('GAMES', 0, -1.4, 0, 0.5, 0.9, steel)];
name.forEach((L, i) => { L.thr = 0.006 + i * 0.013; L.y = L.grp.position.y; L.a = 0; L.kick = 0; L.grp.visible = false; });      // the page opens on a bare wall; each letter is driven in at its own point of the scroll
// what a letter knocks out of the wall when it lands
const BN = 480, bp = new Float32Array(BN * 3), bv = new Float32Array(BN * 3), bl = new Float32Array(BN); let bi = 0; for (let i = 0; i < BN; i++) bp[i * 3 + 1] = -999;
const grit = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(bp, 3)), new THREE.PointsMaterial({ color: 0xcfcac0, size: 0.085, sizeAttenuation: true })); grit.frustumCulled = false; scene.add(grit);
function burst(L) { for (let k = 0; k < 34; k++) { const j = bi = (bi + 1) % BN, ang = rnd() * 6.283, r = 0.9 + rnd() * 0.9; bp[j * 3] = L.cx + Math.cos(ang) * r; bp[j * 3 + 1] = L.grp.position.y + 1.5 + Math.sin(ang) * r * 1.4; bp[j * 3 + 2] = 0.15;
  bv[j * 3] = Math.cos(ang) * (1 + rnd() * 3); bv[j * 3 + 1] = Math.sin(ang) * (1 + rnd() * 3) + 1.5; bv[j * 3 + 2] = 1.5 + rnd() * 5; bl[j] = 0.7 + rnd() * 0.7; } }
const IMP = { shake: 0, flash: 0 };
W.lampPower = 80;
const LIFT = 15.6;      // on an upright phone the name hangs higher on the wall, so the opening shows the name and nothing under it

/* ---------- the bays: a roller shutter each, a number stencilled on it ---------- */
const spill = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'), l = g.createLinearGradient(0, 0, 0, 256);
  l.addColorStop(0, 'rgba(255,255,255,.55)'); l.addColorStop(0.5, 'rgba(255,255,255,1)'); l.addColorStop(0.62, 'rgba(255,255,255,.5)'); l.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = l; g.fillRect(0, 0, 64, 256);
  const s = g.createLinearGradient(0, 0, 64, 0); s.addColorStop(0, 'rgba(0,0,0,1)'); s.addColorStop(0.12, 'rgba(0,0,0,0)'); s.addColorStop(0.88, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = s; g.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(c); })();
const stencil = n => W.paint(512, 512, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#d9d2c4'; g.font = '700 430px SairaXC, "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, w / 2, h / 2 + 18);
  g.globalCompositeOperation = 'destination-out'; let s = 11 + n.charCodeAt(1); const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 2600; k++) { g.globalAlpha = 0.25 + r() * 0.7; g.fillRect(r() * w, r() * h, 1 + r() * 5, 1 + r() * 2.2); }
  g.globalAlpha = 0.5; for (let y = 6; y < h; y += 20) g.fillRect(0, y, w, 2.2);                       // paint is thin on the crest of every slat
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; });
const TINT = [0xff3d7a, 0x58b9ff, 0xffb14a];
for (const b of BAYS) {
  const grp = b.grp = new THREE.Group(); grp.position.set(b.x, 0, ZB - 0.32); scene.add(grp);
  const g = new THREE.PlaneGeometry(4.8, 3.7), uv = g.attributes.uv, ox = rnd(), oy = rnd(); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.4 + ox, uv.getY(i) * 1.85 + oy);
  const sh = new THREE.Mesh(g, shutterM); sh.position.y = -5.9; sh.castShadow = sh.receiveShadow = true; grp.add(sh);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.16, 0.1), dark); rail.position.set(0, -7.67, 0.03); rail.castShadow = true; grp.add(rail);
  const num = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshStandardMaterial({ map: stencil('0' + (b.i + 1)), transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); num.position.set(0, -6.0, 0.012); grp.add(num);
  for (const s of [-1, 1]) W.slab(0.09, 3.6, 0.16, b.x + s * 2.355, -6.0, ZB - 0.32, dark, false);                  // the guides the shutter runs in
  // light on the bay floor, spilling out under the shutter onto the sill
  const sp = b.spill = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 3.2), new THREE.MeshBasicMaterial({ map: spill, color: TINT[b.i], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  sp.rotation.x = -Math.PI / 2; sp.position.set(b.x, b.y0 + 0.012, ZB - 0.3); scene.add(sp);
  const strip = b.strip = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.07, 0.07), new THREE.MeshBasicMaterial({ color: TINT[b.i], toneMapped: false })); strip.position.set(b.x, b.y1 - 0.25, ZB - 1.7); scene.add(strip);
  b.line = new THREE.Mesh(new THREE.BoxGeometry(4.62, 0.035, 0.04), new THREE.MeshBasicMaterial({ color: TINT[b.i], toneMapped: false })); b.line.position.set(b.x, b.y0 + 0.018, ZB - 0.36); scene.add(b.line);      // the line of light under the door
}
// behind shutter 01: Hotwire's plate and its own colour of light
const hw = new THREE.Group(); hw.position.set(BAYS[0].x, -6.0, ZB - 1.72); scene.add(hw);
{
  const back = new THREE.Mesh(new THREE.BoxGeometry(4.8, 3.6, 0.1), new THREE.MeshStandardMaterial({ color: 0x0b0a0e, roughness: 0.95, metalness: 0 })); back.receiveShadow = true; hw.add(back);
  const tex = new THREE.TextureLoader().load('assets/logo.png'); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 4.3 * 626 / 2048), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })); logo.position.z = 0.07; hw.add(logo); hw.userData.logo = logo.material;
}
const neon = new THREE.PointLight(0xff3d7a, 0, 10, 1.8); neon.position.set(BAYS[0].x, -4.55, ZB - 0.75); scene.add(neon);

/* ---------- the doors at the foot of the wall: a steel door at the back of each alcove, a wall light over it ---------- */
const hot = new THREE.MeshBasicMaterial({ color: 0xffd9a8, toneMapped: false });
for (const d of DOORS) {
  d.letters = W.word(d.word, d.x, -9.85, ZB, 0.105, 0.14, steel);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(2.1, 4.5, 0.08), doorM); leaf.position.set(d.x, d.y0 + 2.25, ZB - 2.32); leaf.receiveShadow = true; scene.add(leaf); leaf.updateMatrixWorld(); W.worldUV(leaf.geometry, leaf.matrixWorld, 3.1);
  const pull = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.1, 0.07), dark); pull.position.set(d.x + 0.78, d.y0 + 2.3, ZB - 2.25); scene.add(pull);
  d.slit = new THREE.Mesh(new THREE.BoxGeometry(0.035, 4.5, 0.02), hot.clone()); d.slit.position.set(d.x - 1.07, d.y0 + 2.25, ZB - 2.3); scene.add(d.slit);            // the door stands a finger open
  d.bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.09), hot.clone()); d.bar.position.set(d.x, d.y1 - 0.12, ZB - 0.2); scene.add(d.bar);
  d.light = new THREE.PointLight(0xffc98a, 0, 9, 1.7); d.light.position.set(d.x, d.y1 - 0.5, ZB - 0.45); scene.add(d.light);
}

/* ---------- pointing, clicking, the keyboard ---------- */
const head = document.querySelector('header.top'), tags = [...document.querySelectorAll('.slot')], cue = document.querySelector('.cue'), foot = document.querySelector('.foot');
const links = { hotwire: document.getElementById('hotwire'), studio: document.getElementById('to-studio'), contact: document.getElementById('to-contact') };
const hit = new THREE.Vector3(), P = new THREE.Vector3(), T = new THREE.Vector3(), v = new THREE.Vector3();
let over = null, focus = null;
function pick(sx, sy) {
  if (!W.pointAt(ZB, hit, sx, sy)) return null;
  for (const b of BAYS) if (hit.x > b.x0 && hit.x < b.x1 && hit.y > b.y0 && hit.y < b.y1) return b;
  for (const d of DOORS) if (hit.x > d.x0 - 0.5 && hit.x < d.x1 + 0.5 && hit.y > d.y0 && hit.y < d.y1 + 1.1) return d;
  return null;
}
function enter(o, e) { if (o === BAYS[0]) W.target = o, W.leave('hotwire.html', e); else if (o.href) W.target = o, W.leave(o.href, e); }
canvas.addEventListener('click', e => {
  if (W.going) return; const o = pick(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); if (!o) return;
  if (o === BAYS[0]) { if (o.open < 0.55) o.held = W.time + 4; else enter(o); }           // a tap on a closed shutter raises it; the next one goes in
  else if (o.href) enter(o); else o.kick = 1;                                               // an empty bay's shutter only rattles
});
const stop = k => (document.documentElement.scrollHeight - innerHeight) * k;
for (const [k, o, at] of [['hotwire', BAYS[0], 0.56], ['studio', DOORS[0], 1], ['contact', DOORS[1], 1]]) {
  links[k].addEventListener('focus', () => { focus = o; scrollTo({ top: stop(at === 0.56 && innerWidth < innerHeight ? 0.43 : at), behavior: reduce ? 'auto' : 'smooth' }); }); links[k].addEventListener('blur', () => { focus = null; });
  links[k].addEventListener('click', e => { W.target = o; W.leave(links[k].href, e); });
}
document.querySelector('[data-go="games"]').addEventListener('click', e => { e.preventDefault(); scrollTo({ top: stop(0.5), behavior: reduce ? 'auto' : 'smooth' }); });

W.start((dt, go) => {
  const t = W.t, asp = camera.aspect, port = asp < 1, fov = port ? 58 : 34, tan = Math.tan(fov * Math.PI / 360), fit = half => half / (tan * asp);
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const w1 = port ? ss(0.16, 0.38, t) : ss(0.17, 0.48, t), w2 = port ? ss(0.72, 0.97, t) : ss(0.64, 0.97, t), pan = port ? clamp((t - 0.42) / 0.26) : 0.5;
  const bx = port ? mix(-7.2, 7.2, pan * pan * (3 - 2 * pan)) : 0;

  // camera: the name; under the overhang to the bays; down to the doors. Going into a game or a door pushes through it.
  const zA = Math.max(21, fit(7.3)), yA = port ? LIFT + 1.6 : -2.45 + zA * tan, lift = port ? LIFT : yA - 2.5;      // the lower edge of the opening view stays above the overhang's underside: nothing under the name wall shows
  P.set(0, yA, zA).lerp(v.set(bx, -5.5, port ? fit(3.1) + ZB : Math.max(13.5, fit(11.3) + ZB)), w1).lerp(v.set(0, port ? -10.6 : -12.0, Math.max(12.5, fit(port ? 5.9 : 7) + ZB)), w2);
  T.set(0, yA, 0).lerp(v.set(bx, -6.0, ZB), w1).lerp(v.set(0, port ? -10.2 : -12.5, ZB), w2);
  if (!port && !reduce) P.z -= 3.2 * Math.sin(Math.PI * w1);
  P.x += W.px * 0.8 * (1 - go) + Math.sin(W.time * 97) * 0.16 * IMP.shake; P.y -= W.py * 0.4 * (1 - go) * w1 + Math.sin(W.time * 131) * 0.1 * IMP.shake * (0.3 + 0.7 * w1); if (!reduce) P.z -= 2.2 * ss(0, 0.14, t) * (1 - w1);     // each landing shakes the camera; it creeps in while the name is built
  const tg = W.target; if (tg && go > 0) { const cy = (tg.y0 + tg.y1) / 2 - (tg.href ? 0.8 : 0); P.lerp(v.set(tg.x, cy, ZB + 2.6), go); T.lerp(v.set(tg.x, cy, ZB - 3), go); }
  camera.position.copy(P); camera.lookAt(T);

  W.idle = [port && w1 > 0.5 ? 0 : 0, -0.05, port ? 0.3 : 0.45, 0.25];
  W.aimLamp(mix(0, ZB, w1), (1 - go * 0.96) * (1 + 0.5 * IMP.flash));

  // what the pointer is on. Without a mouse, the bay in front of the camera is the one "pointed at".
  if (fine && W.moved && !W.going) over = pick(W.px, W.py); else if (!fine) over = (w1 > 0.85 && w2 < 0.25) ? BAYS[Math.round(pan * 2)] : null; else over = null;
  canvas.style.cursor = over && (over.href || over === BAYS[0]) ? 'pointer' : '';
  for (const b of BAYS) {
    const on = over === b || focus === b || (W.target === b), full = b.i === 0;
    b.want = full ? ((on || b.held > W.time || W.target === b) ? 1 : 0) : (on ? 0.1 : 0);
    b.open += (b.want - b.open) * (1 - Math.exp(-dt / (b.want > b.open ? 0.32 : 0.22))); b.kick *= Math.exp(-dt / 0.25);
    const jam = full ? 0 : b.open * 0.012 * Math.sin(W.time * 31 + b.i) + b.kick * 0.035 * Math.sin(W.time * 46);
    b.grp.position.y = b.open * 3.5 + jam;
    // work goes on behind the closed shutters: a steady line of light under each, welding now and then behind 02
    const weld = b.i === 1 ? Math.max(0, Math.sin(W.time * 0.7 + 1)) ** 6 * (0.5 + 0.5 * Math.sin(W.time * 47) * Math.sin(W.time * 29)) : 0;
    b.glow = full ? 0.25 + 0.75 * b.open : 0.3 + weld * 0.9 + b.open * 6;
    b.spill.material.opacity = Math.min(1, b.glow * 0.7); b.strip.material.color.setHex(TINT[b.i]).multiplyScalar(0.5 + Math.min(2, b.glow)); b.line.material.color.setHex(TINT[b.i]).multiplyScalar(Math.min(2.2, 0.35 + b.glow * 1.3));
  }
  const o0 = BAYS[0].open; neon.intensity = 46 * o0 * (0.94 + 0.06 * Math.sin(W.time * 13)) + go * 60; hw.userData.logo.color.setScalar(0.25 + 0.95 * o0); hw.position.z = ZB - 1.72 + 0.25 * o0;
  for (const d of DOORS) { d.hot += (((over === d || focus === d || W.target === d) ? 1 : 0) - d.hot) * (1 - Math.exp(-dt / 0.2)); d.light.intensity = (9 + 22 * d.hot) * w2 + go * 30; d.bar.material.color.setHex(0xffd9a8).multiplyScalar(0.25 + 0.5 * w2 + 1.2 * d.hot); d.slit.material.color.setHex(0xffd9a8).multiplyScalar(0.3 + 1.5 * d.hot); for (const L of d.letters) L.grp.position.z = ZB + 0.1 * d.hot; }

  // labels printed on the sill under each bay
  tags.forEach((el, i) => { const b = BAYS[i]; v.set(b.x0 + 0.12, -8.1, ZB + 1.5).project(camera); el.style.transform = `translate(${((v.x + 1) / 2 * innerWidth).toFixed(1)}px, ${((1 - v.y) / 2 * innerHeight).toFixed(1)}px)`;
    el.style.opacity = (v.z < 1 ? 1 : 0) * (1 - go) * ss(0.55, 0.95, w1) * (1 - ss(0.1, 0.5, w2)); el.classList.toggle('hot', b.open > (i ? 0.05 : 0.5)); });

  // the name: nothing on the wall until you scroll, then each letter is driven in as the scroll passes its mark (and pulled
  // back out if you scroll back). The flight is short and timed, so the smallest turn of the wheel lands a letter.
  W.pointAt(0, hit); const quick = reduce || W.time < 0.4;
  for (const L of name) { const want = reduce || W.raw > L.thr ? 1 : 0, was = L.a; L.a = quick ? want : clamp(L.a + (want ? dt / 0.16 : -dt / 0.11));
    if (was < 1 && L.a >= 1 && !quick) { IMP.shake = Math.min(1, IMP.shake + 0.6); IMP.flash = 1; L.kick = 1; burst(L); }
    L.kick *= Math.exp(-dt / 0.09); const near = fine && W.moved && L.a >= 1 ? Math.exp(-((hit.x - L.cx) ** 2 + (hit.y - L.cy - lift) ** 2) / 7) : 0; L.push += (near - L.push) * (1 - Math.exp(-dt / 0.18));
    L.grp.position.y = L.y + lift; L.grp.position.z = (1 - L.a * L.a * L.a) * 11 - L.kick * 0.1 + L.push * 0.5; L.grp.rotation.z = (1 - L.a) * 0.22 * (L.cx > 0 ? -1 : 1); L.grp.visible = L.a > 0; }
  IMP.shake *= Math.exp(-dt / 0.13); IMP.flash *= Math.exp(-dt / 0.1);
  for (let j = 0; j < BN; j++) if (bl[j] > 0) { bl[j] -= dt; bv[j * 3 + 1] -= 12 * dt; bp[j * 3] += bv[j * 3] * dt; bp[j * 3 + 1] += bv[j * 3 + 1] * dt; bp[j * 3 + 2] += bv[j * 3 + 2] * dt; if (bl[j] <= 0) bp[j * 3 + 1] = -999; }
  grit.geometry.attributes.position.needsUpdate = true;
  if (head) head.style.opacity = reduce || W.raw > 0.004 ? 1 : 0;
  if (cue) cue.style.opacity = (W.time > 1.2 ? 1 : 0) * (1 - ss(0, 0.012, W.raw));
  if (foot) { const f = ss(0.9, 0.99, t) * (1 - go); foot.style.opacity = f; foot.style.pointerEvents = f > 0.5 ? 'auto' : 'none'; }
});
if (location.hash === '#games') requestAnimationFrame(() => scrollTo(0, stop(innerWidth < innerHeight ? 0.43 : 0.56)));       // arriving from another page's Games link
window.HOME = W; W.BAYS = BAYS; W.DOORS = DOORS;
W.at = (x, y) => { const q = new THREE.Vector3(x, y, ZB).project(camera); return [+((q.x + 1) / 2).toFixed(3), +((1 - q.y) / 2).toFixed(3)]; };      // for tests: where a point of the wall is on screen
