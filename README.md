# Albion Guild Treasury Tracker

Balance tracker and transaction log for Albion Online Guild with 2 separate modules:
- **💰 Treasury Tracker** — Manage guild finances (Silver/Gold/Fame)
- **⚡ Syphon Energy Tracker** — Track guild energy separately with isolated data

## 🚀 Quick Start

### Local Development
```bash
# Option 1: Python
python -m http.server 8000

# Option 2: Node.js
npx serve .

# Open http://localhost:8000
```

### Access
- **Treasury**: `http://localhost:8000/index.html`
- **Syphon Energy**: `http://localhost:8000/syphon.html`
- **Login Page** (optional): `http://localhost:8000/login.html`

### PWA Install
1. Open the application in HTTPS or localhost
2. Click **Install** in the browser banner
3. Use as a desktop or mobile app with offline access

## ✨ Core Features

Both trackers include:
- **Data Management**: Import/paste logs, manual entry, drag & drop, bulk delete with undo
- **Filtering & Search**: By player, reason, tag, date range, and more
- **Reports**: Daily, Weekly, and Monthly recaps with charts (bar/line)
- **Export**: Excel (.xlsx), CSV, and PDF
- **Multi-Currency**: Silver, Gold, Fame, Energy, or custom currencies
- **Storage**: IndexedDB (5000+ transactions) with JSON backup
- **Security**: Client-side SHA-256 password, audit log
- **PWA**: Offline access, installable, auto-sync
- **Dark Mode**: Full dark mode support
- **Direct Access**: Switch between Treasury and Syphon without re-login

### Syphon Energy (Additional)
- **Separate Storage**: Completely isolated from Treasury
- **Purple Theme**: Distinct visual identity
- **Player Cards**: Compact card-based dashboard with player stats
- **Per-Player Recap**: Transaction history for individual players

## � Technology Stack

- **Vanilla JavaScript** (no framework)
- **SheetJS** — Excel import/export
- **IndexedDB** — Local data storage
- **Service Worker** — Offline support & PWA
- **SHA-256** — Client-side password hashing

## 🐛 Troubleshooting

**Data not loading?** → Check browser storage hasn't been cleared, or restore from JSON backup

**Storage full?** → Export data as JSON backup, then reset. Application supports up to 5000+ transactions in IndexedDB

**Dark mode issue?** → Dark mode setting is global across both trackers

## 📝 Log Format

```
"Date" "Player" "Reason" "Amount"
"2026-04-01 05:05:40" "PlayerName" "Deposit" "1000000"
"2026-04-01 06:10:00" "PlayerName" "Withdrawal" "-500000"
```

## 🎯 Important Notes

- **Separate Data**: Treasury and Syphon Energy use completely isolated storage
- **Direct Access**: No login required when accessing via `index.html` or `syphon.html`
- **Safe Switching**: Click buttons in header to switch between trackers—login session persists
- **Independent Backup**: Export each tracker separately

---

**Developed for Albion Online Guild**