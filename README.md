# Albion Guild Balance Tracker V8.1 + Syphon Energy V1.1

Balance Tracker & Transaction Log for Albion Online Guild with 2 separate modules:
- **💰 Treasury Tracker** — Manage guild finances (Silver/Gold/Fame)
- **⚡ Syphon Energy Tracker** — Manage guild energy (specific to Syphon Energy)

**Latest Updates:**
- ✅ Direct access between pages (without re-login)
- ✅ Simple & Compact UI
- ✅ Complete Recap (Daily, Weekly, Monthly) in one tab
- ✅ Search Player for individual recaps
- ✅ Compact Player Cards with improved aesthetics

## 📁 File Structure

```
├── index.html       Main HTML - Treasury Tracker (V8.1)
├── syphon.html      HTML - Syphon Energy Tracker (V1.1)
├── login.html       Login page with tracker selection
├── style.css        CSS - All styling (including Syphon theme)
├── app.js           Logic for Treasury (V8.1)
├── syphon.js        Logic for Syphon Energy (V1.1)
├── sw.js            Service Worker (PWA offline)
├── manifest.json    PWA configuration
├── netlify.toml     Netlify deployment configuration
├── icon.svg         Application icon
├── icon-192.png     PWA icon (192x192)
├── icon-512.png     PWA icon (512x512)
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

# Open http://localhost:8000
```

### Login & Tracker Selection
1. Open the application → login page appears
2. **Select tracker**: 💰 Treasury or ⚡ Syphon Energy
3. Enter password (set password the first time)
4. Click "Login" → redirected to the selected tracker

### PWA Install
1. Open via **localhost** or **HTTPS**
2. Click **Install** in the top banner
3. Application is installed → can be opened from the desktop

### Offline Mode
1. Install the app first
2. Turn off internet
3. Open the app → still runs (cached)

## ✨ Features

### 💰 Treasury Tracker (index.html)
| Category | Feature |
|----------|-------|
| **Data** | Import Excel/JSON, paste log, add manual, drag & drop |
| **CRUD** | Edit, delete single, bulk delete, undo delete |
| **Filter** | Player, Reason, Tag, Currency, Date range, Search, Sort |
| **Recap** | Weekly & Daily, Monthly (1st day), Graphs (Bar/Line) |
| **Export** | Excel (.xlsx), CSV, PDF (print) |
| **Storage** | IndexedDB (5000+ tx), localStorage fallback, JSON backup |
| **Currency** | Silver, Gold, Fame, Other (multi-currency) |
| **Theme** | Blue (#1e40af) default, dark mode support |
| **Access** | **Direct link** from Syphon Energy (without login) |

### ⚡ Syphon Energy Tracker (syphon.html) - UPDATED!
| Category | Feature |
|----------|-------|
| **Data** | Import Excel/JSON, paste log, add manual, drag & drop |
| **CRUD** | Edit, delete single, bulk delete, undo delete |
| **Filter** | Player, Reason, Tag, Currency, Date range, Search, Sort |
| **Recap** | **Complete** (Daily + Weekly + Monthly in one tab) |
| **Player** | **Compact Cards** with **Search** & detail modal |
| **Export** | Excel (.xlsx), CSV, PDF (print) |
| **Storage** | IndexedDB (5000+ tx), localStorage fallback, JSON backup |
| **Currency** | **Energy** (default), Silver, Gold, Fame, Other |
| **Theme** | **Purple (#7c3aed)** energy theme, dark mode support |
| **Isolation** | **Separate storage** from Treasury (data not mixed) |
| **Unique UI** | **Compact Player Cards** that are smaller & aesthetic |
| **Access** | **Direct link** from Treasury (without login) |

### Shared Features (Both Trackers)
| Category | Feature |
|----------|-------|
| **PWA** | Offline access, installable, auto-update |
| **UX** | Dark mode, pagination, keyboard shortcuts, toast notification |
| **Security** | Password (client-side SHA-256), audit log |
| **Multi** | Custom tags, multi-currency support |
| **Charts** | Bar chart, Line chart, Bar+Line combo |
| **Period** | Weekly recap, Monthly recap (from 1st) |

## 🎨 Syphon Energy Theme

Syphon Energy Tracker uses a **purple/violet** theme that differs from Treasury:

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

Both trackers use **completely separate** storage:

| Aspect | Treasury | Syphon Energy |
|--------|----------|---------------|
| **Storage Key** | `albionGuildTreasuryV80` | `syphonGuildEnergyV10` |
| **IndexedDB** | `albionTreasuryDB` | `albionSyphonEnergyDB` |
| **Session Key** | `albionLoggedIn` (shared) | `albionLoggedIn` (shared) |
| **Audit Log** | `albionAuditLog` | `syphonAuditLog` |
| **Backup File** | `guild_treasury_backup_*.json` | `syphon_energy_backup_*.json` |
| **Export File** | `guild_treasury_*.xlsx` | `syphon_energy_*.xlsx` |
| **Display Locale** | `en-US` | `en-US` |

**Benefits:**
- Data is not mixed between Treasury and Energy
- Each can be reset without affecting the other
- Separate backup/restore
- Security: breach in one tracker does not expose the other

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Enter` | Parse log |
| `Ctrl + S` | Save data |
| `Ctrl + E` | Export Excel |
| `Ctrl + F` | Focus search |
| `Esc` | Close modal |

> **Note:** Shortcuts will not trigger while you are typing in an input field.

## 🔧 Technology

- **Vanilla JS** — No framework, single IIFE per tracker
- **SheetJS (xlsx)** — Excel parsing (CDN)
- **IndexedDB** — Storage for large data (5000+ transactions)
- **Crypto API** — SHA-256 password hashing (client-side only)
- **Service Worker** — Offline caching & PWA
- **CSS3** — Custom properties, gradients, responsive design

## 📊 Log Format

```
"Date" "Player" "Reason" "Amount"
"2026-04-01 05:05:40" "M0W" "Withdrawal" "-1000000"
"2026-04-01 06:10:00" "Kira" "Deposit" "500000"
```

**Syphon Energy** default currency: `Energy` (can be changed to Silver/Gold/Fame/Other)

## 🆕 Syphon Energy - Special Features

### 1. Energy-Focused Currency
- Default: **Energy** (not Silver)
- Suitable for tracking guild syphon energy
- Still supports multi-currency if needed

### 2. Purple Energy Theme
- Visually different from Treasury
- Easy to distinguish when switching between trackers
- Professional purple gradient design

### 3. Independent Data Management
- 100% separate storage
- Separate backup/restore
- Reset does not affect Treasury
- Separate audit log

### 4. 👥 PER PLAYER RECAP (UNIQUE!)
Exclusive feature not available in Treasury Tracker:

#### **Player Cards Dashboard**
- Modern display with card-based layout
- Each player has an avatar with name initials
- Automatic ranking based on sort order
- Complete statistics per player:
  - ✅ Total Deposit (green)
  - ✅ Total Withdrawal (red)
  - ✅ Net Amount (green/red)
  - ✅ Number of Transactions
  - ✅ First & last transaction dates

#### **Filter & Sort Players**
- **Filter by Player**: Display specific players only
- **Sort by**:
  - Net Amount (default)
  - Total Deposit
  - Total Withdrawal
  - Number of Transactions
  - Player Name
- **Order**: Ascending or Descending

#### **Player Detail Modal**
Click a player card to view:
- Header with large avatar & player name
- 4 main statistics in a grid
- **Complete transaction history table**:
  - All transactions for that player
  - Sorted from most recent
  - Columns: #, Date, Reason, Tag, Currency, Amount
  - Amount colored green (positive) or red (negative)

#### **How to Use Per Player Recap**
```
1. Log in to Syphon Energy Tracker
2. Click tab "👥 Rekap Per Player" (Per Player Recap)
3. View all player cards
4. Use filter to select specific players
5. Use sort for ranking (Net/Deposit/Withdrawal/etc.)
6. Click player card to view transaction details
7. Press ESC or click X to close modal
```

### 5. Same Powerful Features
All Treasury features are available in Syphon Energy:
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

| Version | Date | Changes |
|---------|------|---------|
| V8.1 | Apr 2026 | **TREASURY UPDATE** - Direct link to Syphon, removed login requirement, simpler UI |
| V1.1 | Apr 2026 | **SYPHON ENERGY UPDATE** - Removed charts, merged recap (Daily/Weekly/Monthly), compact player cards, search player, direct link from Treasury |
| V8.0 | Apr 2026 | Modularization, charts, PDF export, tags, multi-currency, audit log, PWA, SHA-256 password, merge duplicates, manual add |
| V1.0 | Apr 2026 | **SYPHON ENERGY** - Separate energy tracker with isolated storage, purple theme, default Energy currency |

## 🎯 How to Access

### **Option 1: Direct Access (Recommended)**
```
# Direct access to Treasury:
http://localhost:8000/index.html

# Direct access to Syphon Energy:
http://localhost:8000/syphon.html

# Switch between pages:
- Click "⚡ Syphon" on Treasury page
- Click "💰 Treasury" on Syphon page
```

### **Option 2: Via Login Page**
```
# Login page (optional, for security):
http://localhost:8000/login.html

1. Set password (first time)
2. Select tracker: Treasury or Syphon
3. Login
4. Will be redirected to the selected tracker
```

### **Switching Between Trackers**
```
From Treasury:
  → Click "⚡ Syphon" button in header
  → Directly switch to Syphon Energy

From Syphon Energy:
  → Click "💰 Treasury" button in header
  → Directly switch to Treasury

No need to login again!
```

## 🎯 How to Use Syphon Energy

### 1. Login & Select Syphon Energy
```
1. Open the application
2. Click "⚡ Syphon Energy" button
3. Login with password
4. Syphon Energy page opens
```

### 2. Set Initial Balance
```
1. Enter initial energy balance in "Initial Balance" field
2. Or import from Excel/JSON backup file
```

### 3. Input Energy Data
**Method 1 - Paste Log:**
```
"2026-04-09 10:00:00" "Player1" "Syphon Deposit" "500000"
"2026-04-09 11:30:00" "Player2" "Energy Withdrawal" "-200000"
```

**Method 2 - Manual Add:**
```
1. Click "➕ Add Manual"
2. Fill form (Date, Player, Reason, Amount)
3. Select Currency (default: Energy)
4. Click "💾 Save"
```

**Method 3 - Import:**
```
1. Drag & drop Excel/JSON file
2. Or click "📂 Load from Browser"
```

### 4. Export & Backup
```
1. Click "⬇ Download Excel" to export .xlsx
2. Click "📄 Export CSV" to export .csv
3. Click "📋 Export PDF" to print report
4. Click "💾 Save JSON Backup" to backup
```

### 5. Switch Treasury ↔ Syphon
```
From Treasury:
  → Click "⚡ Syphon" button in header
  → Directly switch to Syphon Energy (no re-login needed!)

From Syphon Energy:
  → Click "💰 Treasury" button in header
  → Directly switch to Treasury (no re-login needed!)

Session is global — login once, access both trackers.
```

## ⚠️ Important!

1. **Separate Data**: Treasury and Syphon Energy do NOT share data
2. **Separate Backup**: Backup each tracker independently
3. **Safe Reset**: Reset Syphon does not delete Treasury data (and vice versa)
4. **Direct Access**: Can access directly without login (via index.html or syphon.html)
5. **Easy Switching**: Click button in header to switch between trackers
6. **Per Player Recap**: Exclusive feature only available in Syphon Energy!
7. **Different UI**: Syphon Energy has unique card UI, different from Treasury
8. **Compact Design**: Player cards are smaller & aesthetic in V1.1

## 🐛 Troubleshooting

### Data not appearing after login?
- Make sure you selected the correct tracker on the login page
- Check "Load from Browser" if data doesn't auto-load

### Wrong tracker redirect?
- Logout first
- Select desired tracker on login page
- Login again

### Storage full?
- Application automatically uses IndexedDB for 5000+ transactions
- If still getting errors, export JSON backup then reset

### Dark mode inconsistent?
- Dark mode setting is global (applies to both trackers)
- Toggle on one tracker, automatically updates the other tracker

## 📞 Support

For questions or bug reports, create an issue in the repository.

---

**Developed with ❤️ for Albion Online Guild**

*Last updated: April 2026*