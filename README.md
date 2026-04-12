# Albion Guild Balance Tracker V8.1 + Syphon Energy V1.1

Balance Tracker & Transaction Log untuk Albion Online Guild dengan 2 modul terpisah:
- **💰 Treasury Tracker** — Kelola keuangan guild (Silver/Gold/Fame)
- **⚡ Syphon Energy Tracker** — Kelola energi guild (khusus Syphon Energy)

**Update Terbaru:**
- ✅ Akses langsung antar halaman (tanpa login ulang)
- ✅ UI Sederhana & Compact
- ✅ Rekap Lengkap (Harian, Mingguan, Bulanan) dalam 1 tab
- ✅ Search Player untuk rekap per orang
- ✅ Compact Player Cards yang lebih aesthetic

## 📁 Struktur File

```
├── index.html       HTML utama - Treasury Tracker (V8.1)
├── syphon.html      HTML - Syphon Energy Tracker (V1.1)
├── login.html       Halaman login dengan pilihan tracker
├── style.css        CSS - Semua styling (termasuk Syphon theme)
├── app.js           Logic aplikasi Treasury (V8.1)
├── syphon.js        Logic aplikasi Syphon Energy (V1.1)
├── sw.js            Service Worker (PWA offline)
├── manifest.json    Konfigurasi PWA
├── netlify.toml     Konfigurasi deploy Netlify
├── icon.svg         Icon aplikasi
├── icon-192.png     Icon PWA 192x192
├── icon-512.png     Icon PWA 512x512
├── .gitignore       Git ignore rules
└── .nojekyll        GitHub Pages flag
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

### Login & Tracker Selection
1. Buka aplikasi → halaman login muncul
2. **Pilih tracker**: 💰 Treasury atau ⚡ Syphon Energy
3. Masukkan password (set password pertama kali)
4. Klik "Masuk" → diarahkan ke tracker yang dipilih

### PWA Install
1. Buka via **localhost** atau **HTTPS**
2. Klik **Install** di banner atas
3. Aplikasi ter-install → bisa dibuka dari desktop

### Offline Mode
1. Install app dulu
2. Matikan internet
3. Buka app → tetap berjalan (cached)

## ✨ Fitur

### 💰 Treasury Tracker (index.html)
| Kategori | Fitur |
|----------|-------|
| **Data** | Import Excel/JSON, paste log, add manual, drag & drop |
| **CRUD** | Edit, delete single, bulk delete, undo delete |
| **Filter** | Player, Reason, Tag, Currency, Date range, Search, Sort |
| **Rekap** | Mingguan & Harian, Bulanan (tgl 1), Grafik (Bar/Line) |
| **Export** | Excel (.xlsx), CSV, PDF (print) |
| **Storage** | IndexedDB (5000+ tx), localStorage fallback, JSON backup |
| **Currency** | Silver, Gold, Fame, Other (multi-currency) |
| **Theme** | Blue (#1e40af) default, dark mode support |
| **Access** | **Direct link** dari Syphon Energy (tanpa login) |

### ⚡ Syphon Energy Tracker (syphon.html) - UPDATED!
| Kategori | Fitur |
|----------|-------|
| **Data** | Import Excel/JSON, paste log, add manual, drag & drop |
| **CRUD** | Edit, delete single, bulk delete, undo delete |
| **Filter** | Player, Reason, Tag, Currency, Date range, Search, Sort |
| **Rekap** | **LENGKAP** (Harian + Mingguan + Bulanan dalam 1 tab) |
| **Player** | **Compact Cards** dengan **Search** & detail modal |
| **Export** | Excel (.xlsx), CSV, PDF (print) |
| **Storage** | IndexedDB (5000+ tx), localStorage fallback, JSON backup |
| **Currency** | **Energy** (default), Silver, Gold, Fame, Other |
| **Theme** | **Purple (#7c3aed)** energy theme, dark mode support |
| **Isolation** | **Storage terpisah** dari Treasury (data tidak tercampur) |
| **UI Unik** | **Compact Player Cards** yang lebih kecil & aesthetic |
| **Access** | **Direct link** dari Treasury (tanpa login) |

### Shared Features (Kedua Tracker)
| Kategori | Fitur |
|----------|-------|
| **PWA** | Offline access, installable, auto-update |
| **UX** | Dark mode, pagination, keyboard shortcuts, toast notification |
| **Security** | Password (client-side SHA-256), audit log |
| **Multi** | Tag custom, multi-currency support |
| **Charts** | Bar chart, Line chart, Bar+Line combo |
| **Period** | Weekly recap, Monthly recap (from 1st) |

## 🎨 Syphon Energy Theme

Syphon Energy Tracker menggunakan tema **purple/violet** yang berbeda dari Treasury:

**Light Mode:**
- Background: Gradient `#f5f3ff → #ede9fe` (light purple)
- Primary: `#7c3aed` (violet)
- Positive: `#059669` (green)
- Upload zone: Purple border & hover effects

**Dark Mode:**
- Background: Gradient `#1e1b4b → #2e1065` (dark purple)
- Primary: `#6d28d9` (deep violet)
- Cards: `#1e1b4b` with purple borders
- Positive: `#10b981` (emerald)

## 🔐 Storage Isolation

Kedua tracker menggunakan storage yang **sepenuhnya terpisah**:

| Aspect | Treasury | Syphon Energy |
|--------|----------|---------------|
| **Storage Key** | `albionGuildTreasuryV80` | `syphonGuildEnergyV10` |
| **IndexedDB** | `albionTreasuryDB` | `albionSyphonEnergyDB` |
| **Session Key** | `albionLoggedIn` (shared) | `albionLoggedIn` (shared) |
| **Audit Log** | `albionAuditLog` | `syphonAuditLog` |
| **Backup File** | `guild_treasury_backup_*.json` | `syphon_energy_backup_*.json` |
| **Export File** | `guild_treasury_*.xlsx` | `syphon_energy_*.xlsx` |
| **Display Locale** | `en-US` | `en-US` |

**Keuntungan:**
- Data tidak tercampur antara Treasury dan Energy
- Masing-masing bisa di-reset tanpa mempengaruhi yang lain
- Backup/restore terpisah
- Security: breach di satu tracker tidak expose tracker lain

## ⌨️ Keyboard Shortcuts

| Shortcut | Aksi |
|----------|------|
| `Ctrl + Enter` | Parse log |
| `Ctrl + S` | Save data |
| `Ctrl + E` | Export Excel |
| `Ctrl + F` | Focus search |
| `Esc` | Close modal |

> **Catatan:** Shortcut tidak akan trigger saat Anda sedang mengetik di input field.

## 🔧 Teknologi

- **Vanilla JS** — No framework, single IIFE per tracker
- **SheetJS (xlsx)** — Excel parsing (CDN)
- **IndexedDB** — Storage untuk data besar (5000+ transactions)
- **Crypto API** — SHA-256 password hashing (client-side only)
- **Service Worker** — Offline caching & PWA
- **CSS3** — Custom properties, gradients, responsive design

## 📊 Format Log

```
"Date" "Player" "Reason" "Amount"
"2026-04-01 05:05:40" "M0W" "Withdrawal" "-1000000"
"2026-04-01 06:10:00" "Kira" "Deposit" "500000"
```

**Syphon Energy** default currency: `Energy` (bisa diganti ke Silver/Gold/Fame/Other)

## 🆕 Syphon Energy - Fitur Khusus

### 1. Energy-Focused Currency
- Default: **Energy** (bukan Silver)
- Cocok untuk tracking syphon energy guild
- Tetap support multi-currency jika diperlukan

### 2. Purple Energy Theme
- Visual berbeda dari Treasury
- Mudah dibedakan saat switch antar tracker
- Professional purple gradient design

### 3. Independent Data Management
- Storage 100% terpisah
- Backup/restore terpisah
- Reset tidak mempengaruhi Treasury
- Audit log terpisah

### 4. 👥 REKAP PER PLAYER (UNIK!)
Fitur eksklusif yang tidak ada di Treasury Tracker:

#### **Player Cards Dashboard**
- Tampilan modern dengan card-based layout
- Setiap player punya avatar dengan inisial nama
- Ranking otomatis berdasarkan sort order
- Statistik lengkap per player:
  - ✅ Total Deposit (hijau)
  - ✅ Total Withdrawal (merah)  
  - ✅ Net Amount (hijau/merah)
  - ✅ Jumlah Transaksi
  - ✅ Tanggal transaksi pertama & terakhir

#### **Filter & Sort Player**
- **Filter by Player**: Tampilkan player tertentu saja
- **Sort by**:
  - Net Amount (default)
  - Total Deposit
  - Total Withdrawal
  - Jumlah Transaksi
  - Nama Player
- **Order**: Ascending atau Descending

#### **Player Detail Modal**
Klik player card untuk melihat:
- Header dengan avatar besar & nama player
- 4 statistik utama dalam grid
- **Tabel riwayat transaksi lengkap**:
  - Semua transaksi player tersebut
  - Diurutkan dari yang terbaru
  - Kolom: #, Date, Reason, Tag, Currency, Amount
  - Amount diwarnai hijau (positif) atau merah (negatif)

#### **Cara Menggunakan Rekap Per Player**
```
1. Login ke Syphon Energy Tracker
2. Klik tab "👥 Rekap Per Player"
3. Lihat semua player cards
4. Gunakan filter untuk pilih player tertentu
5. Gunakan sort untuk ranking (Net/Deposit/Withdrawal/dll)
6. Klik player card untuk lihat detail transaksi
7. Tekan ESC atau klik X untuk tutup modal
```

### 5. Same Powerful Features
Semua fitur Treasury ada di Syphon Energy:
- ✅ Full CRUD operations
- ✅ Advanced filtering & search
- ✅ Weekly/Monthly recap
- ✅ **Player statistics & ranking system**
- ✅ Bar/Line charts
- ✅ Excel/CSV/PDF export
- ✅ Bulk delete with undo
- ✅ Duplicate detection & merge
- ✅ Dark mode
- ✅ PWA support
- ✅ Keyboard shortcuts

## 📝 Changelog

| Versi | Tanggal | Perubahan |
|-------|---------|-----------|
| V8.1 | Apr 2026 | **TREASURY UPDATE** - Direct link ke Syphon, hapus login requirement, UI simpler |
| V1.1 | Apr 2026 | **SYPHON ENERGY UPDATE** - Hapus grafik, gabung recap (Harian/Mingguan/Bulanan), compact player cards, search player, direct link dari Treasury |
| V8.0 | Apr 2026 | Modularisasi, grafik, PDF export, tag, multi-currency, audit log, PWA, SHA-256 password, merge duplikat, add manual |
| V1.0 | Apr 2026 | **SYPHON ENERGY** - Tracker energi terpisah dengan storage isolated, purple theme, default Energy currency |

## 🎯 Cara Mengakses

### **Opsi 1: Direct Access (Recommended)**
```
# Akses langsung Treasury:
http://localhost:8000/index.html

# Akses langsung Syphon Energy:
http://localhost:8000/syphon.html

# Switch antar halaman:
- Klik "⚡ Syphon" di Treasury page
- Klik "💰 Treasury" di Syphon page
```

### **Opsi 2: Via Login Page**
```
# Login page (opsional, untuk security):
http://localhost:8000/login.html

1. Set password (pertama kali)
2. Pilih tracker: Treasury atau Syphon
3. Login
4. Akan diarahkan ke tracker yang dipilih
```

### **Switching Antar Tracker**
```
Dari Treasury:
  → Klik tombol "⚡ Syphon" di header
  → Langsung pindah ke Syphon Energy

Dari Syphon Energy:
  → Klik tombol "💰 Treasury" di header
  → Langsung pindah ke Treasury

Tidak perlu login ulang!
```

## 🎯 Cara Menggunakan Syphon Energy

### 1. Login & Pilih Syphon Energy
```
1. Buka aplikasi
2. Klik tombol "⚡ Syphon Energy"
3. Login dengan password
4. Halaman Syphon Energy terbuka
```

### 2. Set Initial Balance
```
1. Masukkan saldo awal energi di field "Initial Balance"
2. Atau import dari file Excel/JSON backup
```

### 3. Input Data Energi
**Cara 1 - Paste Log:**
```
"2026-04-09 10:00:00" "Player1" "Syphon Deposit" "500000"
"2026-04-09 11:30:00" "Player2" "Energy Withdrawal" "-200000"
```

**Cara 2 - Manual Add:**
```
1. Klik "➕ Tambah Manual"
2. Isi form (Date, Player, Reason, Amount)
3. Pilih Currency (default: Energy)
4. Klik "💾 Simpan"
```

**Cara 3 - Import:**
```
1. Drag & drop file Excel/JSON
2. Atau klik "📂 Load from Browser"
```

### 4. Export & Backup
```
1. Klik "⬇ Download Excel" untuk export .xlsx
2. Klik "📄 Export CSV" untuk export .csv
3. Klik "📋 Export PDF" untuk print report
4. Klik "💾 Save JSON Backup" untuk backup
```

### 5. Switch Treasury ↔ Syphon
```
Dari Treasury:
  → Klik tombol "⚡ Syphon" di header
  → Langsung pindah ke Syphon Energy (tanpa login ulang!)

Dari Syphon Energy:
  → Klik tombol "💰 Treasury" di header
  → Langsung pindah ke Treasury (tanpa login ulang!)

Session bersifat global — login sekali, akses kedua tracker.
```

## ⚠️ Penting!

1. **Data Terpisah**: Treasury dan Syphon Energy TIDAK berbagi data
2. **Backup Terpisah**: Backup masing-masing tracker secara independen
3. **Reset Aman**: Reset Syphon tidak menghapus data Treasury (dan sebaliknya)
4. **Direct Access**: Bisa akses langsung tanpa login (via index.html atau syphon.html)
5. **Switching Mudah**: Klik tombol di header untuk pindah antar tracker
6. **Rekap Per Player**: Fitur eksklusif hanya ada di Syphon Energy!
7. **UI Berbeda**: Syphon Energy punya UI cards yang unik, berbeda dari Treasury
8. **Compact Design**: Player cards lebih kecil & aesthetic di V1.1

## 🐛 Troubleshooting

### Data tidak muncul setelah login?
- Pastikan pilih tracker yang benar di login page
- Cek "Load from Browser" jika data tidak auto-load

### Wrong tracker redirect?
- Logout dulu
- Pilih tracker yang diinginkan di login page
- Login kembali

### Storage penuh?
- Aplikasi otomatis gunakan IndexedDB untuk 5000+ transaksi
- Jika masih error, export JSON backup lalu reset

### Dark mode tidak konsisten?
- Dark mode setting global (berlaku untuk kedua tracker)
- Toggle di salah satu tracker, otomatis update tracker lain

## 📞 Support

Untuk pertanyaan atau bug report, buat issue di repository.

---

**Developed with ❤️ for Albion Online Guild**

*Last updated: April 2026*
