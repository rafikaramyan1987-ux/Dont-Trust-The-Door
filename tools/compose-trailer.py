"""Composites the vertical (9:16) trailer frames from captured game frames + text overlays.

Layout (1080×1920): title on top, the square gameplay crop in the middle, a punchy caption
below. The video ends on an end card asking the viewer a question, and its last 0.5 s
cross-fades into the very first frame so the clip loops seamlessly.
Called by tools/capture-media.mjs; input/output live in the folder passed as argv[1].
"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

tmp = sys.argv[1]
cfg = json.load(open(os.path.join(tmp, "compose.json")))
W, H, G, FPS = cfg["W"], cfg["H"], cfg["GAME"], cfg["FPS"]
out = os.path.join(tmp, "out")
os.makedirs(out, exist_ok=True)

GY = 430  # top of the gameplay square


def background():
    bg = Image.new("RGB", (W, H), (43, 45, 66))
    d = ImageDraw.Draw(bg)
    for y in range(0, H, 36):  # subtle dotted pattern, like the game
        for x in range(18 if (y // 36) % 2 else 0, W, 36):
            d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=(58, 61, 88))
    return bg


BG = background()
frame_mask = Image.new("L", (G, G), 0)
ImageDraw.Draw(frame_mask).rounded_rectangle((0, 0, G - 1, G - 1), radius=48, fill=255)
header = Image.open(os.path.join(tmp, "header.png")).convert("RGBA")
caps = [Image.open(os.path.join(tmp, f"cap{i}.png")).convert("RGBA") for i in range(len(cfg["clips"]))]
end = Image.open(os.path.join(tmp, "end.png")).convert("RGBA")


def compose(game_img, caption, cap_age):
    f = BG.copy()
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((0, GY + 16, W, GY + G + 16), radius=48, fill=(0, 0, 0, 110))
    f.paste(shadow.filter(ImageFilter.GaussianBlur(10)), (0, 0), shadow.filter(ImageFilter.GaussianBlur(10)))
    f.paste(game_img, (0, GY), frame_mask)
    f.paste(header, (0, 0), header)
    if caption is not None:
        # caption pops in with a quick scale bounce
        k = min(1.0, cap_age / 0.18)
        s = 0.6 + 0.4 * k + 0.12 * math.sin(k * math.pi)
        if abs(s - 1) > 0.01:
            cw, ch = int(W * s), int(H * s)
            c = caption.resize((cw, ch), Image.BILINEAR)
            cy = 1660
            f.paste(c, (int(W / 2 - cw / 2), int(cy - cy * s)), c)
        else:
            f.paste(caption, (0, 0), caption)
    return f


frames = []
n = cfg["frames"]
meta = cfg["meta"]
cap_start = cfg["capStart"]
first = None
for i in range(n):
    g = Image.open(os.path.join(tmp, "frames", f"g{i:04d}.png")).convert("RGB")
    ci = meta[i]
    fr = compose(g, caps[ci], (i - cap_start[ci]) / FPS)
    if first is None:
        first = fr
    fr.save(os.path.join(out, f"f{i:04d}.jpg"), quality=92)
    last_game = g

# End card: frozen, darkened last gameplay frame + the question; then loop cross-fade.
end_frames = int(cfg["end"] * FPS)
fade = int(0.5 * FPS)
base = compose(last_game, None, 0)
dark = Image.blend(base, Image.new("RGB", (W, H), (43, 45, 66)), 0.72)
for j in range(end_frames):
    t = j / FPS
    k = min(1.0, t / 0.25)
    s = 0.7 + 0.3 * k + 0.08 * math.sin(k * math.pi)
    e = end.resize((int(W * s), int(H * s)), Image.BILINEAR)
    fr = dark.copy()
    fr.paste(e, (int(W / 2 - e.width / 2), int(H / 2 - e.height / 2)), e)
    if j >= end_frames - fade:
        a = (j - (end_frames - fade) + 1) / fade
        fr = Image.blend(fr, first, a)
    fr.save(os.path.join(out, f"f{n + j:04d}.jpg"), quality=92)
print(f"composited {n + end_frames} frames")
