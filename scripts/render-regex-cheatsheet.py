#!/usr/bin/env python3
"""Render PoE2 stash-search / Scalpel Regex Tool cheat sheets as Sheets PNGs."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT_DIR = Path(__file__).resolve().parents[1] / "cheat-sheet-prefabs" / "regex"

BG = (22, 24, 30)
PANEL = (34, 37, 46)
PANEL_ALT = (40, 44, 56)
TEXT = (236, 238, 242)
MUTED = (150, 156, 172)
ACCENT = (200, 169, 110)
GOOD = (110, 200, 150)
BAD = (230, 120, 120)
CODE_BG = (16, 18, 24)
TITLE_BAR = (55, 80, 120)
WARN_BAR = (120, 70, 50)
TIP_BAR = (50, 95, 80)


def ui(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def mono(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        r"C:\Windows\Fonts\consolab.ttf" if bold else r"C:\Windows\Fonts\consola.ttf",
        r"C:\Windows\Fonts\courbd.ttf" if bold else r"C:\Windows\Fonts\cour.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
    ):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def rounded(draw: ImageDraw.ImageDraw, box, fill, radius=12):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def wrap_text(draw, text, fnt, max_w: int) -> list[str]:
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        tw = draw.textbbox((0, 0), trial, font=fnt)[2]
        if tw > max_w and cur:
            lines.append(cur)
            cur = w
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines


class Sheet:
    def __init__(self, w: int = 1200, h: int = 2600):
        self.W = w
        self.img = Image.new("RGB", (w, h), BG)
        self.draw = ImageDraw.Draw(self.img)
        self.y = 0
        self.margin = 36
        self.content_w = w - self.margin * 2

    def finish(self) -> Image.Image:
        return self.img.crop((0, 0, self.W, min(self.y + 28, self.img.height)))

    def title(self, main: str, sub: str):
        self.draw.text((self.margin, 28), main, font=ui(32, True), fill=TEXT)
        self.draw.text((self.margin + 2, 70), sub, font=ui(15), fill=MUTED)
        self.y = 110

    def card(self, title: str, bar, body_fn, tall: int = 1000):
        x = self.margin
        y0 = self.y
        rounded(self.draw, (x, y0, x + self.content_w, y0 + tall), PANEL, 12)
        self.y = y0 + 52
        body_fn()
        y1 = self.y + 14
        content = self.img.crop((x, y0 + 40, x + self.content_w, y1))
        self.draw.rectangle((x, y1, x + self.content_w, y0 + tall), fill=BG)
        rounded(self.draw, (x, y0, x + self.content_w, y1), PANEL, 12)
        self.img.paste(content, (x, y0 + 40))
        rounded(self.draw, (x, y0, x + self.content_w, y0 + 40), bar, 12)
        self.draw.rectangle((x, y0 + 20, x + self.content_w, y0 + 40), fill=bar)
        self.draw.text((x + 16, y0 + 8), title, font=ui(18, True), fill=TEXT)
        self.y = y1 + 18

    def gap(self, n: int = 8):
        self.y += n

    def para(self, text: str, fnt=None, fill=MUTED, indent: int = 18):
        fnt = fnt or ui(14)
        x = self.margin + indent
        for line in wrap_text(self.draw, text, fnt, self.content_w - indent - 16):
            self.draw.text((x, self.y), line, font=fnt, fill=fill)
            self.y += 20
        self.y += 4

    def bullet(self, label: str, detail: str):
        x = self.margin + 18
        self.draw.text((x, self.y), label, font=ui(15, True), fill=ACCENT)
        lw = self.draw.textbbox((0, 0), label, font=ui(15, True))[2]
        self.draw.text((x + lw + 10, self.y + 1), detail, font=ui(14), fill=MUTED)
        self.y += 26

    def code_chip(self, text: str) -> int:
        x = self.margin + 18
        f = mono(14)
        bbox = self.draw.textbbox((0, 0), text, font=f)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        pad_x, pad_y = 10, 6
        box = (x, self.y, x + tw + pad_x * 2, self.y + th + pad_y * 2)
        rounded(self.draw, box, CODE_BG, 8)
        self.draw.text((x + pad_x, self.y + pad_y - 1), text, font=f, fill=ACCENT)
        return box[2]

    def example(self, pattern: str, meaning: str, ok: bool = True):
        x = self.margin + 16
        h = 58
        rounded(self.draw, (x, self.y, x + self.content_w - 32, self.y + h), PANEL_ALT, 10)
        f = mono(14)
        bbox = self.draw.textbbox((0, 0), pattern, font=f)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        pad_x, pad_y = 10, 5
        chip = (x + 12, self.y + 8, x + 12 + tw + pad_x * 2, self.y + 8 + th + pad_y * 2)
        rounded(self.draw, chip, CODE_BG, 8)
        self.draw.text((chip[0] + pad_x, chip[1] + pad_y - 1), pattern, font=f, fill=ACCENT)
        badge = "MATCHES" if ok else "FAILS"
        color = GOOD if ok else BAD
        bb = self.draw.textbbox((0, 0), badge, font=ui(12, True))
        bw = bb[2] - bb[0]
        bx = x + self.content_w - 32 - bw - 28
        rounded(self.draw, (bx, self.y + 8, bx + bw + 16, self.y + 30), color, 8)
        self.draw.text((bx + 8, self.y + 10), badge, font=ui(12, True), fill=(18, 20, 24))
        self.draw.text((x + 12, self.y + 34), meaning, font=ui(13), fill=MUTED)
        self.y += h + 10

    def token_row(self, tok: str, meaning: str):
        right = self.code_chip(tok)
        self.draw.text((max(right, self.margin + 130) + 12, self.y + 8), meaning, font=ui(14), fill=TEXT)
        self.y += 38


def build_page1() -> Image.Image:
    s = Sheet()
    s.title("Regex Cheat Sheet", "PoE 2 · Stash / vendor search · Scalpel Regex Tool")

    def body_ops():
        for pattern, meaning in [
            ('"a" "b"', "AND — item must match both quoted groups"),
            ('"a|b"', "OR — match a OR b inside one group"),
            ('"!a|b"', "EXCLUDE — reject items matching a or b"),
            ('"a" "!b"', "Want a, avoid b (common Scalpel Want + Avoid)"),
            ("space between groups", "Always AND across separate quoted groups"),
        ]:
            s.example(pattern, meaning, True)

    def body_want():
        s.bullet("Any", '→ one OR group:  "modA|modB|modC"')
        s.bullet("All", '→ separate ANDs:  "modA" "modB" "modC"')
        s.gap(4)
        s.para(
            "Tip: start with Any while exploring. Switch to All when every selected mod must appear on the same item (stricter, longer regex)."
        )

    def body_abbr():
        s.para(
            "PoE stash search matches short unique substrings. Scalpel ships pre-picked tokens — you rarely type full sentences."
        )
        s.gap(4)
        for tok, meaning in [
            ("tual", "Ritual tablet type"),
            ("xped", "Expedition tablet type"),
            ("l fa", "Ritual Favours… (Omens mod)"),
            ("m q", "waystone / map quantity style tokens"),
        ]:
            s.token_row(tok, meaning)
        s.para(
            "Short tokens can false-positive. If search lights the wrong items, add a min value or pick a longer unique scrap in Custom."
        )

    def body_len():
        s.para(
            "PoE caps stash regex around ~250 characters. Scalpel shows length in the Regex Tool. Too long? Drop Avoids, use Any instead of All, or split into two searches."
        )

    s.card("1 · Operators (quotes matter)", TITLE_BAR, body_ops)
    s.card("2 · Scalpel Want: Any vs All", TIP_BAR, body_want, tall=400)
    s.card("3 · Abbreviations (not full mod text)", TITLE_BAR, body_abbr)
    s.card("4 · Length limit", WARN_BAR, body_len, tall=300)
    return s.finish()


def build_page2() -> Image.Image:
    s = Sheet()
    s.title("Regex Cheat Sheet · Numbers & Gotchas", "PoE 2 · Tablets · Waystones · Why mins sometimes fail")

    def body_nums():
        s.para(
            "When you set a min % in Scalpel, it builds a digit pattern then joins it to the mod token with .*"
        )
        s.gap(4)
        s.example(
            '"(3[5-9]|[4-9]\\d).*ze i"',
            "Typical number-first mod (roll appears before the unique scrap)",
            True,
        )
        s.para(
            "Most ##% mods print the number first on the line, so NUMBER then token works. Round-to-10 (waystones) coarsens the digit pattern on purpose."
        )

    def body_gotcha():
        s.para(
            'Some tablet mods put unique text before the roll. Classic: Ritual Favours / Omens — token "l fa" sits in "Ritual Favours", then the % appears later.'
        )
        s.gap(2)
        s.draw.text((s.margin + 18, s.y), "Item line:", font=ui(14, True), fill=TEXT)
        s.y += 22
        s.para(
            "Ritual Favours in Map have 54(35-70)% increased chance to be Omens",
            fnt=mono(13),
            fill=ACCENT,
        )
        s.example(
            '"(3[5-9]|…).*l fa"',
            "Broken (poe2.re / old Scalpel) — looks for number BEFORE l fa",
            False,
        )
        s.example(
            '"l fa.*(3[5-9]|…)"',
            "Fixed Scalpel — token first, then min pattern",
            True,
        )
        s.para(
            "Same class of bug: other tablet mods where the scrap is early on the line (tribute / remnant / exile counts). Bare token without a min still finds the mod."
        )

    def body_tools():
        for name, detail in [
            ("Waystones", "Tier, rarity, pack/quant mins, want/avoid map mods"),
            ("Tablets", "Type (ritual/expedition/…), uses left, tablet affixes + mins"),
            ("Vendor", "Buy window — OR inside a group, AND across groups"),
            ("Relic / Custom", "Sanctum relics or free-form tokens you type"),
        ]:
            s.bullet(name, detail)
        s.gap(4)
        s.para(
            "Sheets = reference overlay. Regex Tool = generate & copy. Bind both in Settings → Macros / Sheets."
        )

    def body_debug():
        checks = [
            "Paste into stash Highlight — does anything light up with bare token only?",
            "If bare works but min fails → token/number order (see §6).",
            "If nothing matches → token too rare, wrong tablet type filter, or typo in Custom.",
            "If everything matches → token too short; raise min or narrow with All / type.",
        ]
        for i, c in enumerate(checks, 1):
            s.draw.text((s.margin + 18, s.y), f"{i}.", font=ui(14, True), fill=ACCENT)
            for line in wrap_text(s.draw, c, ui(14), s.content_w - 56):
                s.draw.text((s.margin + 40, s.y), line, font=ui(14), fill=MUTED)
                s.y += 20
            s.y += 4

    s.card("5 · Minimum values (NUMBER.*token)", TITLE_BAR, body_nums)
    s.card("6 · Token BEFORE the number (tablet gotcha)", WARN_BAR, body_gotcha, tall=1200)
    s.card("7 · Which Scalpel tab builds what", TIP_BAR, body_tools)
    s.card("8 · Quick debug checklist", TITLE_BAR, body_debug)
    return s.finish()


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "_name.txt").write_text("Regex\n", encoding="utf-8")
    (OUT_DIR / "_poe.txt").write_text("2\n", encoding="utf-8")

    p1 = build_page1()
    p2 = build_page2()
    out1 = OUT_DIR / "01-operators.png"
    out2 = OUT_DIR / "02-numbers-gotchas.png"
    p1.save(out1, "PNG", optimize=True)
    p2.save(out2, "PNG", optimize=True)
    print(f"wrote {out1} ({out1.stat().st_size} bytes) {p1.size}")
    print(f"wrote {out2} ({out2.stat().st_size} bytes) {p2.size}")


if __name__ == "__main__":
    main()
