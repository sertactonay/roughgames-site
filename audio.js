/* Sound for the site proof: the game's own cues and beds (assets/audio, made by tools/prepare_audio.py).
   Off until the visitor asks for it. Nothing is fetched or decoded before that. One-shots fire when scroll passes their beat;
   the beds (rain, wire hum, engine, wet road) follow the scene. A limiter sits on the output; meter() reports the peak for QA. */
import { openPack } from './pack.js';

export function createAudio() {
  let ctx = null, master = null, an = null, buf = null, ready = false, on = false, peak = 0;
  const bufs = {}, loops = {}, log = [];
  async function enable() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0;
      const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -9; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.2;
      an = ctx.createAnalyser(); an.fftSize = 2048; buf = new Float32Array(an.fftSize);
      master.connect(lim); lim.connect(an); an.connect(ctx.destination);
      const pack = await openPack('assets/pack/audio.rgp'), man = pack.json('manifest.json');
      await Promise.all(Object.entries(man).map(async ([k, m]) => {
        bufs[k] = await ctx.decodeAudioData(pack.buffer(m.file));
        if (m.loop) { const s = ctx.createBufferSource(); s.buffer = bufs[k]; s.loop = true; const g = ctx.createGain(); g.gain.value = 0; s.connect(g); g.connect(master); s.start(); loops[k] = { s, g }; }
      }));
      ready = true;
    }
    await ctx.resume(); on = true; master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.35);
  }
  function disable() { on = false; if (ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.12); }
  function play(k, gain = 0.5, rate = 1) {
    if (!on || !ready || !bufs[k]) return;
    const s = ctx.createBufferSource(); s.buffer = bufs[k]; s.playbackRate.value = rate; const g = ctx.createGain(); g.gain.value = gain; s.connect(g); g.connect(master); s.start(); log.push(k);
  }
  function loop(k, gain, rate) { const l = loops[k]; if (!l || !on) return; l.g.gain.setTargetAtTime(gain, ctx.currentTime, 0.12); if (rate) l.s.playbackRate.setTargetAtTime(rate, ctx.currentTime, 0.18); }
  function meter() { if (!an || !on) return 0; an.getFloatTimeDomainData(buf); let m = 0; for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > m) m = v; } if (m > peak) peak = m; return m; }
  return { enable, disable, play, loop, meter, log, get on() { return on && ready; }, get peak() { return peak; }, get state() { return ctx ? ctx.state : 'none'; } };
}
