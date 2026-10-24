# Online Shop — Template Toko Online (Next.js + Midtrans)

Template toko online produk digital: katalog, checkout QRIS via
**Midtrans Snap**, produk gratis, panel admin lengkap, dan pengiriman
otomatis. Dibuat dari
[SKYGTPS](https://gtshop.skygtps.store) — toko asli yang menjalankan
kode ini.

**Demo live:** https://gtshop.skygtps.store

## Fitur

- Katalog produk dengan thumbnail, kategori, harga coret, dan stok
- Checkout QRIS via Midtrans Snap (QR tampil di modal toko sendiri,
  tanpa UI Midtrans)
- Produk gratis (harga 0) — langsung terkirim tanpa pembayaran
- Status pembayaran real-time (polling + webhook Midtrans)
- Pengiriman otomatis produk digital (pesan / file)
- Pembayaran pending: tombol mengambang "Lanjutkan Pembayaran"
- Panel admin: produk, pesanan, diskon, inventaris, pengaturan,
  branding toko, testimoni, tiket support
- Branding toko bisa diubah dari admin (nama, logo, favicon)
- Mobile: tombol beli langsung ke halaman pembayaran; desktop: modal QR

## Teknologi

- Next.js 16, React 19, Tailwind CSS 4, TypeScript
- Database file JSON lokal (tanpa database eksternal)
- Midtrans Snap API (QRIS, GoPay, dan channel lain yang diaktifkan)
- Deploy: VPS (Node.js) atau Cloudflare Pages (OpenNext)

## Persyaratan

- Node.js 20+ dan npm
- Akun Midtrans (gratis, pakai **Sandbox** dulu untuk testing)

## Quick Start

```bash
git clone https://github.com/gededevadharma/online-shop.git
cd online-shop
npm install
```

### 1. Isi konfigurasi

Edit `src/config.json`:

```json
{
  "auth": {
    "jwtSecret": "ISI-DENGAN-STRING-ACAK-PANJANG",
    "adminUsername": "admin",
    "adminPassword": "GANTI-PASSWORD-ADMIN",
    "adminEmail": "admin@tokomu.com"
  },
  "app": {
    "url": "http://localhost:3000",
    "name": "Nama Tokomu"
  },
  "midtrans": {
    "serverKey": "SB-Mid-server-XXXX",
    "clientKey": "SB-Mid-client-XXXX",
    "isProduction": false
  },
  "turnstile": {
    "siteKey": "",
    "secretKey": ""
  }
}
```

Buat `jwtSecret` dengan:

```bash
openssl rand -base64 32
```

### 2. (Opsional) Variabel environment

```bash
cp .env.example .env
```

Lalu isi `NEXT_PUBLIC_APP_URL` dengan URL tokomu (saat deploy),
dan `NEXT_PUBLIC_ENCRYPTION_KEY` dengan string acak min. 32 karakter.
Untuk development lokal, file `.env` boleh dikosongkan — aplikasi
memakai `src/config.json` dan default `http://localhost:3000`.

### 3. Jalankan

```bash
npm run dev
```

Buka http://localhost:3000.

**Login admin:** username `admin`, password `admin123`
(sesuai `src/config.json` bawaan).
**SEGERA ganti password admin dan `jwtSecret` sebelum dipakai
publik.**

### 4. Data awal

Folder `data/` sudah berisi data contoh:

| File | Isi |
|---|---|
| `products.json` | 2 produk contoh (1 berbayar, 1 gratis) |
| `users.json` | Kosong — pembeli daftar lewat halaman Register |
| `orders.json` | Kosong |
| `branding.json` | Nama toko contoh ("Online Shop") |
| `midtranssettings.json` | Key Midtrans placeholder (Sandbox, nonaktif) |
| `auditlogs.json` | Kosong |

Admin login memakai kredensial `src/config.json`, bukan `users.json`.
Jadi kamu langsung bisa login admin tanpa seeding user.

## Konfigurasi Lengkap

### `src/config.json` (sumber utama)

| Bagian | Kunci | Keterangan |
|---|---|---|
| `auth` | `jwtSecret` | Rahasia tanda tangan token login. Wajib string acak panjang. |
| `auth` | `adminUsername`, `adminPassword`, `adminEmail` | Login admin. `adminEmail` juga menentukan siapa yang dianggap admin saat login user biasa. |
| `app` | `url` | URL kanonis toko. Dipakai untuk callback Midtrans & metadata. Ganti dengan domainmu saat deploy. |
| `app` | `name` | Nama toko default. |
| `midtrans` | `serverKey`, `clientKey` | Key Midtrans. Diawali `SB-Mid-` untuk Sandbox, `Mid-` untuk Production. |
| `midtrans` | `isProduction` | `false` = Sandbox, `true` = Production. |
| `turnstile` | `siteKey`, `secretKey` | Cloudflare Turnstile (opsional, boleh kosong). |

### Variabel environment (`.env`)

| Variabel | Keterangan |
|---|---|
| `NEXT_PUBLIC_APP_URL`, `APP_URL` | URL publik toko (dipakai metadata & callback). |
| `NEXT_PUBLIC_ENCRYPTION_KEY` | Kunci enkripsi (opsional, min. 32 karakter). |
| `NEXT_PUBLIC_BRAND_LOGO_URL` | URL logo (opsional, kalah dengan pengaturan branding admin). |
| `TURNSTILE_SECRET_KEY` | Secret Turnstile (opsional). |
| `GTSHOP_DATA_DIR` | Folder data (opsional, default `./data`). |

### Pengaturan Midtrans lewat admin panel

Key Midtrans juga bisa diatur lewat **Admin > Settings > Midtrans**
(tersimpan di `data/midtranssettings.json`, mengalahkan `config.json`).
Ini cara yang disarankan di server production — supaya key asli tidak
pernah tertulis di file konfigurasi yang ikut ke git.

## Setup Midtrans (Pembayaran)

1. Daftar di https://dashboard.midtrans.com, buka
   **Settings > Access Keys**.
2. Pakai **Sandbox** dulu: salin `Server Key` (`SB-Mid-server-...`)
   dan `Client Key` (`SB-Mid-client-...`).
3. Isi key tersebut di **Admin > Settings > Midtrans** (atau
   `src/config.json`), pastikan `isProduction: false`.
4. Di dashboard Midtrans, buka **Settings > Configuration**, isi
   **Payment Notification URL** dengan:

   ```
   https://domain-tokomu.com/api/payment/callback
   ```

   Tanpa ini, pembayaran tidak terverifikasi otomatis.
5. Aktifkan channel yang kamu butuhkan (QRIS, GoPay, dll.) di
   dashboard Midtrans. Catatan: channel QRIS & GoPay di akun
   Production harus diaktivasi manual oleh Midtrans — di Sandbox
   biasanya langsung bisa dites.
6. Tes checkout dengan QRIS Sandbox sampai status pesanan berubah
   `paid` dan produk terkirim otomatis.
7. Kalau sudah yakin, ganti ke key Production (`Mid-server-...`,
   `Mid-client-...`) dan set `isProduction: true`.

## Cara Pakai

### Tambah produk (Admin > Products)

- **Nama, deskripsi, harga** — harga `0` = produk gratis (tombol
  "Ambil Gratis", langsung terkirim tanpa Midtrans).
- **Thumbnail** — simpan gambar ke `public/thumbnails/`, lalu isi
  path-nya, contoh `/thumbnails/produk-saya.png`.
- **returnType `text`** — isi `returnContent` dengan pesan yang
  dikirim ke pembeli setelah bayar (mis. license key, instruksi).
- **returnType `file`** — isi `returnContent` dengan file produk
  digital (disimpan sebagai data produk).
- **Stok** — isi angka, atau centang stok tak terbatas.
- **Aktif/nonaktif** — produk nonaktif tidak tampil di katalog.

### Kelola pesanan (Admin > Orders)

Lihat semua pesanan, status pembayaran (`pending` / `paid` /
`failed`), dan detail pembeli. Status diperbarui otomatis lewat
webhook Midtrans dan polling status.

### Branding (Admin > Settings > Branding)

Ubah nama toko, logo, dan favicon tanpa edit kode. Perubahan
tersimpan di `data/branding.json`.

### Ganti nama & domain toko

1. `src/config.json` → `app.name` dan `app.url`.
2. `NEXT_PUBLIC_APP_URL` di `.env`.
3. Branding di admin panel.
4. Rebuild & restart server.

## Struktur Proyek

```
online-shop/
  src/
    app/            ← halaman & API routes (Next.js App Router)
      admin/        ← panel admin
      api/          ← API: auth, products, orders, payment, admin
      payment/      ← halaman sukses / batal
    components/     ← komponen UI (modal QR, checkout, dll.)
    context/        ← state global (toast, branding)
    lib/            ← auth, midtrans, localdb, payment helpers
    models/         ← model data JSON
    config.json     ← konfigurasi utama (baca bagian Konfigurasi)
  public/
    thumbnails/     ← gambar produk
  data/             ← database JSON lokal (lihat Data awal)
  next.config.ts    ← konfigurasi Next.js
  wrangler.jsonc    ← konfigurasi deploy Cloudflare Pages
```

## Deploy

### Opsi A — VPS (disarankan, data JSON persisten)

```bash
npm install
npm run build
npm start
```

Server jalan di port 3000. Arahkan domain + HTTPS lewat reverse
proxy (Nginx/Caddy/Cloudflare Tunnel) ke `localhost:3000`.
Untuk jalan permanen, pakai proses manager, contoh:

```bash
npm install -g pm2
pm2 start npm --name gtshop -- start
pm2 save
```

Catatan: data toko tersimpan di file `data/*.json` — pastikan folder
ini ikut ter-backup dan tidak ikut terhapus saat redeploy.

### Opsi B — Cloudflare Pages (OpenNext)

```bash
npm run deploy
```

Memakai `@opennextjs/cloudflare` + `wrangler.jsonc` yang sudah ada
di repo. Perlu akun Cloudflare + Wrangler login dulu
(`npx wrangler login`).

### Opsi C — Vercel

Import repo ini di Vercel, deploy. Perhatian: filesystem Vercel
bersifat ephemeral — file `data/*.json` bisa kembali ke kondisi awal
saat redeploy / pindah instance. Untuk pemakaian serius di Vercel,
ganti dulu layer `src/lib/localdb.ts` dengan database eksternal.

## Keamanan (Wajib Sebelum Production)

1. Ganti `adminPassword` dan `jwtSecret` di `src/config.json`.
2. Pakai key Midtrans Production sendiri, jangan pakai key contoh.
3. Setelah mengisi key asli lewat admin panel, jangan pernah commit
   file data yang berisi key/user/pesanan asli. Hentikan pelacakan
   git untuk file-file tersebut:

   ```bash
   git update-index --skip-worktree data/midtranssettings.json data/users.json data/orders.json
   ```

4. Jangan pernah commit file `.env` berisi nilai asli.
5. Aktifkan HTTPS di domain production (Midtrans menolak callback
   ke URL non-HTTPS).

## Lisensi

MIT — bebas dipakai, diubah, dan disebarkan, dengan mencantumkan
lisensi ini. Lihat `LICENSE`.
