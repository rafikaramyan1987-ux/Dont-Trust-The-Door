// Language selector: a panel listing the 8 languages by their own names. Used on the
// title screen and in the pause menu. The choice is saved.
import Phaser from 'phaser';
import { WORLD_W, WORLD_H } from './config';
import { LANGS, getLang, setLang, t } from './i18n';
import { Save } from './save';
import { Button, label, panel, fitText } from './ui';
import { makeExitSign } from './art';
import { isPortrait } from './layout';

export function currentLangName(): string {
  return LANGS.find((l) => l.code === getLang())?.name ?? 'English';
}

/**
 * Show the picker on top of `parent` (or the scene). `onChange` runs after a language was
 * chosen (scenes re-create themselves so every text is redrawn).
 */
export function openLanguagePicker(scene: Phaser.Scene, parent: Phaser.GameObjects.Container | null, onChange: () => void): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0).setDepth(300).setName('langpicker');
  if (parent) parent.add(c);
  const cx = WORLD_W / 2, cy = WORLD_H / 2;
  const blocker = scene.add.rectangle(cx, cy, WORLD_W * 3, WORLD_H * 3, 0x2b2d42, 0.6).setInteractive();
  c.add(blocker);
  // portrait: one column in the narrow design column
  const P = isPortrait(scene);
  c.add(panel(scene, cx, cy, P ? 440 : 640, P ? 740 : 520, 0xfff6d5));
  c.add(fitText(label(scene, cx, cy - (P ? 318 : 206), t('ui.language'), 40, '#ffd23f', 9), P ? 400 : 580));
  LANGS.forEach((l, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const on = l.code === getLang();
    const x = P ? cx : cx + (col ? 145 : -145), y = P ? cy - 250 + i * 68 : cy - 118 + row * 84;
    const b = new Button(scene, x, y, { w: P ? 360 : 270, h: P ? 60 : 66, text: l.name, fontSize: 26, color: on ? '#6fd36b' : '#5b8cff' }, () => {
      Save.setLang(l.code);
      setLang(l.code);
      makeExitSign(scene);
      c.destroy();
      onChange();
    });
    b.setName(`lang-${l.code}`);
    c.add(b);
  });
  const close = new Button(scene, cx, cy + (P ? 312 : 222),{ w: 200, h: 56, icon: 'left', text: t('ui.back'), fontSize: 22, color: '#ff8a5b' }, () => c.destroy());
  c.add(close);
  return c;
}
