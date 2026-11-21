/* Rough Games, the studio page: inside the building. A long concrete hall under a coffered ceiling, open on one side through a
   row of columns, so daylight falls across the floor in bars. The page opens on the word STUDIO on the wall; scrolling turns
   the camera and walks the length of the hall while the text passes; the door at the far end leads to Contact. */
import { THREE, createWorld, reduce, fine, clamp, ss, mix } from './world.js';

const W = createWorld({ bg: 0x8f8778, fog: [26, 120], exposure: 0.95, fov: 46 }), { scene, camera, canvas } = W;
const wall = W.surface('cast', { skin: 'plain', tile: 3.2, weather: 0.3, normal: 1.35 });      // plain site-cast concrete: pale, flat, faint horizontal board lines
const cast = W.surface('cast', { tile: 3, weather: 0.5, color: 0xb4b2ac });
const deep = W.surface('cast', { tile: 3, color: 0x77726a });
const floorM = W.surface('cast', { tile: 3.6, color: 0x8b857c, rough: 0.62 });
const steel = W.surface('rust', { tile: 2.2, metal: 0.22, normal: 1.2 });
const doorM = W.surface('rust', { tile: 3.1, metal: 0.3, color: 0x8d8780 });

const X0 = -12, X1 = 72, H = 7.2, ZW = -7.2, ZC = 6.0;        // the hall runs along x; the solid wall is at ZW, the columns at ZC
{
  const slots = []; for (let x = 19.2; x < 66; x += 9.6) slots.push([x, x + 2.4, 2.4, 6.0, 1.1]);
  W.facade(X0, X1, 0, H, ZW, 1.6, { holes: slots, face: wall, body: cast, backs: deep, pour: () => [0, 0], ties: false });
  W.slab(X1 - X0 + 30, 1, 60, (X0 + X1) / 2, -0.5, 8, floorM, false);
  W.slab(X1 - X0, 0.5, 15.2, (X0 + X1) / 2, H + 1.15, -0.4, cast);                       // the roof slab
  W.slab(X1 - X0, 0.9, 1.6, (X0 + X1) / 2, H + 0.45, ZW - 0.8, cast);
  for (let x = X0; x <= X1 + 0.01; x += 2.4) W.slab(0.3, 0.9, 13.6, x, H + 0.45, -0.4, cast);                      // coffers: ribs across,
  for (let z = ZW + 2.4; z < ZC - 1; z += 2.4) W.slab(X1 - X0, 0.9, 0.3, (X0 + X1) / 2, H + 0.45, z, cast, false);   // and ribs along
  W.slab(X1 - X0, 0.9, 0.9, (X0 + X1) / 2, H + 0.45, ZC, cast);                                                    // the beam over the columns
  for (let x = X0 + 2.4; x < X1; x += 4.8) W.slab(0.9, H, 0.9, x, H / 2, ZC, cast);
  W.slab(X1 - X0 + 30, 1.0, 0.5, (X0 + X1) / 2, 0.5, 12.5, cast);                                                  // the parapet of the terrace outside
  const sc = document.createElement('canvas'); sc.width = 8; sc.height = 256; const sg = sc.getContext('2d'), sl = sg.createLinearGradient(0, 0, 0, 256); sl.addColorStop(0, '#8fa3b8'); sl.addColorStop(0.55, '#c9cdd0'); sl.addColorStop(0.72, '#ecdcc0'); sl.addColorStop(1, '#d8c3a0'); sg.fillStyle = sl; sg.fillRect(0, 0, 8, 256);
  const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(400, 120), new THREE.MeshBasicMaterial({ map: st, fog: false, toneMapped: false })); sky.position.set(30, 22, 46); sky.rotation.y = Math.PI; scene.add(sky);
  // the wall across the far end, with the way on to Contact
  for (const s of [-1, 1]) W.slab(1.2, H, 6.0, X1 + 0.6, H / 2, s * 4.2 - 0.6, cast);
  W.slab(1.2, H - 4.8, 2.4, X1 + 0.6, 4.8 + (H - 4.8) / 2, -0.6, cast);
  W.slab(1.2, H, 2.4, X1 + 0.6, H / 2, ZW + 0.6 - 1.2, cast);
}
const turn = new THREE.Group(); turn.rotation.y = -Math.PI / 2; turn.position.set(X1, 0, -0.6); scene.add(turn);
const sign = W.word('CONTACT', 0, 5.05, 0.0, 0.1, 0.14, steel, turn);
const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.08, 4.6, 2.2), doorM); leaf.position.set(X1 + 1.0, 2.3, -0.6); leaf.receiveShadow = true; scene.add(leaf); leaf.updateMatrixWorld(); W.worldUV(leaf.geometry, leaf.matrixWorld, 3.1);
const slit = new THREE.Mesh(new THREE.BoxGeometry(0.02, 4.6, 0.04), new THREE.MeshBasicMaterial({ color: 0xffd9a8, toneMapped: false })); slit.position.set(X1 + 0.97, 2.3, -1.72); scene.add(slit);
const doorLight = new THREE.PointLight(0xffc98a, 14, 10, 1.7); doorLight.position.set(X1 - 0.6, 4.6, -0.6); scene.add(doorLight);
const name = W.word('STUDIO', 5.6, 2.2, ZW, 0.4, 0.6, steel);

// daylight through the columns
W.hemi.intensity = 1.25; W.hemi.color.set(0xe9dcc6); W.hemi.groundColor.set(0x8a7a66); W.fill.intensity = 0;
const sun = new THREE.DirectionalLight(0xffe0b4, 5.2); sun.position.set(44, 26, 34); sun.target.position.set(30, 1, -3); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 16, bottom: -16, near: 1, far: 90 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.05; sun.shadow.radius = 3; scene.add(sun, sun.target);
W.lamp.castShadow = false; W.lampPower = 70;

const link = document.getElementById('to-contact'), P = new THREE.Vector3(), T = new THREE.Vector3(), v = new THREE.Vector3(), hit = new THREE.Vector3();
let overDoor = false, hot = 0;
link.addEventListener('click', e => W.leave(link.href, e));
canvas.addEventListener('click', () => { if (overDoor) W.leave('contact.html'); });

W.start((dt, go) => {
  const t = W.t, asp = camera.aspect, port = asp < 1, fov = port ? 64 : 46;
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  // the word on the wall, seen along the wall; then turn and walk the hall
  const a = ss(0.01, 0.15, t), w = clamp((t - 0.1) / 0.9), walk = w * w * (3 - 2 * w) * 0.35 + w * 0.65;
  P.set(port ? -7.5 : -5.2, port ? 3.3 : 2.9, port ? -2.6 : 2.6).lerp(v.set(2, 1.75, 0.2), a); P.x += walk * 59;
  T.set(port ? 4.2 : 5.4, 3.4, ZW).lerp(v.set(14, mix(2.0, 2.7, ss(0.8, 1, t)), -0.4), a); T.x += walk * 59 * a;
  const look = (1 - go) * (fine && W.moved ? 1 : 0.35); T.z += W.px * 2.6 * look * (0.4 + 0.6 * a) * (1 - 0.6 * ss(0.8, 1, t)); T.y -= W.py * 1.3 * look;
  P.lerp(v.set(X1 - 1.4, 2.2, -0.6), go); T.lerp(v.set(X1 + 3, 2.3, -0.6), go);
  camera.position.copy(P); camera.lookAt(T);
  W.aimLamp(ZW, (1 - a * 0.6) * (1 - go));

  const since = W.shownAt != null ? W.time - W.shownAt : -1;
  name.forEach((L, i) => { const k = clamp((since - 0.2 - i * 0.08) / 0.5); L.grp.position.z = ZW + (reduce ? 0 : (1 - k) * (1 - k) * 5); L.grp.visible = k > 0 || reduce; });
  // the door at the end: under the pointer when the ray lands on it
  v.set(W.px, -W.py, 0.5).unproject(camera).sub(camera.position).normalize(); const k = (X1 - camera.position.x) / v.x, hy = camera.position.y + v.y * k, hz = camera.position.z + v.z * k;
  overDoor = fine && W.moved && !W.going && t > 0.55 && k > 0 && Math.abs(hz + 0.6) < 1.6 && hy > 0 && hy < 5.9; canvas.style.cursor = overDoor ? 'pointer' : '';
  hot += (((overDoor || document.activeElement === link) ? 1 : 0) - hot) * (1 - Math.exp(-dt / 0.2));
  doorLight.intensity = 14 + 26 * hot + go * 40; slit.material.color.setHex(0xffd9a8).multiplyScalar(0.5 + 1.6 * hot); for (const L of sign) L.grp.position.z = 0.12 * hot;
  const cue = document.querySelector('.cue'); if (cue) cue.style.opacity = (since > 1.6 ? 1 : 0) * (1 - ss(0, 0.03, W.raw));
});
window.HOME = W;
