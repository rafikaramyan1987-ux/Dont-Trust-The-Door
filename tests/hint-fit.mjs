// Every trap hint of every level in the in-game hint box at 640×360, in all 8 languages: at most 3 lines and inside
// the screen (the self-test checks the longest hint only). Usage: npm run build && node tests/hint-fit.mjs
import { serveDist, launch, openGame } from './harness.mjs';
const LANGS = ['en', 'fr', 'de', 'es', 'pt-BR', 'it', 'ru', 'tr'];
const { server, url } = await serveDist();
const browser = await launch();
const { page, ctx } = await openGame(browser, url, { viewport: { width: 640, height: 360 }, context: { isMobile: true, hasTouch: true } });
const bad = await page.evaluate((langs) => {
  const T = window.__DTTD;
  const out = [];
  T.setManual(true);
  for (const l of langs) {
    T.lang(l);
    T.start(5); T.step(3);
    const g = T.game.scene.getScene('Game');
    for (let id = 1; id <= T.levels; id++) for (const tr of T.levelData(id).trolls) {
      const s = T.t(tr.hint);
      const box = g.showHintBox(s);
      T.step(2);
      const tx = box.list[2];
      const L = g.lay;
      if (tx.displayHeight > 3 * 34 || box.getData('w') > L.right - L.left - 30 || tx.displayWidth > box.getData('w') - 80) out.push(`${l} L${id} ${tr.hint}: ${tx.displayWidth.toFixed(0)}×${tx.displayHeight.toFixed(0)} (${s.length} chars)`);
      box.destroy();
    }
  }
  return out;
}, LANGS);
console.log(bad.length ? bad.join('\n') : 'every hint fits in 3 lines in all 8 languages');
await ctx.close(); await browser.close(); server.close();
process.exit(bad.length ? 1 : 0);
