# Albion Guild Balance Tracker V8.0

Balance Tracker & Transaction Log untuk Albion Online Guild.

## 📁 Struktur File

```
├── index.html       (313 baris)   HTML utama
├── style.css        (217 baris)   Semua styling (dark mode, responsive, chart)
├── app.js           (1753 baris)  Logic aplikasi
├── sw.js            (80 baris)    Service Worker (PWA offline)
├── manifest.json    (21 baris)    Konfigurasi PWA
└── icon.svg         (5 baris)     Icon aplikasi
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
| **Security** | Password (SHA-256), audit log |
| **Multi** | Tag custom, multi-currency (Silver/Gold/Fame/Other) |

## ⌨️ Keyboard Shortcuts

| Shortcut | Aksi |
|----------|------|
| `Ctrl + Enter` | Parse log |
| `Ctrl + S` | Save data |
| `Ctrl + E` | Export Excel |
| `Ctrl + F` | Focus search |
| `Esc` | Close modal |

## 🔧 Teknologi

- **Vanilla JS** — No framework, single IIFE
- **SheetJS (xlsx)** — Excel parsing (CDN)
- **IndexedDB** — Storage untuk data besar
- **Crypto API** — SHA-256 password hashing, UUID generation
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
