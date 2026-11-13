// Language selector: a panel listing the 8 languages by their own names. Used on the
// title screen and in the pause menu. The choice is saved.
import Phaser from 'phaser';
import { WORLD_W, WORLD_H } from './config';
import { LANGS, getLang, setLang, t } from './i18n';
import { Save } from './save';
import { Button, label, panel, fitText } from './ui';
import { makeExitSign } from './art';

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
  c.add(panel(scene, cx, cy, 640, 520, 0xfff6d5));
  c.add(fitText(label(scene, cx, cy - 206, t('ui.language'), 40, '#ffd23f', 9), 580));
  LANGS.forEach((l, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const on = l.code === getLang();
    const b = new Button(scene, cx + (col ? 145 : -145), cy - 118 + row * 84, { w: 270, h: 66, text: l.name, fontSize: 26, color: on ? '#6fd36b' : '#5b8cff' }, () => {
      Save.setLang(l.code);
      setLang(l.code);
      makeExitSign(scene);
      c.destroy();
      onChange();
    });
    b.setName(`lang-${l.code}`);
    c.add(b);
  });
  const close = new Button(scene, cx, cy + 222, { w: 200, h: 56, icon: 'left', text: t('ui.back'), fontSize: 22, color: '#ff8a5b' }, () => c.destroy());
  c.add(close);
  return c;
}
