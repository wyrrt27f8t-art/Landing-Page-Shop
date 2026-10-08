#!/usr/bin/env python3
"""Baut das MAFO-TikTok-Video (1080x1920, 17 s) aus dem vorhandenen Website-Material.
Aufruf: python3 build.py   (braucht ffmpeg mit drawtext und die Schrift Inter)"""
import os, subprocess, sys, tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MEDIA = os.path.join(ROOT, "media")
OUT = os.path.join(os.path.dirname(__file__), "mafo-organizer-v2.mp4")
FONT = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
W, H, FPS = 1080, 1920, 30
tmp = tempfile.mkdtemp(prefix="mafo_")

ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
       "-r", str(FPS), "-an"]


def text_filters(lines, y0, box):
    """lines: Liste aus (Text, Schriftgrösse). Jede Zeile zentriert, ab Sekunde 0 sichtbar."""
    out, y = [], y0
    for i, (txt, size) in enumerate(lines):
        p = os.path.join(tmp, f"t{abs(hash((txt, y)))}.txt")
        with open(p, "w", encoding="utf-8") as f:
            f.write(txt)
        style = (f"boxcolor=black@0.55:boxborderw=22:box=1" if box
                 else "borderw=6:bordercolor=black@0.85:shadowx=0:shadowy=4:shadowcolor=black@0.5")
        out.append(f"drawtext=fontfile={FONT}:textfile={p}:fontsize={size}:fontcolor=white:"
                   f"x=(w-text_w)/2:y={y}:{style}")
        y += int(size * 1.28) + (28 if box else 4)
    return ",".join(out)


def run(args):
    r = subprocess.run(["ffmpeg", "-v", "error", "-y"] + args, capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr)


def zoom(z0, z1, dur):
    # Zoom per Bild: Skalierung wächst mit t, danach mittig auf 1080x1920 zugeschnitten
    return (f"scale=w='{W}*({z0}+({z1}-{z0})*t/{dur})':h=-2:eval=frame:flags=bicubic,"
            f"crop={W}:{H}")


def hero(name, start, dur, lines, z0, z1):
    vf = (f"crop=579:1030:14:0,scale={W}:{H}:flags=lanczos,{zoom(z0, z1, dur)},"
          f"{text_filters(lines, 230, False)}")
    run(["-ss", str(start), "-t", str(dur), "-i", f"{MEDIA}/hero.mp4", "-vf", vf] + ENC + [name])


def photo_crop(name, box, dur, lines, z0, z1):
    cw, ch, x, y = box
    vf = (f"crop={cw}:{ch}:{x}:{y},scale={W}:{H}:flags=lanczos,{zoom(z0, z1, dur)},"
          f"{text_filters(lines, 230, True)}")
    run(["-loop", "1", "-framerate", str(FPS), "-t", str(dur), "-i", f"{MEDIA}/produkt/set.jpg",
         "-vf", vf] + ENC + [name])


def photo_whole(name, dur, lines, z0, z1):
    fc = (f"color=c=white:s={W}x{H}:r={FPS}[bg];"
          f"[0]scale=w='{W}*({z0}+({z1}-{z0})*t/{dur})':h=-2:eval=frame[fg];"
          f"[bg][fg]overlay=(W-w)/2:(H-h)/2:eval=frame:shortest=1,{text_filters(lines, 230, True)}")
    run(["-loop", "1", "-framerate", str(FPS), "-t", str(dur), "-i", f"{MEDIA}/produkt/set.jpg",
         "-filter_complex", fc] + ENC + [name])


def rundum(name, lines):
    fc = (f"[0]split[a][b];"
          f"[b]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},gblur=sigma=35[bg];"
          f"[a]scale={W}:-2:flags=lanczos[fg];"
          f"[bg][fg]overlay=(W-w)/2:(H-h)/2+120,{text_filters(lines, 190, False)}")
    run(["-framerate", "10", "-start_number", "26", "-i", f"{MEDIA}/rundum/%02d.webp",
         "-filter_complex", fc, "-t", "2.5"] + ENC + [name])


clips = []
def c(n): 
    p = os.path.join(tmp, n); clips.append(p); return p

# 1 Hook, 0,0 bis 2,5 s
hero(c("c1.mp4"), 0.0, 2.5, [("Was steckt in", 118), ("dieser Tasche?", 118)], 1.0, 1.06)
# 2 Überleitung, 2,5 bis 4,5 s
hero(c("c2.mp4"), 3.3, 2.0, [("Kein Gesuche mehr.", 92), ("Das ist drin:", 92)], 1.0, 1.05)
# 3 bis 5 Inhalt, je ein Teil
photo_crop(c("c3.mp4"), (600, 1067, 520, 0), 2.0, [("Tasche", 100), ("33 × 17 × 38 cm", 100)], 1.0, 1.12)
photo_crop(c("c4.mp4"), (540, 960, 660, 240), 2.0, [("2 faltbare", 100), ("Silikonnäpfe, Ø 13 cm", 80)], 1.0, 1.12)
photo_crop(c("c5.mp4"), (675, 1200, 60, 0), 1.5, [("2 Futter- und", 96), ("Leckerli-Taschen", 96)], 1.0, 1.08)
# 6 Matte
photo_whole(c("c6.mp4"), 2.0, [("Wasserfeste Matte", 92), ("60 × 40 cm", 100)], 1.3, 1.0)
# 7 Marke, ab hier erlaubt
rundum(c("c7.mp4"), [("MAFO", 160), ("Dog Travel Organizer", 80), ("Ordnung für überall.", 64)])
# 8 Loop mit Speichern-CTA
hero(c("c8.mp4"), 0.0, 2.5, [("Speichern für deine", 88), ("nächste Packliste", 88)], 1.0, 1.0)

lst = os.path.join(tmp, "list.txt")
with open(lst, "w") as f:
    f.writelines(f"file '{p}'\n" for p in clips)
run(["-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", OUT])
print("fertig:", OUT)
