# HERMES — Tata Surya Interaktif (Three.js)

Globe Bumi interaktif yang bisa di-**zoom out** menjadi tata surya lengkap.
Mulai dari globe Bumi yang mendetail (awan, atmosfer, lampu kota, kilau
samudra), gulir perlahan untuk memperkecil Bumi sampai Matahari, delapan
planet, lima belas bulan, dan sabuk asteroid terlihat.

Semua tekstur disimpan **lokal** di folder `textures/` — situs jalan 100%
offline setelah diunduh, tanpa CDN saat dibuka.

## Menjalankan

Persyaratan: Node.js 20.19+ / 22.12+ dan peramban modern dengan WebGL2.

```bash
# 1. Pasang dependensi (sekali saja)
npm install

# 2a. Coba langsung (mode pengembangan, tanpa build)
npm run dev        # -> http://localhost:5173

# 2b. Bangun versi produksi lalu tayangkan
npm run build
npm run serve      # -> http://localhost:8080
```

Modul ES membutuhkan skema `http(s)` — berkas HTML tidak bisa dibuka lewat
`file://` karena WebGL dan modul ES akan diblokir peramban.

## Perintah

| Perintah                | Fungsi                                               |
| ----------------------- | ---------------------------------------------------- |
| `npm run dev`           | server pengembangan Vite (hot reload)                |
| `npm run build`         | bundel ke `dist/`                                    |
| `npm run serve`         | tayangkan `dist/` (atau folder proyek) secara lokal  |
| `npm test`              | uji unit matematika skala & orbit                    |
| `npm run assets:fetch`  | unduh tekstur dari Solar System Scope                |
| `npm run assets:gen`    | konversi TIFF + buat tekstur prosedural              |
| `npm run assets:verify` | pastikan semua tekstur ada & tidak rusak             |
| `npm run assets`        | ketiga langkah aset berurutan                        |
| `npm run shots`         | uji render headless (butuh Chrome, lihat di bawah)   |

## Interaksi

- **Gulir / cubit**: zoom dari permukaan planet sampai seluruh tata surya
- **Seret**: putar sudut pandang · **Klik planet**: terbang mendekat
- **Legenda bawah**: lompat ke benda langit mana pun
- Tombol `0–9`: pilih benda · `R`: kembali ke Bumi · `Spasi`: jeda waktu
- `O`: garis orbit · `L`: label · `H`: sembunyikan antarmuka

## Struktur

```
src/
├── main.js            titik masuk & loop utama
├── styles.css         seluruh gaya antarmuka
├── config/            kurva skala tampilan & preset kualitas
├── data/              fakta planet, elemen orbit JPL, teks dua bahasa
├── core/              renderer, kamera zoom berjenjang, jam simulasi,
│                      pemuat aset bertahap, pasca-proses (bloom)
├── scene/             Matahari, planet, bulan, cincin, atmosfer, sabuk,
│                      garis orbit, label, perakit tata surya
├── shaders/           pencahayaan Matahari kustom + 6 material GLSL
└── ui/                loader, legenda, panel info, pengaturan, atribusi
public/textures/       seluruh aset gambar (lokal, offline)
scripts/               unduh, generate, verifikasi, screenshot
test/                  uji unit skala & mekanika orbit
```

## Skala

Tata surya nyata tidak bisa digambar satu skala (Neptunus 4.500× jari-jari
Bumi), jadi dipakai dua kurva kompresi yang sudah dibuktikan tidak
bertumpang-tindih di `test/bodies.test.mjs`:

- ukuran: `1,35 × (R / 6371)^0,42`
- jarak:  `30 × (a_AU)^0,62`

Posisi planet tetap dihitung dari **elemen orbit Keplerian JPL** pada tanggal
simulasi, lalu radiusnya dipetakan lewat kurva di atas — jadi konfigurasinya
sesuai langit nyata, sementara jaraknya bisa dilihat sekaligus.

## Uji visual headless

`npm run shots` membangun ulang `dist/`, mengunduh Chrome headless bila perlu,
menayangkan hasil build, mengambil tangkapan di empat tingkat zoom, dan
menuntut **nol galat konsol dan nol permintaan berkas yang gagal**. Tanpa GPU,
render memakai SwiftShader (lambat; satu sesi penuh sekitar 3–4 menit).

## Atribusi aset

Lihat `CREDITS.md`. Tekstur planet oleh
[Solar System Scope](https://www.solarsystemscope.com/textures/) dengan lisensi
**CC BY 4.0** — atribusi juga tampil di sudut situs. Bulan-bulan kecil dan peta
relief turunan dibuat secara prosedural oleh `scripts/gen_textures.py`.
