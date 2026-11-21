/* The car scene: the SPIRE on the grid, rendered live. Arrive behind it, the tail lights wake, walk around it while the
   paint changes, go in through the driver's window, sit, watch the start lights, launch.
   LOCAL PREVIEW ONLY: the model is a bought Asset Store pack (assets/car is git-ignored). Whether and how it may be
   served from a public site is an open licence question; see Docs/specs/website-plan.md. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { openPack } from './pack.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const PAINTS = [new THREE.Color(0xe0a12a), new THREE.Color(0x1238c9), new THREE.Color(0xdfe2ea)];

const assets = {};
function loadAssets(renderer, id) {   // one sealed pack per model; clones share geometry and textures
  return assets[id] || (assets[id] = (async () => {
    const pack = await openPack(`assets/pack/car-${id}.rgp`);
    const tex = async (f, srgb) => { const t = new THREE.Texture(await pack.bitmap(f)); t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.needsUpdate = true; return t; };
    return Promise.all([new GLTFLoader().parseAsync(pack.buffer('model.glb'), ''), tex('albedo.jpg', true), tex('normal.png'), tex('orm.png'), tex('emissive.jpg', true), tex('paintao.jpg'), pack.json('meta.json')]);
  })());
}

export async function createCar(scene, renderer, GROUND, spot, opts = {}) {
  const [gltf, albedo, normal, orm, emissive, paintAo, meta] = await loadAssets(renderer, opts.model || '35');

  const body = () => new THREE.MeshStandardMaterial({ map: albedo, normalMap: normal, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1, emissiveMap: emissive, emissive: 0xffffff, emissiveIntensity: 0, envMapIntensity: 0.4 });
  const M = {
    body: body(), cabin: body(), tail: body(), head: body(), lampOff: body(), wheel: body(),
    paint: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(opts.paint ?? PAINTS[0]), metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.2, aoMap: paintAo, envMapIntensity: 1.25 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.12, transparent: true, opacity: 0.22, envMapIntensity: 1.6, specularIntensity: 0.4, depthWrite: false }),
    windows: new THREE.MeshPhysicalMaterial({ color: 0x0b0d12, metalness: 0, roughness: 0.16, transparent: true, opacity: 0.5, envMapIntensity: 1.6, specularIntensity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    carbon: new THREE.MeshPhysicalMaterial({ color: 0x0c0c0f, metalness: 0.4, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 0.8 }),
  };
  M.cabin.envMapIntensity = 0.55;
  const model = gltf.scene.clone(true), wheels = [], wing = [], box = new THREE.Box3(), ctr = new THREE.Vector3();
  const centre = re => { let o = null; model.traverse(x => { if (!o && x.isMesh && re.test(x.name)) o = x; }); return o ? box.setFromObject(o).getCenter(new THREE.Vector3()) : null; };
  let wheel = null;
  model.traverse(o => {
    if (!o.isMesh) return; const n = o.name;
    o.material = n === 'WHEEL' ? M.wheel
      : /Paint/.test(n) ? M.paint
      : /Carbon/.test(n) ? M.carbon
      : /Glass/.test(n) ? M.glass
      : /Windows/.test(n) ? M.windows
      : /LPLight/.test(n) ? M.lampOff
      : /BrakeLight|RearSideLight/.test(n) ? M.tail
      : /MainLight|DayLight|FogLight/.test(n) ? M.head
      : /TurnSignal|ReverseLight/.test(n) ? M.lampOff
      : /Interior|Steering|Stering|Arrow/.test(n) ? M.cabin : M.body;
    if (n === 'WHEEL') wheel = o;
    if (/Spoiler_LOD0/.test(n)) wing.push(o);
    const hq = new URLSearchParams(location.search).get('hide'); if (hq && n.includes(hq)) o.visible = false;   // QA: look at the car without one part
    if (/Windows|Glass/.test(n)) o.renderOrder = 2;
  });
  // orient: rear toward +Z (the arriving camera), sit on the road
  model.updateMatrixWorld(true);
  const rear = centre(/BrakeLight/), front = centre(/MainLight/);
  const group = new THREE.Group(); group.add(model);
  const flip = !!(rear && front && rear.z < front.z); if (flip) model.rotation.y = Math.PI;
  const local = p => new THREE.Vector3(flip ? -p[0] : p[0], p[1], flip ? -p[2] : p[2]);
  model.updateMatrixWorld(true);
  // four wheels from the single wheel mesh, placed on the brake rotors
  if (wheel) {   // four wheels from the single wheel mesh, on the hubs the exporter read from the model
    wheel.removeFromParent();
    for (const h of meta.wheels) { if (!h) continue; const c = local(h);
      const w = new THREE.Mesh(wheel.geometry, M.wheel); w.position.copy(c); w.rotation.y = c.x < 0 ? Math.PI : 0; group.add(w); wheels.push(w); }
  }
  box.setFromObject(group); box.getCenter(ctr);
  model.position.x -= ctr.x; model.position.z -= ctr.z; group.children.forEach(o => { if (o !== model) { o.position.x -= ctr.x; o.position.z -= ctr.z; } });
  const lift = -box.min.y; group.children.forEach(o => o.position.y += lift);
  group.updateMatrixWorld(true);
  const sw = centre(/^(RMCar\d+_)?SteeringWheel/) || new THREE.Vector3(-0.33, 0.7, -0.3);
  const side = Math.sign(sw.x) || 1;
  const headPt = new THREE.Vector3(sw.x, sw.y + 0.19, sw.z + 0.54);

  // contact shadow: the wet road must not mirror the sky under the car
  const sc = document.createElement('canvas'); sc.width = sc.height = 128; const g = sc.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.92)'); gr.addColorStop(.7, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 6.0), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, fog: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; shadow.renderOrder = 1; group.add(shadow);
  // underglow: a soft coloured pool on the wet road
  const gc = document.createElement('canvas'); gc.width = 64; gc.height = 128; const gg = gc.getContext('2d');
  gg.filter = 'blur(9px)'; gg.fillStyle = '#fff'; gg.fillRect(14, 16, 36, 96); gg.filter = 'none';
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 6.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.02; glow.renderOrder = 2; glow.visible = false; group.add(glow);
  if (opts.ghost) {   // Decoy: a light-only twin
    const gm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.12, 0.5, 1.3), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });   // writes depth: one layer of light, not a pile
    group.traverse(o => { if (o.isMesh) o.material = gm; }); shadow.visible = false; group.userData.ghost = gm;
  }

  // light that belongs to the car and its spot on the grid
  // no lights of its own: every extra light makes every material in the scene slower. The scene lends its two point
  // lights (see main.js) and they are placed here: a sodium lamp and a cool rim outside, a dash glow once you sit down.
  const lampP = new THREE.Vector3(-side * 3.6, 5.2, 1.5), rimP = new THREE.Vector3(side * 4.2, 2.2, -3.2), dashP = sw.clone().add(new THREE.Vector3(0.12, -0.16, 0.12));

  // our own number plate over the pack's (the game does the same)
  let pl = null; model.traverse(o => { if (o.isMesh && /LicensePlate|PlateType/.test(o.name)) pl = o; });
  if (pl && !opts.ghost) {
    await document.fonts.load('700 120px SairaSC').catch(() => {});
    const c = document.createElement('canvas'); c.width = 512; c.height = 224; const g = c.getContext('2d');
    g.fillStyle = '#e8e4d8'; g.fillRect(0, 0, 512, 224); g.strokeStyle = '#15130f'; g.lineWidth = 10; g.strokeRect(9, 9, 494, 206);
    g.fillStyle = '#15130f'; g.font = '700 150px SairaSC, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(opts.plate || 'PRS 501', 256, 122);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    box.setFromObject(pl); const pc = box.getCenter(new THREE.Vector3()), ps = box.getSize(new THREE.Vector3()), out = pc.z > 0 ? 1 : -1;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(ps.x * 1.04, ps.y * 1.08), new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.12 }));
    p.position.set(pc.x, pc.y, pc.z + out * (ps.z / 2 + 0.008)); if (out < 0) p.rotation.y = Math.PI; group.add(p); pl.visible = false;
  }
  group.position.copy(spot); scene.add(group);
  const base = spot.clone(), pos = new THREE.Vector3(), tgt = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), col = new THREE.Color();
  const enter = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(side * 2.5, 1.06, -0.35), new THREE.Vector3(side * 1.18, 0.97, headPt.z - 0.12), headPt.clone()], false, 'centripetal', 0.5);

  const api = { lampP, rimP, dashP, ign: 0, group, pos, tgt, fov: 36, inside: 0, launch: 0, go: 0, side, headPt, sw,
    M, raceD: 0, steer: 0, headOn: 0, userPaint: null,
    setRim(hex) { M.wheel.color.set(hex); },
    setWing(on) { wing.forEach(o => o.visible = on); },
    setGlow(hex) { glow.visible = !!hex; if (hex) glow.material.color.set(hex).multiplyScalar(2.2); },
    lights(tail, head) { M.tail.emissiveIntensity = tail * (opts.tailGain || 1); M.head.emissiveIntensity = head; },
    spin(dt, v) { const a = v * dt / 0.355; wheels.forEach(w => w.rotation.x -= a); },
    update(c, r, time, dt, px, py, reduce) {
      // lights and paint
      const flick = c < 0.1 ? 0.75 + 0.25 * Math.sin(time * 37) * Math.sin(time * 23) : 1;
      const tail = ss(0.015, 0.08, c) * flick, head = ss(0.22, 0.28, c), ign = ss(0.70, 0.78, c);
      M.tail.emissiveIntensity = 0.15 + tail * 7;
      M.head.emissiveIntensity = (0.1 + head * 3.2) * (1 - 0.72 * (api.rear || 0)); M.lampOff.emissiveIntensity = 0.1;
      M.cabin.emissiveIntensity = ign * 2.2; M.body.emissiveIntensity = 0; api.ign = ign;
      const p = clamp((c - 0.10) / 0.40), k1 = ss(0.30, 0.42, p), k2 = ss(0.66, 0.78, p);
      col.copy(PAINTS[0]).lerp(PAINTS[1], k1).lerp(PAINTS[2], k2); if (api.userPaint) col.copy(api.userPaint);
      M.paint.color.lerp(col, api.userPaint ? 1 - Math.exp(-dt / 0.25) : 1); api.headOn = head;
      // launch: the car leaves, and we are in it
      const L = Math.pow(clamp((c - 0.86) / 0.14), 2.1); api.launch = L; api.go = ss(0.815, 0.84, c);
      // race: it keeps driving by itself; the pointer steers it across the lanes
      const V = 58; if (r > 0) api.raceD += V * dt; else api.raceD = 0;
      const want = r > 0.06 && !reduce ? px * 2.5 : 0; const prev = api.steer; api.steer += (want - api.steer) * (1 - Math.exp(-dt / 0.35));
      group.position.set(base.x + api.steer, base.y, base.z - 150 * L - api.raceD);
      group.rotation.y = clamp((api.steer - prev) / Math.max(dt, 0.001) * -0.02, -0.12, 0.12);
      if (L > 0 || r > 0) api.spin(dt, r > 0 ? V : 150 * L * 0.6);
      // camera, in the car's own frame
      const TH0 = 0.42, TH1 = 0.42 - 4.80, o = clamp((c - 0.06) / 0.52), oo = o * o * (3 - 2 * o), th = mix(TH0, TH1, oo);
      const R = 5.9 + 0.5 * Math.sin(oo * Math.PI * 2), h = mix(0.72, 0.95, oo) + 0.3 * Math.sin(oo * Math.PI);
      a.set(side * R * Math.sin(th), h, R * Math.cos(th));
      enter.points[0].set(side * 5.9 * Math.sin(TH1), 0.95, 5.9 * Math.cos(TH1));
      const e = clamp((c - 0.60) / 0.19), ee = clamp(e * e * e * (e * (e * 6 - 15) + 10));   // clamp: rounding can push it a hair past 1, which breaks the spline
      if (e <= 0) pos.set(side * R * Math.sin(th), h, R * Math.cos(th)); else enter.getPoint(ee, pos);
      const lookIn = ss(0.68, 1.0, ee);
      tgt.set(0, 0.52, 0.1).lerp(a.copy(sw), ss(0.0, 0.4, ee)).lerp(b.set(sw.x * 0.6, headPt.y - 0.03, -40), lookIn * lookIn);
      api.inside = ss(0.7, 0.98, ee);
      if (api.inside > 0 && !reduce) { tgt.x += px * 9 * api.inside; tgt.y -= py * 3.2 * api.inside; }   // look around from the seat
      api.fov = mix(36, 64, ss(0.5, 1, ee)) + L * 22;
      if (r > 0) {   // out of the seat to the chase view; swing round to look back for the rear weapons; up and away at the end
        const k = ss(0.012, 0.065, r), rear = ss(0.455, 0.495, r) * (1 - ss(0.80, 0.84, r)), out = ss(0.95, 1, r);
        const ang = rear * 2.42, R = 6.7 + 0.8 * rear + 15 * out, h = mix(1.55, 1.75, rear) + 3.0 * out;
        pos.copy(headPt).lerp(a.set(side * -Math.sin(ang) * R - api.steer * 0.45 * (1 - rear), h, Math.cos(ang) * R), k); pos.y += Math.sin(k * Math.PI) * 0.3;
        tgt.set(sw.x * 0.6, headPt.y - 0.03, -40).lerp(a.set(-api.steer * 0.2 * (1 - rear) + side * 1.4 * rear, 0.8, mix(-9, 7, rear)), k);
        api.fov = mix(86, mix(56, 50, rear), k); api.inside = 1 - k; api.rear = rear; api.blink = Math.sin(Math.PI * clamp((r - 0.012) / 0.045));
      } else { api.blink = 0; api.rear = 0; }
      group.updateMatrixWorld(true); group.localToWorld(pos); group.localToWorld(tgt);
    } };
  return api;
}
