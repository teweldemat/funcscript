#!/usr/bin/env python3
"""Regenerate the FuncScript icon PNG from its SVG source."""

from __future__ import annotations

import math
import os
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont

SVG_NS = {"svg": "http://www.w3.org/2000/svg"}
FONT_DIRS = (
    Path("/System/Library/Fonts"),
    Path("/System/Library/Fonts/Supplemental"),
    Path("/Library/Fonts"),
    Path.home() / "Library" / "Fonts",
)
FONT_FILES: Dict[str, str] = {
    "Helvetica Neue": "HelveticaNeue.ttc",
    "Helvetica": "Helvetica.ttc",
    "Arial": "Arial.ttf",
}


def parse_dimension(value: str | None, fallback: Optional[int]) -> Optional[int]:
    if not value:
        return fallback
    cleaned = value.strip()
    if cleaned.endswith("px"):
        cleaned = cleaned[:-2]
    try:
        return int(round(float(cleaned)))
    except ValueError:
        return fallback


def parse_float(value: Optional[str], fallback: float) -> float:
    if value is None:
        return fallback
    cleaned = value.strip()
    if cleaned.endswith("px"):
        cleaned = cleaned[:-2]
    try:
        return float(cleaned)
    except ValueError:
        return fallback


def iter_font_candidates(name: str) -> Iterable[Path]:
    file_name = FONT_FILES.get(name)
    if file_name:
        for base in FONT_DIRS:
            candidate = base / file_name
            if candidate.exists():
                yield candidate
        return
    # Fall back to a loose prefix match if we do not have an explicit mapping.
    lowered = name.lower().replace(" ", "")
    for base in FONT_DIRS:
        if not base.exists():
            continue
        for item in base.iterdir():
            if item.is_file() and lowered in item.name.lower().replace(" ", ""):
                yield item


def resolve_font_path(families: Iterable[str]) -> Optional[Path]:
    for family in families:
        name = family.strip().strip("'\"")
        if not name or name.lower() == "sans-serif":
            continue
        for candidate in iter_font_candidates(name):
            return candidate
    helvetica = Path("/System/Library/Fonts/Helvetica.ttc")
    if helvetica.exists():
        return helvetica
    return None


class FontLoader:
    def __init__(self, families: Iterable[str]):
        self._families = list(families)
        self._path = resolve_font_path(self._families)
        self._cache: Dict[int, ImageFont.FreeTypeFont] = {}

    def get(self, size: float) -> ImageFont.ImageFont:
        size_px = int(round(size))
        if size_px not in self._cache:
            if self._path is not None:
                self._cache[size_px] = ImageFont.truetype(str(self._path), size_px)
            else:
                self._cache[size_px] = ImageFont.load_default()
        return self._cache[size_px]


def extract_text_segments(
    text_el: ET.Element, default_font_size: float
) -> Tuple[List[Tuple[str, str, float, float, float]], float]:
    letter_spacing = parse_float(text_el.get("letter-spacing"), 0.0)
    segments: List[Tuple[str, str, float, float, float]] = []
    for span in text_el.findall("svg:tspan", SVG_NS):
        content_raw = span.text or ""
        if not content_raw:
            continue
        content = content_raw.strip()
        if not content:
            continue
        color = span.get("fill") or text_el.get("fill") or "#000000"
        size = parse_float(span.get("font-size"), default_font_size)
        dx = parse_float(span.get("dx"), 0.0)
        dy = parse_float(span.get("dy"), 0.0)
        segments.append((content, color, size, dx, dy))
    if not segments:
        content_raw = text_el.text or ""
        content = content_raw.strip()
        if content:
            segments.append(
                (
                    content,
                    text_el.get("fill") or "#000000",
                    default_font_size,
                    0.0,
                    0.0,
                )
            )
    return segments, letter_spacing


def layout_characters(
    glyphs: Iterable[Tuple[str, str, ImageFont.ImageFont, float, float]],
    letter_spacing: float,
) -> Tuple[
    List[Tuple[float, str, str, ImageFont.ImageFont, float]],
    float,
    float,
    float,
    float,
]:
    cursor = 0.0
    min_x = math.inf
    max_x = -math.inf
    min_y = math.inf
    max_y = -math.inf
    positioned: List[Tuple[float, str, str, ImageFont.ImageFont, float]] = []
    char_list = list(glyphs)
    for idx, (ch, color, font, dx_before, baseline_offset) in enumerate(char_list):
        cursor += dx_before
        bbox = font.getbbox(ch)
        left = cursor + bbox[0]
        right = cursor + bbox[2]
        top = bbox[1] + baseline_offset
        bottom = bbox[3] + baseline_offset
        min_x = min(min_x, left)
        max_x = max(max_x, right)
        min_y = min(min_y, top)
        max_y = max(max_y, bottom)
        positioned.append((cursor, ch, color, font, baseline_offset))
        advance = font.getlength(ch)
        cursor += advance
        if idx < len(char_list) - 1:
            cursor += letter_spacing
    if math.isinf(min_x):
        raise ValueError("No characters found to render.")
    return positioned, min_x, max_x, min_y, max_y


def render(svg_path: Path, png_path: Path) -> None:
    tree = ET.parse(svg_path)
    root = tree.getroot()
    width = parse_dimension(root.get("width"), None)
    height = parse_dimension(root.get("height"), None)
    if width is None or height is None:
        view_box = root.get("viewBox")
        if view_box:
            parts = view_box.split()
            if len(parts) == 4:
                width = int(round(float(parts[2])))
                height = int(round(float(parts[3])))
    if width is None or height is None:
        width = height = 128

    rect = root.find("svg:rect", SVG_NS)
    background: Optional[str] = None
    if rect is not None:
        fill = rect.get("fill")
        if fill and fill.lower() != "none":
            background = fill

    text_el = root.find("svg:text", SVG_NS)
    if text_el is None:
        raise ValueError("SVG is missing a <text> element.")
    font_family = text_el.get("font-family", "Arial")
    default_size = parse_float(text_el.get("font-size"), 64.0)
    segments, letter_spacing = extract_text_segments(text_el, default_size)
    if not segments:
        raise ValueError("No text content found in SVG.")

    loader = FontLoader(font_family.split(","))
    glyphs: List[Tuple[str, str, ImageFont.ImageFont, float, float]] = []
    baseline_offset = 0.0
    for content, color, size, dx, dy in segments:
        baseline_offset += dy
        font = loader.get(size)
        first = True
        for ch in content:
            glyphs.append((ch, color, font, dx if first else 0.0, baseline_offset))
            first = False

    positioned, min_x, max_x, min_y, max_y = layout_characters(glyphs, letter_spacing)

    total_width = max_x - min_x
    total_height = max_y - min_y
    offset_x = (width - total_width) / 2 - min_x
    baseline_y = (height - total_height) / 2 - min_y

    bg_color = background if background is not None else (0, 0, 0, 0)
    image = Image.new("RGBA", (width, height), bg_color)
    draw = ImageDraw.Draw(image)
    for cursor, ch, color, font, dy in positioned:
        draw.text(
            (offset_x + cursor, baseline_y + dy),
            ch,
            font=font,
            fill=color,
            anchor="la",
        )
    image.save(png_path)


def main() -> int:
    base = Path(__file__).resolve().parent.parent / "media"
    svg_path = base / "funcscript-icon.svg"
    png_path = base / "funcscript-icon.png"
    render(svg_path, png_path)
    print(f"Wrote {png_path.relative_to(Path.cwd())}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
