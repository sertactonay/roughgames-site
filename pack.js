/* Opens a sealed asset pack (assets/pack/*.rgp, made by tools/pack_assets.mjs): one encrypted file holding a model, its textures
   or a set of sounds. Nothing in it is served as a plain .glb, image or audio file. */
import { packKey } from './packkey.js';
const open = {};
export function openPack(url) {
  return open[url] || (open[url] = (async () => {
    const raw = new Uint8Array(await (await fetch(url)).arrayBuffer());
    if (String.fromCharCode(...raw.subarray(0, 4)) !== 'RGP1') throw new Error('not a pack: ' + url);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(4, 16) }, await packKey(crypto.subtle), raw.subarray(16)));
    const n = new DataView(plain.buffer).getUint32(0, true), index = JSON.parse(new TextDecoder().decode(plain.subarray(4, 4 + n))), base = 4 + n;
    const bytes = name => { const e = index[name]; if (!e) throw new Error(name + ' is not in ' + url); return plain.subarray(base + e[0], base + e[0] + e[1]); };
    return { names: Object.keys(index),
      buffer: name => bytes(name).slice().buffer,
      json: name => JSON.parse(new TextDecoder().decode(bytes(name))),
      bitmap: name => createImageBitmap(new Blob([bytes(name)], { type: index[name][2] })) };
  })());
}
