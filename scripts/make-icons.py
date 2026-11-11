#!/usr/bin/env python3
"""Bangun ulang seluruh aset ikon SIMARC dari sumber SVG.

Sumber:
  build/appicon.svg        → detail penuh (≥48 px)
  build/appicon-small.svg  → disederhanakan (16–32 px)

Hasil:
  build/appicon.png                    1024×1024 (dipakai Wails & .deb)
  build/windows/icon.ico               ikon exe Windows (Wails)
  packaging/windows/simarc.ico         ikon installer & shortcut Windows
  packaging/linux/icons/<n>x<n>.png    ikon hicolor Linux
  frontend/public/images/logo-icon.svg favicon aplikasi

Pemakaian:  python3 scripts/make-icons.py
Prasyarat:  python3 + Pillow, Google Chrome (untuk meraster SVG).
"""
from __future__ import annotations

import shutil
import struct
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
LINUX_ICONS = ROOT / "packaging" / "linux" / "icons"
CHROME = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")

FULL_SIZES = (48, 64, 96, 128, 256, 512)
SMALL_SIZES = (16, 24, 32)


def render(svg: Path, png: Path, size: int) -> Image.Image:
    """Rasterkan SVG lewat Chrome headless (latar transparan)."""
    if CHROME is None:
        raise SystemExit("Google Chrome/Chromium tidak ditemukan untuk meraster SVG.")
    html = (
        "<!doctype html><html><head><meta charset='utf-8'><style>"
        f"html,body{{margin:0;padding:0;background:transparent;width:{size}px;height:{size}px;overflow:hidden}}"
        "svg{display:block;width:100%;height:100%}"
        "</style></head><body>" + svg.read_text(encoding="utf-8") + "</body></html>"
    )
    with tempfile.TemporaryDirectory(prefix="simarc-icon-") as tmp:
        page = Path(tmp) / "icon.html"
        page.write_text(html, encoding="utf-8")
        subprocess.run(
            [
                CHROME,
                "--headless=new",
                "--disable-gpu",
                "--hide-scrollbars",
                "--no-first-run",
                "--no-default-browser-check",
                "--force-device-scale-factor=1",
                "--default-background-color=00000000",
                f"--window-size={size},{size}",
                f"--screenshot={png}",
                page.as_uri(),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    img = Image.open(png).convert("RGBA")
    if img.size != (size, size):
        img = img.resize((size, size), Image.LANCZOS)
    return img


def write_ico(images: list[Image.Image], dest: Path) -> None:
    """Tulis .ico 32-bit (DIB) agar kompatibel dengan Windows 10/11."""
    entries, blobs, offset = [], [], 6 + 16 * len(images)
    for img in images:
        w, h = img.size
        bgra = img.tobytes("raw", "BGRA")
        rows = [bgra[y * w * 4 : (y + 1) * w * 4] for y in range(h)][::-1]  # bottom-up
        mask_stride = ((w + 31) // 32) * 4
        mask = b"\x00" * (mask_stride * h)
        header = struct.pack("<IiiHHIIiiII", 40, w, h * 2, 1, 32, 0, len(b"".join(rows)) + len(mask), 0, 0, 0, 0)
        blob = header + b"".join(rows) + mask
        entries.append(struct.pack("<BBBBHHII", w % 256, h % 256, 0, 0, 1, 32, len(blob), offset))
        blobs.append(blob)
        offset += len(blob)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(struct.pack("<HHH", 0, 1, len(images)) + b"".join(entries) + b"".join(blobs))


def main() -> None:
    tmp = Path(tempfile.mkdtemp(prefix="simarc-icons-"))
    try:
        full_master = render(BUILD / "appicon.svg", tmp / "full-1024.png", 1024)
        small_master = render(BUILD / "appicon-small.svg", tmp / "small-1024.png", 1024)

        full_master.save(BUILD / "appicon.png", optimize=True)
        print(f"✓ build/appicon.png (1024×1024)")

        by_size: dict[int, Image.Image] = {}
        for size in (16, 24, 32, 48, 64, 96, 128, 256, 512):
            src = small_master if size in SMALL_SIZES else full_master
            img = src.resize((size, size), Image.LANCZOS)
            by_size[size] = img
            if size in FULL_SIZES:
                LINUX_ICONS.mkdir(parents=True, exist_ok=True)
                img.save(LINUX_ICONS / f"{size}x{size}.png", optimize=True)

        ico_sizes = (16, 24, 32, 48, 64, 128, 256)
        ico_images = [by_size[s] for s in ico_sizes]
        for dest in (BUILD / "windows" / "icon.ico", ROOT / "packaging" / "windows" / "simarc.ico"):
            write_ico(ico_images, dest)
            print(f"✓ {dest.relative_to(ROOT)} ({len(ico_sizes)} ukuran)")

        shutil.copyfile(BUILD / "appicon.svg", ROOT / "frontend" / "public" / "images" / "logo-icon.svg")
        print("✓ frontend/public/images/logo-icon.svg")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
