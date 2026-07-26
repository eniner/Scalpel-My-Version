#!/usr/bin/env python3
"""Render the PoE2 Expedition rumor/map tier list as a Scalpel cheat-sheet PNG."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / "cheat-sheet-prefabs" / "expedition" / "expedition-tier-list.png"

# Match the Google Sheet column / section colors closely.
COL_RUMOR = (198, 239, 206)  # green
COL_MAP = (255, 229, 153)  # orange/yellow
COL_MODS = (164, 194, 244)  # blue
COL_RATING = (234, 153, 153)  # pink/red
COL_SECTION = {
    "rumors": (183, 225, 205),
    "unique": (246, 178, 107),
    "bosses": (234, 153, 153),
    "sagas": (182, 215, 168),
}
BG = (24, 26, 32)
PANEL = (36, 39, 48)
TEXT = (236, 238, 242)
MUTED = (160, 166, 180)
LINE = (58, 62, 74)

RUMORS = [
    ("Fallen Stars", "Moor", "Runestones", "S+"),
    ("Cold as ice", "Frigid Bluffs", "Old Expedition", "A+"),
    ("Nothing to drink", "Stagnant Basin", "Oil", "A"),
    ("Endless Cliffs", "Craggy Peninsula", "Rarity/Rogue Exiles", "A"),
    ("Sulphite!", "Scorched Cay", "Increased Rarity", "A"),
    ("Unknown Ruins", "Exhumed Ruins", "Precursor Leylines", "B"),
    ("Something Fishy", "Bleached Shoals", "Gold", "B"),
    ("It's Warm", "Lush Island", "Exp/Beyond/Hoards", "B"),
    ("Bleak and Awful", "Barren Atoll", "Strongbox", "B"),
    ("It's Dry At Least", "Sloughed Gully", "Monster effectiveness", "D"),
    ("Wild, Roaming Free", "Grazed Prairie", "Azmeri Spirits", "D"),
]

UNIQUES = [
    ("Reflective Waters", "Lake of Kalandra", "Ring Bases", "A"),
    ("All that Glitters", "Castaway", "Gold", "A"),
    ("Almost paradise", "Untainted Paradise", "Exp", "C"),
    ("A good fellow", "Moment of Zen", "Seer", "C"),
]

BOSSES = [
    ("Origin of the Fall", "Obscure Island", "Olroth", "A"),
    ("Stardrinker", "Secluded Temple", "Uhtred", "A"),
    ("Last To Fall", "Mournful Cliffside", "Vorana", "B"),
    ("End of the Circle", "Sprawling Jungle", "Medved", "B"),
]

SAGAS = [
    ("Aldurs", "—", "Buffs expeditions", "S+ (gamble)"),
    ("Olroth", "Obscure Island", "Boss Node", "A"),
    ("Uhtred", "Secluded Temple", "Boss Node", "B+"),
    ("Medved", "Strange Jungle", "Boss Node", "B+"),
    ("Vorana", "Mournful Cliffside", "Boss Node", "B+"),
]

NOTES = (
    "Tablets: prefer rarity / rare mobs / effectiveness. "
    "Big +2 tablet spends usually aren't worth it — ~150 rarity on gear "
    "pulls similar raw div. Source: community Expedition Cheatsheet."
)

RATING_COLOR = {
    "S+": (80, 220, 140),
    "S+ (gamble)": (80, 220, 140),
    "A+": (120, 210, 120),
    "A": (170, 210, 110),
    "B+": (210, 190, 90),
    "B": (220, 170, 80),
    "C": (220, 140, 90),
    "D": (220, 100, 100),
}


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\calibrib.ttf" if bold else r"C:\Windows\Fonts\calibri.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def draw_rounded(draw: ImageDraw.ImageDraw, box, fill, radius=10):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def cell_text(draw, xy, text, fnt, fill=TEXT, max_w=None):
    draw.text(xy, text, font=fnt, fill=fill)


def rating_badge(draw, cx, cy, rating, fnt):
    color = RATING_COLOR.get(rating, (200, 200, 200))
    bbox = draw.textbbox((0, 0), rating, font=fnt)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad_x, pad_y = 10, 4
    box = (cx - tw // 2 - pad_x, cy - th // 2 - pad_y, cx + tw // 2 + pad_x, cy + th // 2 + pad_y)
    draw.rounded_rectangle(box, radius=8, fill=(*color[:3],))
    # dark text on bright badges
    draw.text((cx - tw // 2, cy - th // 2 - 1), rating, font=fnt, fill=(18, 20, 24))


def draw_table(draw, x, y, headers, rows, col_w, row_h, header_fills, title=None, title_fill=None):
    f_title = font(22, True)
    f_head = font(15, True)
    f_cell = font(15)
    f_rate = font(14, True)
    cur_y = y
    table_w = sum(col_w)

    if title:
        draw_rounded(draw, (x, cur_y, x + table_w, cur_y + 36), title_fill or COL_SECTION["rumors"], 8)
        draw.text((x + 14, cur_y + 6), title, font=f_title, fill=(20, 22, 26))
        cur_y += 44

    # header
    hx = x
    for i, (h, w, fill) in enumerate(zip(headers, col_w, header_fills)):
        draw.rectangle((hx, cur_y, hx + w, cur_y + row_h), fill=fill)
        draw.text((hx + 10, cur_y + 8), h, font=f_head, fill=(20, 22, 26))
        hx += w
    cur_y += row_h

    for ri, row in enumerate(rows):
        bg = (42, 45, 56) if ri % 2 == 0 else (34, 37, 46)
        draw.rectangle((x, cur_y, x + table_w, cur_y + row_h), fill=bg)
        cx = x
        for i, (val, w) in enumerate(zip(row, col_w)):
            if i == len(row) - 1:
                rating_badge(draw, cx + w // 2, cur_y + row_h // 2, val, f_rate)
            else:
                draw.text((cx + 10, cur_y + 8), val, font=f_cell, fill=TEXT)
            # column separators
            draw.line((cx, cur_y, cx, cur_y + row_h), fill=LINE, width=1)
            cx += w
        draw.line((x, cur_y + row_h, x + table_w, cur_y + row_h), fill=LINE, width=1)
        cur_y += row_h

    # outer border
    draw.rectangle((x, y if not title else y + 44, x + table_w, cur_y), outline=LINE, width=1)
    return cur_y + 18


def main():
    W, H = 1100, 1680
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    f_h1 = font(34, True)
    f_sub = font(15)
    draw.text((36, 28), "Expedition Cheatsheet", font=f_h1, fill=TEXT)
    draw.text((38, 72), "PoE 2 · Rumors · Unique Maps · Bosses · Sagas", font=f_sub, fill=MUTED)

    headers = ["Rumor", "Map Type", "Mods", "Rating"]
    col_w = [250, 230, 280, 140]
    header_fills = [COL_RUMOR, COL_MAP, COL_MODS, COL_RATING]
    x, y = 40, 110
    row_h = 34

    y = draw_table(
        draw,
        x,
        y,
        headers,
        RUMORS,
        col_w,
        row_h,
        header_fills,
        title="Rumors",
        title_fill=COL_SECTION["rumors"],
    )
    y = draw_table(
        draw,
        x,
        y,
        ["Unique Map", "Location", "Mods", "Rating"],
        UNIQUES,
        col_w,
        row_h,
        header_fills,
        title="Unique Maps",
        title_fill=COL_SECTION["unique"],
    )
    y = draw_table(
        draw,
        x,
        y,
        ["Rumor / Event", "Map", "Boss", "Rating"],
        BOSSES,
        col_w,
        row_h,
        header_fills,
        title="Bosses",
        title_fill=COL_SECTION["bosses"],
    )
    y = draw_table(
        draw,
        x,
        y,
        ["Saga", "Map", "Node / Effect", "Rating"],
        SAGAS,
        col_w,
        row_h,
        header_fills,
        title="Sagas",
        title_fill=COL_SECTION["sagas"],
    )

    # Notes panel
    notes_h = 120
    draw_rounded(draw, (x, y, x + sum(col_w), y + notes_h), (45, 70, 110), 10)
    draw.text((x + 16, y + 12), "Notes", font=font(18, True), fill=(220, 235, 255))
    # wrap notes
    f_note = font(14)
    words = NOTES.split()
    lines, cur = [], ""
    max_chars = 92
    for w in words:
        trial = f"{cur} {w}".strip()
        if len(trial) > max_chars:
            lines.append(cur)
            cur = w
        else:
            cur = trial
    if cur:
        lines.append(cur)
    for i, line in enumerate(lines[:4]):
        draw.text((x + 16, y + 42 + i * 18), line, font=f_note, fill=(210, 225, 245))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    # crop bottom empty space
    final_h = y + notes_h + 36
    cropped = img.crop((0, 0, W, final_h))
    cropped.save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes) {cropped.size}")


if __name__ == "__main__":
    main()
