# Albion Guild Balance Tracker V8.0

Balance Tracker & Transaction Log untuk Albion Online Guild.

## 📁 Struktur File

```
├── index.html       (~518 baris)  HTML utama
├── login.html       (~159 baris)  Halaman login
├── style.css        (~282 baris)  Semua styling (dark mode, responsive, chart, a11y)
├── app.js           (~3090 baris) Logic aplikasi
├── sw.js            (~100 baris)  Service Worker (PWA offline)
├── manifest.json    (~33 baris)   Konfigurasi PWA
├── netlify.toml     (~35 baris)   Konfigurasi deploy Netlify
├── icon.svg         (5 baris)     Icon aplikasi
├── icon-192.png                     Icon PWA 192x192
├── icon-512.png                     Icon PWA 512x512
├── .gitignore                       Git ignore rules
└── .nojekyll                        GitHub Pages flag
```

## 🚀 Quick Start

### Local Development
```bash
# Python
python -m http.server 8000

# Node.js
npx serve .

# Buka http://localhost:8000
```

### PWA Install
1. Buka via **localhost** atau **HTTPS**
2. Klik **Install** di banner atas
3. Aplikasi ter-install → bisa dibuka dari desktop

### Offline Mode
1. Install app dulu
2. Matikan internet
3. Buka app → tetap berjalan (cached)

## ✨ Fitur

| Kategori | Fitur |
|----------|-------|
| **Data** | Import Excel/JSON, paste log, add manual, drag & drop |
| **CRUD** | Edit, delete single, bulk delete, undo delete |
| **Filter** | Player, Reason, Tag, Currency, Date range, Search, Sort |
| **Rekap** | Mingguan & Harian, Bulanan (tgl 1), Grafik (Bar/Line) |
| **Export** | Excel (.xlsx), CSV, PDF (print) |
| **Storage** | IndexedDB (5000+ tx), localStorage fallback, JSON backup |
| **PWA** | Offline access, installable, auto-update |
| **UX** | Dark mode, pagination, keyboard shortcuts, toast notification |
| **Security** | Password (client-side SHA-256, untuk proteksi dasar), audit log |
| **Multi** | Tag custom, multi-currency (Silver/Gold/Fame/Other) |

## ⌨️ Keyboard Shortcuts

| Shortcut | Aksi |
|----------|------|
| `Ctrl + Enter` | Parse log |
| `Ctrl + S` | Save data *(mungkin diintersep browser untuk "Save Page As")* |
| `Ctrl + E` | Export Excel |
| `Ctrl + F` | Focus search |
| `Esc` | Close modal |

> **Catatan:** Shortcut tidak akan trigger saat Anda sedang mengetik di input field.

## 🔧 Teknologi

- **Vanilla JS** — No framework, single IIFE
- **SheetJS (xlsx)** — Excel parsing (CDN) — *TODO: tambahkan SRI hash integrity*
- **IndexedDB** — Storage untuk data besar
- **Crypto API** — SHA-256 password hashing (client-side only, bukan pengganti server auth)
- **Service Worker** — Offline caching & PWA

## 📊 Format Log

```
"Date" "Player" "Reason" "Amount"
"2026-04-01 05:05:40" "M0W" "Withdrawal" "-1000000"
"2026-04-01 06:10:00" "Kira" "Deposit" "500000"
```

## 📝 Changelog

| Versi | Perubahan |
|-------|-----------|
| V8.0 | Modularisasi, grafik, PDF export, tag, multi-currency, audit log, PWA, SHA-256 password, merge duplikat, add manual |
