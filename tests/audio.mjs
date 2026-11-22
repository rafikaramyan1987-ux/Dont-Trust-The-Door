// Audio resume test with a fake AudioContext (src/audio.ts): Safari can put the context in its own "interrupted"
// state (or "suspended"), and a context can end up "closed". The fake's resume() succeeds only during a real user
// gesture (while a pointerdown / touchstart / keydown is being dispatched), like Safari. Checks:
//   - no AudioContext (no sound) before the first user gesture; the first keydown creates and starts it
//   - running → interrupted: sound effects are skipped and a resume without a gesture fails; the next keydown resumes
//     it, and the music loop restarts exactly once, at its loop position
//   - running → suspended: window focus resumes it (inside a gesture-free page it may fail; the next pointerdown does)
//   - a context whose resume keeps failing (3 tries) is replaced on the next gesture
//   - closed: the next pointerdown creates a fresh AudioContext, the buses are rebuilt, the decoded buffers are reused
//     and the music restarts once on the new context
//   - the portal's mute and the player's own mute still win: no music while muted, even after a resume
// Usage: npm run build && node tests/audio.mjs
import { launch, serveDist, openGame } from './harness.mjs';

const FAKE = `
(() => {
  const fa = (window.__fa = { ctxs: [], starts: [], resumes: 0, resumeFails: 0, gesture: false });
  // a user gesture lasts while its event is dispatched (this listener is registered before the game's, so it runs first)
  for (const ev of ['pointerdown', 'touchstart', 'keydown']) window.addEventListener(ev, () => { fa.gesture = true; setTimeout(() => (fa.gesture = false), 0); }, { capture: true });
  class Node { constructor(c) { this.ctx = c; } connect() {} disconnect() {} }
  class Gain extends Node { constructor(c) { super(c); this.gain = { value: 1, setTargetAtTime(v) { this.value = v; } }; } }
  class Source extends Node {
    constructor(c) { super(c); this.buffer = null; this.loop = false; this.stopped = false; }
    start(t, off) { fa.starts.push({ ctx: this.ctx.id, loop: this.loop, off: off || 0, src: this }); }
    stop() { this.stopped = true; }
  }
  let n = 0;
  class Ctx {
    constructor() { this.id = ++n; this.state = 'suspended'; this.currentTime = 0; this.destination = new Node(this); this.onstatechange = null; fa.ctxs.push(this); }
    createGain() { return new Gain(this); }
    createBufferSource() { return new Source(this); }
    resume() {
      fa.resumes++;
      if (this.state === 'closed' || this.broken) return Promise.reject(new Error('cannot resume'));
      if (!fa.gesture) { fa.resumeFails++; return Promise.reject(new Error('needs a user gesture')); }
      this._set('running');
      return Promise.resolve();
    }
    close() { this._set('closed'); return Promise.resolve(); }
    _set(s) { if (this.state === s) return; this.state = s; if (this.onstatechange) this.onstatechange(); }
    decodeAudioData(d, ok) { const b = { duration: 1 }; if (ok) ok(b); return Promise.resolve(b); }
  }
  class Offline { decodeAudioData(d, ok) { const b = { duration: 12.8 }; if (ok) ok(b); return Promise.resolve(b); } }
  window.AudioContext = Ctx; window.webkitAudioContext = Ctx; window.OfflineAudioContext = Offline;
})();`;

const { server, url } = await serveDist();
const browser = await launch();
const { page, ctx: bctx } = await openGame(browser, url, { context: {} });
let failed = 0;
const check = (ok, msg, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${msg}${detail && !ok ? ` (${detail})` : ''}`);
  if (!ok) failed++;
};
// openGame already loaded the page: install the fake and reload so the engine starts with it
await page.addInitScript(FAKE);
await page.reload();
await page.waitForFunction(() => window.__DTTD && window.__fa, null, { timeout: 30000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const E = (fn, a) => page.evaluate(fn, a);
const fa = () => E(() => ({ ctxs: window.__fa.ctxs.map((c) => c.state), starts: window.__fa.starts.map((s) => ({ ctx: s.ctx, loop: s.loop, stopped: s.src.stopped })), resumes: window.__fa.resumes, fails: window.__fa.resumeFails }));
const musicStarts = (st, ctx) => st.starts.filter((s) => s.loop && (ctx === undefined || s.ctx === ctx)).length;
/** music sources playing on the current (last) context; a closed context's sources are gone with it */
const playing = (st) => st.starts.filter((s) => s.loop && !s.stopped && s.ctx === st.ctxs.length).length;

console.log('audio resume (fake AudioContext)');
// music on, files decoded (the engine decodes with the fake OfflineAudioContext, no gesture needed)
await E(() => { const A = window.__DTTD.audioEngine(); A.setMuted(false); A.startMusic(); return A.preload(); });
await page.waitForFunction(() => window.__DTTD.audioEngine().buffers.has('music'), null, { timeout: 15000 });
let s = await fa();
check(s.ctxs.length === 0, 'no AudioContext before the first user gesture (no sound)', JSON.stringify(s.ctxs));

await page.keyboard.press('KeyX');
await sleep(100);
s = await fa();
check(s.ctxs.length === 1 && s.ctxs[0] === 'running' && musicStarts(s, 1) === 1, 'the first keydown creates the context, resumes it, the music starts', JSON.stringify(s));

// running → interrupted (Safari)
await E(() => window.__fa.ctxs[0]._set('interrupted'));
const before = (await fa()).starts.length;
await E(() => window.__DTTD.audioEngine().sfx('jump'));
await sleep(50);
s = await fa();
check(s.starts.length === before && s.ctxs[0] === 'interrupted' && s.fails >= 1, 'interrupted: the sound effect is skipped, a resume without a gesture fails (and is retried)', JSON.stringify({ starts: s.starts.length, before, state: s.ctxs[0], fails: s.fails }));
await page.keyboard.press('KeyX');
await sleep(150);
s = await fa();
check(s.ctxs.length === 1 && s.ctxs[0] === 'running', 'the next keydown resumes the interrupted context', JSON.stringify(s.ctxs));
check(musicStarts(s, 1) === 2 && playing(s) === 1, 'the music loop restarts exactly once (the old source stopped)', JSON.stringify({ starts: musicStarts(s, 1), playing: playing(s) }));
await E(() => window.__DTTD.audioEngine().sfx('jump'));
s = await fa();
check(s.starts.some((x) => !x.loop), 'sound effects play again once running');

// running → suspended → window focus / the next gesture
await E(() => window.__fa.ctxs[0]._set('suspended'));
await E(() => window.dispatchEvent(new Event('focus')));
await sleep(50);
const resumesAfterFocus = (await fa()).resumes;
await page.mouse.click(5, 5);
await sleep(150);
s = await fa();
check(resumesAfterFocus > s.resumes - 2 && s.ctxs[0] === 'running' && musicStarts(s, 1) === 3 && playing(s) === 1, 'suspended: focus tries to resume, the next pointerdown resumes it, the music restarts once', JSON.stringify({ state: s.ctxs[0], starts: musicStarts(s, 1), playing: playing(s) }));

// closed → a fresh context on the next pointerdown
await E(() => window.__fa.ctxs[0]._set('closed'));
await page.mouse.click(5, 5);
await sleep(150);
s = await fa();
check(s.ctxs.length === 2 && s.ctxs[1] === 'running', 'closed: the next pointerdown creates a fresh AudioContext and starts it', JSON.stringify(s.ctxs));
check(musicStarts(s, 2) === 1 && playing(s) === 1, 'the music restarts once on the new context (decoded buffers reused)', JSON.stringify({ onNew: musicStarts(s, 2), playing: playing(s) }));
const reused = await E(() => { const A = window.__DTTD.audioEngine(); return A.buffers.size > 1 && A.ctx === window.__fa.ctxs[1] && !!A.master && !!A.sfxBus && !!A.musicBus; });
check(reused, 'buses rebuilt on the new context, buffers kept');

// mute rules still win
await E(() => window.__DTTD.audioEngine().setSysMuted(true));
await E(() => window.__fa.ctxs[1]._set('interrupted'));
await page.keyboard.press('KeyX');
await sleep(150);
s = await fa();
check(s.ctxs[1] === 'running' && playing(s) === 0, 'portal mute: the context resumes on a gesture but no music plays', JSON.stringify({ state: s.ctxs[1], playing: playing(s) }));
await E(() => window.__DTTD.audioEngine().setSysMuted(false));
s = await fa();
check(playing(s) === 1, 'portal mute off: the music comes back', JSON.stringify({ playing: playing(s) }));
await E(() => window.__DTTD.audioEngine().setMuted(true));
s = await fa();
const st0 = s.starts.length;
await E(() => window.__DTTD.audioEngine().sfx('jump'));
s = await fa();
check(playing(s) === 0 && s.starts.length === st0, "the player's own mute: no music, no sound effects");
await E(() => window.__DTTD.audioEngine().setMuted(false));

// a context that will not resume, even on gestures: after 3 failed tries the next gesture builds a fresh one
await E(() => { const c = window.__fa.ctxs[1]; c.broken = true; c._set('interrupted'); });
for (let i = 0; i < 4; i++) { await page.keyboard.press("KeyX"); await sleep(60); }
s = await fa();
check(s.ctxs.length === 3 && s.ctxs[2] === 'running' && playing(s) === 1, 'resume keeps failing: a fresh AudioContext on a following gesture, music back once', JSON.stringify({ ctxs: s.ctxs, playing: playing(s) }));

await bctx.close();
await browser.close();
server.close();
console.log(failed ? `\naudio test FAILED: ${failed}` : '\naudio test: all passed');
process.exit(failed ? 1 : 0);
