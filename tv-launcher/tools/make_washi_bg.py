#!/usr/bin/env python3
"""
Paints the Washi theme wallpaper as an SVG (original artwork, 1920x1080):
snow mountain in muted teal, mist, pine line, arched bridge, pagoda and torii standing in a
still lake with reflections, cherry blossoms on the right edge, a small sun and birds.
Reds are deliberately muted (no bright vermilion) and the scene leaves the top-left sky and
the lake clear for the clock and cards.

    python3 tools/make_washi_bg.py [spring|summer|autumn|winter]   -> design/washi-bg-<season>.svg
Then tools/render_washi_bg.js turns it into app/src/main/assets/web/washi-bg.jpg.
"""
import math, pathlib, random, sys

random.seed(7)
W, H = 1920, 1080
WATER = 700  # waterline y

RED = "#b4615a"       # muted lacquer red
RED_D = "#8f4a46"
SLATE = "#2f3d48"      # roof tiles
NAVY = "#22344d"
SEASON = sys.argv[1] if len(sys.argv) > 1 else "spring"
SEASONS = {
    # foliage on the right-edge branches, sky gradient, water tint
    "spring": dict(leaf=["#e7b8ae", "#dea198", "#f0cdc5", "#d18e86", "#e9c2b9"], sky=("#f2ece2", "#eee4d8", "#e9ddd0"), water=("#b7cdc7", "#cbdad4", "#dfe6df")),
    "summer": dict(leaf=["#9cbf8f", "#86ad7c", "#b4cf9f", "#7aa274", "#a9c79a"], sky=("#f2efe4", "#eeeadc", "#e7e4d4"), water=("#a9c8c3", "#c2d8d2", "#dce7e0")),
    "autumn": dict(leaf=["#d79a6e", "#c9805e", "#e0b07d", "#b9705a", "#dca487"], sky=("#f3eadc", "#efe2cf", "#eadac4"), water=("#bccbc2", "#cfd9cf", "#e2e5dc")),
    "winter": dict(leaf=["#f7f5f0", "#eef0ef", "#e6ebea", "#fbfaf7", "#dfe6e5"], sky=("#eef0ef", "#e9ecea", "#e2e7e6"), water=("#b9cbcb", "#ccd8d8", "#e1e7e6")),
}[SEASON]
PINE = ["#2f4b49", "#3b5a56", "#466b65"]
BLOSSOM = SEASONS["leaf"]

out = []
def add(s): out.append(s)

def pine(x, base, h, color):
    """Stacked-tier pine silhouette."""
    tiers = 5
    w = h * 0.42
    pts = []
    for i in range(tiers):
        t = i / tiers
        y_top = base - h + t * h * 0.82
        ww = w * (0.35 + 0.65 * (i + 1) / tiers)
        pts.append(f'<polygon points="{x:.0f},{y_top:.0f} {x-ww/2:.0f},{y_top+h*0.30:.0f} {x+ww/2:.0f},{y_top+h*0.30:.0f}"/>')
    trunk = f'<rect x="{x-2:.0f}" y="{base-h*0.12:.0f}" width="4" height="{h*0.12:.0f}"/>'
    snow = ""
    if SEASON == "winter":  # snow resting on each tier
        for i in range(tiers):
            t = i / tiers
            y_top = base - h + t * h * 0.82
            ww = w * (0.35 + 0.65 * (i + 1) / tiers)
            snow += f'<polygon points="{x:.0f},{y_top:.0f} {x-ww*0.32:.0f},{y_top+h*0.13:.0f} {x+ww*0.28:.0f},{y_top+h*0.12:.0f}" fill="#f4f6f4"/>'
    return f'<g fill="{color}">{"".join(pts)}{trunk}{snow}</g>'

def pines(x0, x1, base, hmin, hmax, n, layer=0):
    s = []
    for _ in range(n):
        x = random.uniform(x0, x1)
        s.append(pine(x, base + random.uniform(-6, 10), random.uniform(hmin, hmax), PINE[min(2, layer + random.randint(0, 1))]))
    return "".join(s)

def blossom_cluster(cx, cy, r, n):
    s = []
    for _ in range(n):
        a = random.uniform(0, 2 * math.pi)
        d = r * math.sqrt(random.random())
        rr = random.uniform(5, 19)
        s.append(f'<circle cx="{cx+d*math.cos(a):.0f}" cy="{cy+d*math.sin(a)*0.8:.0f}" r="{rr:.0f}" fill="{random.choice(BLOSSOM)}" opacity="{random.uniform(.55,.9):.2f}"/>')
    return "".join(s)

# ---------------------------------------------------------------- defs
add(f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{SEASONS['sky'][0]}"/><stop offset=".55" stop-color="{SEASONS['sky'][1]}"/><stop offset="1" stop-color="{SEASONS['sky'][2]}"/>
  </linearGradient>
  <linearGradient id="mtn" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#5f8c8b"/><stop offset=".55" stop-color="#86aaa6"/><stop offset="1" stop-color="#b9cfca"/>
  </linearGradient>
  <linearGradient id="mtnShade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#2f5554" stop-opacity="0"/><stop offset="1" stop-color="#2f5554" stop-opacity=".35"/>
  </linearGradient>
  <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{SEASONS['water'][0]}"/><stop offset=".5" stop-color="{SEASONS['water'][1]}"/><stop offset="1" stop-color="{SEASONS['water'][2]}"/>
  </linearGradient>
  <filter id="wc" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency=".018" numOctaves="3" seed="3" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="16" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="wcSoft" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="2" seed="9" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation=".6"/>
  </filter>
  <filter id="mist" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="28"/></filter>
  <filter id="cloud" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="18"/></filter>
  <filter id="ripple" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".004 .09" numOctaves="2" seed="5" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="18" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="2.2"/>
  </filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="11" stitchTiles="stitch"/>
    <feColorMatrix values="0 0 0 0 .45 0 0 0 0 .40 0 0 0 0 .33 0 0 0 .10 0"/>
  </filter>
</defs>
''')

# ---------------------------------------------------------------- scene (above water)
scene = []
S = scene.append
S('<rect width="1920" height="1080" fill="url(#sky)"/>')
# soft clouds
for cx, cy, rx, ry, o in [(1080, 250, 260, 60, .7), (1290, 320, 200, 45, .55), (430, 330, 220, 40, .45), (980, 470, 300, 50, .6)]:
    S(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#fbf8f3" opacity="{o}" filter="url(#cloud)"/>')
# distant low ranges
S('<path d="M0 640 Q160 570 330 610 T640 600 L640 700 L0 700Z" fill="#bcd0cb" opacity=".8" filter="url(#wcSoft)"/>')
S('<path d="M1180 640 Q1400 560 1620 600 T1920 585 L1920 700 L1180 700Z" fill="#c2d4cf" opacity=".85" filter="url(#wcSoft)"/>')
# the mountain
mtn = "M160 690 C380 600 520 420 660 300 Q735 228 770 216 Q805 210 850 250 C990 380 1160 560 1420 690 Z"
S(f'<g filter="url(#wc)"><path d="{mtn}" fill="url(#mtn)"/><path d="{mtn}" fill="url(#mtnShade)"/>')
# snow cap with ragged lower edge
cap = ("M600 352 L660 300 Q735 228 770 216 Q805 210 850 250 L930 322 L905 336 L888 318 L872 372 L846 330 L826 405 "
       "L804 342 L786 420 L766 350 L744 398 L728 340 L706 380 L690 336 L664 366 L646 342 Z")
S(f'<path d="{cap}" fill="#f8f5ef"/>')
# ridge streaks
for d in ["M770 220 L752 330 L760 420", "M805 225 L842 330 L858 430", "M740 260 L700 350", "M820 240 L880 330 L900 360"]:
    S(f'<path d="{d}" fill="none" stroke="#dfe9e6" stroke-width="5" stroke-linecap="round" opacity=".7"/>')
S('</g>')
# mist bands
for cx, cy, rx, ry, o in [(720, 560, 520, 60, .9), (1180, 600, 420, 50, .8), (300, 610, 360, 45, .75), (930, 650, 600, 40, .7)]:
    S(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#f6f2ec" opacity="{o}" filter="url(#mist)"/>')
# tree lines
S(f'<g filter="url(#wcSoft)">{pines(0, 430, WATER, 70, 170, 26, 0)}{pines(860, 1060, WATER, 60, 120, 12, 1)}'
  f'{pines(1270, 1500, WATER-4, 80, 150, 12, 0)}{pines(1700, 1920, WATER, 70, 160, 12, 1)}</g>')
# low bank under the trees
S('<path d="M0 690 Q200 676 440 690 L440 704 L0 704Z" fill="#3b5a56" opacity=".6"/>')
S('<path d="M850 694 Q960 684 1080 696 L1080 704 L850 704Z" fill="#3b5a56" opacity=".5"/>')

# arched (taiko) bridge
def arch(y_end, peak, x0, x1):
    return f"M{x0} {y_end} Q{(x0+x1)/2} {peak} {x1} {y_end}"
br = ['<g filter="url(#wcSoft)">']
for i, x in enumerate(range(300, 820, 52)):
    t = (x - 250) / 620
    yd = 672 - 4 * (672 - 592) * t * (1 - t) + 6  # just under the deck curve
    br.append(f'<rect x="{x}" y="{yd:.0f}" width="9" height="{WATER+6-yd:.0f}" fill="{RED_D}" opacity="{0.9 if i % 2 else .75}"/>')
br.append(f'<path d="{arch(672, 512, 250, 870)}" fill="none" stroke="{RED}" stroke-width="18" stroke-linecap="round"/>')
br.append(f'<path d="{arch(640, 478, 262, 858)}" fill="none" stroke="{RED}" stroke-width="6"/>')
for x in range(280, 860, 34):
    t = (x - 250) / 620
    y1 = 672 - 4 * (672 - 592) * t * (1 - t)
    y2 = 640 - 4 * (640 - 559) * t * (1 - t)
    br.append(f'<line x1="{x}" y1="{y2:.0f}" x2="{x}" y2="{y1-6:.0f}" stroke="{RED}" stroke-width="4"/>')
br.append('</g>')
S("".join(br))

# pagoda on stilts + torii
pg = ['<g filter="url(#wcSoft)">']
cx = 1480
def roof(cx, y, half, depth, color=SLATE):
    return (f'<path d="M{cx-half} {y+depth} Q{cx-half*0.55} {y+depth*0.55} {cx-half*0.28} {y+4} L{cx} {y-10} '
            f'L{cx+half*0.28} {y+4} Q{cx+half*0.55} {y+depth*0.55} {cx+half} {y+depth} '
            f'Q{cx} {y+depth*0.62} {cx-half} {y+depth}Z" fill="{color}"/>')
pg.append(f'<rect x="{cx-3}" y="268" width="6" height="58" fill="{SLATE}"/><circle cx="{cx}" cy="270" r="6" fill="{SLATE}"/>')
pg.append(roof(cx, 330, 100, 46))
pg.append(f'<rect x="{cx-62}" y="368" width="124" height="54" fill="{RED}"/>')
for wx in (-44, -10, 24):
    pg.append(f'<rect x="{cx+wx}" y="382" width="20" height="26" fill="#efe6da" opacity=".85"/>')
pg.append(roof(cx, 418, 150, 52))
pg.append(f'<rect x="{cx-120}" y="462" width="240" height="10" fill="{RED_D}"/>')
for rx in range(cx - 118, cx + 120, 16):
    pg.append(f'<rect x="{rx}" y="470" width="4" height="20" fill="{RED}"/>')
pg.append(f'<rect x="{cx-122}" y="488" width="244" height="7" fill="{RED}"/>')
pg.append(f'<rect x="{cx-86}" y="495" width="172" height="52" fill="{RED}"/>')
pg.append(f'<rect x="{cx-70}" y="506" width="140" height="22" fill="{SLATE}" opacity=".55"/>')
pg.append(roof(cx, 540, 190, 46))
for px in (-130, -70, 70, 130):
    pg.append(f'<rect x="{cx+px-7}" y="582" width="14" height="{WATER+40-582}" fill="{RED}"/>')
pg.append(f'<rect x="{cx-150}" y="640" width="300" height="9" fill="{RED_D}"/>')
# torii
tx = 1735
pg.append(f'<path d="M{tx-118} 556 Q{tx} 538 {tx+118} 556 L{tx+112} 570 Q{tx} 556 {tx-112} 570Z" fill="{SLATE}"/>')
pg.append(f'<rect x="{tx-104}" y="568" width="208" height="12" fill="{RED}"/>')
pg.append(f'<rect x="{tx-96}" y="602" width="192" height="10" fill="{RED}"/>')
pg.append(f'<rect x="{tx-4}" y="580" width="8" height="22" fill="{RED}"/>')
for px in (-70, 70):
    pg.append(f'<rect x="{tx+px-8}" y="576" width="16" height="{WATER+44-576}" fill="{RED}"/>')
pg.append('</g>')
S("".join(pg))

# sun and birds
S(f'<circle cx="1590" cy="178" r="36" fill="#c06e62" opacity=".88" filter="url(#wcSoft)"/>')
bird = "M0 0 C8 -10 18 -12 26 -4 C30 -12 40 -16 52 -8 C40 -6 32 0 28 8 C22 2 12 -2 0 0Z"
for bx, by, sc, rot in [(1214, 150, .9, -8), (1290, 108, .65, 6), (1352, 196, 1.1, -14)]:
    S(f'<path d="{bird}" fill="{NAVY}" transform="translate({bx} {by}) rotate({rot}) scale({sc})" opacity=".9"/>')

scene_svg = "".join(scene)
add(scene_svg)

# ---------------------------------------------------------------- water and reflections
add(f'<rect x="0" y="{WATER}" width="{W}" height="{H-WATER}" fill="url(#water)"/>')
add(f'<g opacity=".32" filter="url(#ripple)" transform="translate(0 {2*WATER}) scale(1 -1)">'
    f'<g clip-path="none">{"".join(scene[3:])}</g></g>')
for _ in range(70):
    y = random.uniform(WATER + 6, H - 10)
    x = random.uniform(-100, W)
    add(f'<rect x="{x:.0f}" y="{y:.0f}" width="{random.uniform(60, 420):.0f}" height="{random.uniform(1, 3):.1f}" fill="#f4f1ea" opacity="{random.uniform(.25,.6):.2f}"/>')
# mist where the lake meets the bank
add(f'<ellipse cx="960" cy="{WATER+10}" rx="1100" ry="26" fill="#f2efe8" opacity=".75" filter="url(#mist)"/>')

# ---------------------------------------------------------------- cherry blossoms (right edge, low left)
cb = ['<g filter="url(#wcSoft)">']
cb.append('<path d="M1940 -20 C1840 60 1800 120 1720 160 M1830 90 C1800 150 1810 220 1780 260 M1940 300 C1860 340 1820 400 1760 420 '
          'M1940 520 C1880 540 1850 600 1820 640" fill="none" stroke="#4a3a36" stroke-width="7" stroke-linecap="round" opacity=".85"/>')
for cx, cy, r, n in [(1760, 150, 90, 70), (1870, 60, 90, 60), (1800, 260, 70, 45), (1830, 410, 95, 70), (1880, 560, 80, 50), (1900, 680, 60, 30)]:
    cb.append(blossom_cluster(cx, cy, r, n))
cb.append('<path d="M-20 820 C60 780 110 740 170 735 M40 800 C70 760 70 720 100 700" fill="none" stroke="#4a3a36" stroke-width="6" stroke-linecap="round" opacity=".8"/>')
for cx, cy, r, n in [(150, 735, 70, 45), (60, 790, 75, 50), (100, 700, 50, 25)]:
    cb.append(blossom_cluster(cx, cy, r, n))
# a few falling petals baked in
for _ in range(14):
    x, y = random.uniform(1200, 1900), random.uniform(80, 900)
    cb.append(f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="6" ry="3.5" fill="{random.choice(BLOSSOM)}" transform="rotate({random.uniform(0,180):.0f} {x:.0f} {y:.0f})" opacity=".8"/>')
cb.append('</g>')
add("".join(cb))

# ---------------------------------------------------------------- winter snowfall
if SEASON == "winter":
    flakes = "".join(f'<circle cx="{random.uniform(0, W):.0f}" cy="{random.uniform(0, H):.0f}" r="{random.uniform(1.5, 4):.1f}" fill="#ffffff" opacity="{random.uniform(.5, .9):.2f}"/>' for _ in range(160))
    add(f'<g>{flakes}</g>')

# ---------------------------------------------------------------- paper grain
add(f'<rect width="{W}" height="{H}" filter="url(#grain)"/>')
add('</svg>')

dest = pathlib.Path(__file__).resolve().parent.parent / f"design/washi-bg-{SEASON}.svg"
dest.write_text("".join(out), encoding="utf-8")
print("wrote", dest, f"{dest.stat().st_size//1024} KB")
