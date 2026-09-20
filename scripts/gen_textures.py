#!/usr/bin/env python3
"""
gen_textures.py — menyiapkan tekstur turunan yang tidak tersedia di sumber.

Tugas:
  1. Konversi peta .tif (normal & specular Bumi) menjadi JPEG yang ramah web,
     lalu hapus .tif agar hemat ruang.
  2. Buat peta normal (Sobel) dari albedo untuk benda langit yang tidak
     punya peta normal resmi: Merkurius, Venus (permukaan), Bulan.
  3. Buat tekstur noise fbm yang bisa di-tile, dipakai shader untuk turbulensi
     pita awan Jupiter, korona Matahari, dan detail awan Bumi.
  4. Buat tekstur prosedural untuk bulan-bulan kecil tanpa citra resmi:
     Io, Europa, Ganymede, Callisto, Titan, Triton, Phobos, Deimos, Enceladus.

Jalankan:  python3 scripts/gen_textures.py [--keep-tif]
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
TEX = ROOT / "public" / "textures"

# ---------------------------------------------------------------------------
# Utilitas
# ---------------------------------------------------------------------------

def log(msg: str) -> None:
    print(f"  {msg}")


def kb(path: Path) -> str:
    return f"{path.stat().st_size / 1024 / 1024:.2f} MB"


def save_jpeg(img: Image.Image, path: Path, quality: int = 92, subsampling: int = 0) -> None:
    """Simpan JPEG. subsampling=0 (4:4:4) penting untuk peta normal agar
    tidak ada artefak warna yang merusak arah normal."""
    path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(path, "JPEG", quality=quality, subsampling=subsampling,
                            optimize=True, progressive=True)
    log(f"{path.relative_to(TEX)}  {img.size[0]}x{img.size[1]}  {kb(path)}")


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG", optimize=True)
    log(f"{path.relative_to(TEX)}  {img.size[0]}x{img.size[1]}  {kb(path)}")


def blur(arr: np.ndarray, radius: float) -> np.ndarray:
    """Gaussian blur ringan pada array float 2D."""
    if radius <= 0:
        return arr
    img = Image.fromarray(np.clip(arr * 255.0, 0, 255).astype(np.uint8))
    img = img.filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(img, dtype=np.float32) / 255.0


def normal_from_luma(src: Image.Image, strength: float = 2.6, smooth: float = 1.6,
                     size: tuple[int, int] | None = None) -> Image.Image:
    """Buat peta normal tangent-space dari kecerahan sebuah citra.

    Konvensi yang dihasilkan (dan yang dipatuhi shader di src/shaders/planet.js):
        R = komponen X  ->  -d(luma)/d(kolom)     (ke kanan tekstur)
        G = komponen Y  ->  +d(luma)/d(baris)     (ke bawah tekstur)
        B = komponen Z  ->  selalu positif
    Karena three.js memuat tekstur dengan flipY=true, arah +G di sini setara
    dengan +V pada koordinat UV.
    """
    if size is not None and src.size != size:
        src = src.resize(size, Image.LANCZOS)

    g = np.asarray(src.convert("L"), dtype=np.float32) / 255.0
    # Kurangi pencahayaan yang sudah "terbakar" di foto asli, supaya relief
    # yang dihasilkan murni dari topografi dan tidak menimbulkan dua bayangan.
    g = blur(g, smooth)

    gy, gx = np.gradient(g)
    nx = -gx * strength
    ny = gy * strength
    nz = np.ones_like(g)

    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    out = np.stack([nx / length, ny / length, nz / length], axis=-1)
    out = np.clip(out * 0.5 + 0.5, 0.0, 1.0)
    return Image.fromarray((out * 255.0).astype(np.uint8))


def _periodic_layer(lattice: np.ndarray, w: int, h: int) -> np.ndarray:
    """Perbesar lattice kecil ke (w, h) dengan interpolasi bilinear yang
    melingkar penuh -> hasilnya benar-benar bisa di-tile tanpa jahitan."""
    lh, lw = lattice.shape
    xs = np.arange(w, dtype=np.float32) * (lw / w)
    ys = np.arange(h, dtype=np.float32) * (lh / h)

    x0 = np.floor(xs).astype(np.int32)
    y0 = np.floor(ys).astype(np.int32)
    fx = (xs - x0)[None, :]
    fy = (ys - y0)[:, None]
    x1 = (x0 + 1) % lw
    y1 = (y0 + 1) % lh
    x0 %= lw
    y0 %= lh

    # smoothstep -> lebih halus dari interpolasi linear, jaringan lattice
    # tidak terlihat sebagai pola kotak.
    sx = fx * fx * (3.0 - 2.0 * fx)
    sy = fy * fy * (3.0 - 2.0 * fy)

    c00 = lattice[np.ix_(y0, x0)]
    c10 = lattice[np.ix_(y0, x1)]
    c01 = lattice[np.ix_(y1, x0)]
    c11 = lattice[np.ix_(y1, x1)]

    top = c00 + (c10 - c00) * sx
    bot = c01 + (c11 - c01) * sx
    return (top + (bot - top) * sy).astype(np.float32)


def tileable_fbm(size: tuple[int, int], octaves: int = 6, base: int = 4,
                 seed: int = 20260920, persistence: float = 0.5) -> np.ndarray:
    """Nilai fbm periodik -> mulus di tepi sehingga bisa di-tile tanpa jahitan.

    Dipakai sebagai gelombang peng-geser (warp) pada pita awan Jupiter dan
    sebagai detail pada korona Matahari.
    """
    rng = np.random.default_rng(seed)
    w, h = size
    accum = np.zeros((h, w), dtype=np.float32)
    amp = 1.0
    norm = 0.0
    freq = base

    for _ in range(octaves):
        lattice = rng.random((freq, freq * 2)).astype(np.float32)
        accum += _periodic_layer(lattice, w, h) * amp
        norm += amp
        amp *= persistence
        freq *= 2

    accum /= norm

    # Gradien vertikal halus: memberi variasi terang-gelap pada pita awan.
    v = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]
    bands = 0.5 + 0.5 * np.sin(v * np.pi * 9.0 + accum * 4.0)
    return np.clip(0.55 * accum + 0.45 * bands, 0.0, 1.0)


# ---------------------------------------------------------------------------
# 1. Konversi peta .tif -> JPEG
# ---------------------------------------------------------------------------

def convert_tiffs(keep: bool) -> None:
    """Peta normal & specular Bumi hanya tersedia sebagai .tif (tidak dibaca
    peramban). Peta normal 8K diturunkan ke 4K agar hemat VRAM, tetapi
    penyusutan itu menghaluskan deviasi normal sehingga relief medan ikut
    hilang. Karena itu amplitudo X/Y dikembalikan ke deviasi sumber
    (lihat normal_tiff_to_jpeg)."""
    jobs = [
        # (sumber, tujuan, ukuran, kualitas, peta normal?)
        ("earth/earth_normal.tif", "earth/earth_normal_4k.jpg", (4096, 2048), 92, True),
        ("earth/earth_normal.tif", "earth/earth_normal_2k.jpg", (2048, 1024), 92, True),
        ("earth/earth_specular.tif", "earth/earth_specular_4k.jpg", (4096, 2048), 90, False),
        ("earth/earth_specular.tif", "earth/earth_specular_2k.jpg", (2048, 1024), 90, False),
    ]
    used: set[Path] = set()

    for src_rel, dest_rel, size, quality, is_normal in jobs:
        src = TEX / src_rel
        if not src.exists():
            log(f"LEWAT {src_rel} (tidak ada)")
            continue
        try:
            with Image.open(src) as im:
                im.load()
                img = im.convert("RGB")
                if is_normal:
                    out = normal_tiff_to_jpeg(img, TEX / dest_rel, size, quality)
                else:
                    img = img.resize(size, Image.LANCZOS) if img.size != size else img
                    out = img
                    save_jpeg(out, TEX / dest_rel, quality=quality)
            used.add(src)
        except Exception as exc:  # noqa: BLE001
            log(f"GAGAL {src_rel}: {exc}")

    if not keep:
        for src in sorted(used):
            src.unlink()
            log(f"hapus {src.relative_to(TEX)} (sumber .tif)")


def normal_tiff_to_jpeg(img: Image.Image, dest: Path, size: tuple[int, int], quality: int) -> None:
    """Perkecil peta normal, lalu kembalikan amplitudo X/Y ke deviasi sumber.

    Peta normal Bumi dari sumbernya sudah halus (deviasi kanal R/G hanya sekitar
    ±4 dari nilai 128). Menurunkannya ke 4K dengan LANCZOS mengurangi deviasi
    itu lagi, sehingga relief gunung praktis hilang. Pengembalian amplitudo di
    ruang normal ini membuat relief tetap terbaca pada resolusi lebih rendah.
    """
    # Deviasi acuan diukur dengan menyampel piksel MENTAH sumber (bukan versi
    # yang sudah diperkecil — memperkecil lebih dulu justru menghapus deviasi
    # frekuensi tinggi yang ingin kita pertahankan).
    full = np.asarray(img, dtype=np.float32)
    stride = max(1, full.shape[0] // 512)
    base_std = float(full[::stride, ::stride, :2].std())
    del full

    small = img.resize(size, Image.LANCZOS) if img.size != size else img
    arr = np.asarray(small, dtype=np.float32)
    cur_std = float(arr[..., :2].std())

    gain = base_std / cur_std if cur_std > 0.5 else 1.0
    gain = float(np.clip(gain, 1.0, 4.0))
    if gain > 1.001:
        arr[..., :2] = (arr[..., :2] - 128.0) * gain + 128.0
    arr[..., 2] = 255.0
    arr[..., :2] = np.clip(arr[..., :2], 0.0, 255.0)

    log(f"{dest.name}: deviasi sumber {base_std:.2f} -> dikali {gain:.2f}x "
        f"(deviasi hasil {cur_std:.2f})")
    save_jpeg(Image.fromarray(arr.astype(np.uint8)), dest, quality=quality)


# ---------------------------------------------------------------------------
# 2. Peta normal turunan
# ---------------------------------------------------------------------------

# Benda langit yang tidak punya peta normal resmi -> diturunkan dari albedo.
# `strength` di sini sudah dikalibrasi agar relief terlihat jelas: gradien
# kecerahan sebuah foto itu kecil (sekitar 0,01–0,05 per piksel), jadi tanpa
# penguatan hasilnya nyaris rata.
DERIVED_NORMALS = [
    # (albedo, tujuan, ukuran, kekuatan relief, penghalusan)
    ("planets/mercury.jpg", "planets/mercury_normal_2k.jpg", (2048, 1024), 10.0, 0.8),
    ("planets/venus_surface.jpg", "planets/venus_normal_2k.jpg", (2048, 1024), 4.0, 2.0),
    ("planets/moon_2k.jpg", "planets/moon_normal_2k.jpg", (2048, 1024), 9.0, 0.7),
    ("moon/moon_8k.jpg", "moon/moon_normal_4k.jpg", (4096, 2048), 9.0, 1.2),
]


def make_derived_normals() -> None:
    for albedo_rel, dest_rel, size, strength, smooth in DERIVED_NORMALS:
        albedo = TEX / albedo_rel
        if not albedo.exists():
            log(f"LEWAT {albedo_rel} (tidak ada)")
            continue
        try:
            with Image.open(albedo) as im:
                im.load()
                nrm = normal_from_luma(im, strength=strength, smooth=smooth, size=size)
            save_jpeg(nrm, TEX / dest_rel, quality=94)
        except Exception as exc:  # noqa: BLE001
            log(f"GAGAL {dest_rel}: {exc}")


# ---------------------------------------------------------------------------
# 3. Tekstur noise
# ---------------------------------------------------------------------------

def make_noise() -> None:
    fbm = tileable_fbm((1024, 512), octaves=7, base=3, persistence=0.55)
    save_png(Image.fromarray((fbm * 255).astype(np.uint8)).convert("RGB"),
             TEX / "generated/noise_fbm.png")

    # Versi lebih halus & kontras rendah: khusus untuk warp pita awan gas raksasa
    # agar tidak menimbulkan bercak tajam di permukaan planet.
    warp = tileable_fbm((512, 256), octaves=5, base=2, seed=7, persistence=0.65)
    warp = 0.5 + (warp - 0.5) * 0.6
    save_png(Image.fromarray((warp * 255).astype(np.uint8)).convert("RGB"),
             TEX / "generated/noise_warp.png")


# ---------------------------------------------------------------------------
# 4. Tekstur prosedural bulan-bulan kecil
# ---------------------------------------------------------------------------
#
# Bulan-bulan besar selain Bulan Bumi tidak tersedia di sumber citra mana pun
# yang berlisensi bebas, jadi dibangkitkan di sini dengan ciri khas masing-masing
# agar tidak terlihat seperti bola abu-abu yang seragam.

# nama: (dasar RGB, kawah, skala kawah, bercak RGB, jumlah bercak, pita, garis, kabut, seed)
MOON_SPECS: dict[str, dict] = {
    "io": dict(base=(214, 190, 96), craters=80, cscale=0.45, spot=(178, 74, 36), spot_amt=0.42,
               bands=0.0, lineae=0.0, haze=0.0, seed=11),
    "europa": dict(base=(216, 208, 190), craters=35, cscale=0.32, spot=(122, 82, 58), spot_amt=0.30,
                   bands=0.0, lineae=0.9, haze=0.0, seed=22),
    "ganymede": dict(base=(152, 140, 124), craters=200, cscale=0.55, spot=(98, 90, 82), spot_amt=0.45,
                     bands=0.85, lineae=0.35, haze=0.0, seed=33),
    "callisto": dict(base=(106, 98, 90), craters=460, cscale=0.7, spot=(74, 68, 62), spot_amt=0.40,
                     bands=0.0, lineae=0.0, haze=0.0, seed=44),
    "titan": dict(base=(208, 154, 76), craters=0, cscale=0.3, spot=(174, 118, 54), spot_amt=0.32,
                  bands=0.30, lineae=0.0, haze=0.55, seed=55),
    "triton": dict(base=(214, 198, 190), craters=110, cscale=0.45, spot=(186, 168, 170), spot_amt=0.38,
                   bands=0.25, lineae=0.25, haze=0.0, seed=66),
    "phobos": dict(base=(98, 92, 86), craters=300, cscale=0.85, spot=(72, 68, 62), spot_amt=0.32,
                   bands=0.0, lineae=0.0, haze=0.0, seed=77),
    "deimos": dict(base=(120, 112, 102), craters=230, cscale=0.85, spot=(86, 80, 74), spot_amt=0.32,
                   bands=0.0, lineae=0.0, haze=0.0, seed=88),
    "enceladus": dict(base=(234, 238, 242), craters=110, cscale=0.38, spot=(188, 198, 208), spot_amt=0.24,
                      bands=0.0, lineae=0.5, haze=0.0, seed=99),
    "rhea": dict(base=(198, 194, 186), craters=420, cscale=0.7, spot=(150, 146, 140), spot_amt=0.34,
                 bands=0.0, lineae=0.25, haze=0.0, seed=101),
    "titania": dict(base=(190, 182, 174), craters=260, cscale=0.6, spot=(140, 132, 126), spot_amt=0.36,
                    bands=0.0, lineae=0.3, haze=0.0, seed=112),
    "oberon": dict(base=(176, 168, 160), craters=340, cscale=0.7, spot=(124, 116, 112), spot_amt=0.36,
                   bands=0.0, lineae=0.2, haze=0.0, seed=123),
}

MOON_SIZE = {"phobos": (512, 256), "deimos": (512, 256), "enceladus": (512, 256)}


def add_craters(img: np.ndarray, rng: np.random.Generator, count: int, scale: float,
                rim: float = 0.20, floor: float = -0.13) -> None:
    """Tambahkan kawah tumbukan: dasar gelap, tepi terang, dan serpihan ejecta."""
    h, w = img.shape[:2]
    for _ in range(count):
        r = max(2.0, float(rng.random()) ** 2.8 * scale * h * 0.10)
        cx, cy = rng.random() * w, rng.random() * h
        x0, x1 = int(max(0, cx - r * 2)), int(min(w, cx + r * 2 + 1))
        y0, y1 = int(max(0, cy - r * 2)), int(min(h, cy + r * 2 + 1))
        if x1 - x0 < 2 or y1 - y0 < 2:
            continue

        yy, xx = np.mgrid[y0:y1, x0:x1]
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
        prof = np.zeros_like(d, dtype=np.float32)

        inner = d < 0.78
        prof[inner] = floor * (1.0 - d[inner] / 0.78 * 0.45)
        band = (d >= 0.78) & (d < 1.12)
        prof[band] = rim * np.sin((d[band] - 0.78) / 0.34 * np.pi)
        outer = d >= 1.12
        prof[outer] = rim * 0.16 * np.exp(-(d[outer] - 1.12) * 3.0)
        if r > h * 0.02:  # puncak tengah pada kawah besar
            prof += 0.16 * np.exp(-((d / 0.22) ** 2))

        img[y0:y1, x0:x1] = np.clip(img[y0:y1, x0:x1] + prof[..., None], 0.0, 1.0)


def add_spots(img: np.ndarray, rng: np.random.Generator, count: int, color: tuple[int, int, int],
              amount: float) -> None:
    """Bercak warna besar (sulfur Io, terang-gelap Ganymede, dsb.)."""
    h, w = img.shape[:2]
    c = np.array(color, dtype=np.float32) / 255.0
    field = tileable_fbm((w, h), octaves=5, base=3, seed=int(rng.integers(0, 1 << 30)))
    mask = np.clip((field - 0.45) * 3.0, 0.0, 1.0)[..., None] * amount
    img[:] = np.clip(img * (1.0 - mask) + c * mask, 0.0, 1.0)


def add_bands(img: np.ndarray, rng: np.random.Generator, amount: float, freq: float = 5.0) -> None:
    """Pita terang-gelap (medan bergalur Ganymede, sabuk awan Titan)."""
    h, w = img.shape[:2]
    y = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]
    warp = tileable_fbm((w, h), octaves=4, base=2, seed=int(rng.integers(0, 1 << 30)))
    stripes = np.sin((y * freq + warp * 1.8) * np.pi * 2.0).astype(np.float32)[..., None]
    img[:] = np.clip(img + stripes * amount * 0.11, 0.0, 1.0)


def add_lineae(img: np.ndarray, rng: np.random.Generator, density: float,
               color: tuple[int, int, int] = (118, 78, 56)) -> None:
    """Garis retakan panjang (lineae Europa, tiger stripes Enceladus)."""
    h, w = img.shape[:2]
    c = np.array(color, dtype=np.float32) / 255.0
    for _ in range(int(6 + density * 24)):
        x, y = rng.random() * w, rng.random() * h
        ang = rng.random() * np.pi * 2.0
        for _step in range(int(rng.random() * w * 0.5 + w * 0.10)):
            ang += (rng.random() - 0.5) * 0.16
            x += np.cos(ang)
            y += np.sin(ang) * 0.55
            if not (0.0 <= x < w and 0.0 <= y < h):
                break
            xi, yi = int(x), int(y)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    px, py = xi + dx, yi + dy
                    if 0 <= px < w and 0 <= py < h:
                        img[py, px] = img[py, px] * 0.5 + c * 0.5


def make_moons() -> None:
    out_dir = TEX / "generated" / "moons"
    for name, spec in MOON_SPECS.items():
        w, h = MOON_SIZE.get(name, (1024, 512))
        rng = np.random.default_rng(spec["seed"])

        img = np.zeros((h, w, 3), dtype=np.float32)
        img[:] = np.array(spec["base"], dtype=np.float32) / 255.0

        add_spots(img, rng, 1, spec["spot"], spec["spot_amt"])
        if spec["bands"] > 0:
            add_bands(img, rng, spec["bands"])
        if spec["lineae"] > 0:
            add_lineae(img, rng, spec["lineae"])
        if spec["craters"] > 0:
            add_craters(img, rng, spec["craters"], spec["cscale"])
        if spec["haze"] > 0:  # atmosfer tebal -> kontras direndam
            mean = img.mean(axis=(0, 1), keepdims=True)
            img = img * (1.0 - spec["haze"] * 0.5) + mean * spec["haze"] * 0.5

        albedo = Image.fromarray((np.clip(img, 0.0, 1.0) * 255).astype(np.uint8))
        save_jpeg(albedo, out_dir / f"{name}_albedo.jpg", quality=92)

        size = (min(w, 1024), min(h, 512))
        nrm = normal_from_luma(albedo, strength=4.0 if name == "titan" else 7.0,
                              smooth=0.9, size=size)
        save_jpeg(nrm, out_dir / f"{name}_normal.jpg", quality=93)







def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep-tif", action="store_true", help="jangan hapus berkas .tif sumber")
    args = ap.parse_args()

    print("== 1. Konversi peta .tif ==")
    convert_tiffs(args.keep_tif)

    print("\n== 2. Peta normal dari albedo (Sobel) ==")
    make_derived_normals()

    print("\n== 3. Tekstur noise fbm ==")
    make_noise()

    print("\n== 4. Tekstur prosedural bulan-bulan kecil ==")
    make_moons()

    print("\nSelesai.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
