/* The key the asset packs are sealed with. It has to ship with the page (the browser must open the packs), so this is a lock
   against casual saving and re-use of the files, not a secret: see Docs/specs/website-plan.md. Shared by tools/pack_assets.mjs. */
const parts = ['rough', 'games', 'site', 'pack', '2026', 'hotwire'];
export async function packKey(subtle) {
  const raw = new TextEncoder().encode(parts.map((p, i) => p.split('').reverse().join('') + (i * 7 + 3)).join('|'));
  const hash = await subtle.digest('SHA-256', raw);
  return subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
