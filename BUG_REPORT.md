# 🐛 AlbionLog - Bug Report & UI/UX Issues

## Analysis Date: April 9, 2026
## Files Analyzed: app.js, syphon.js, index.html, syphon.html, style.css

---

## 🔴 CRITICAL BUGS (System)

### BUG-001: Translation Incomplete - Indonesian Text Remaining
**Severity:** High  
**Location:** app.js, syphon.js  
**Files:** 
- `app.js` line ~1593
- `syphon.js` multiple locations
- `app.js` line ~1791

**Issue:**
```javascript
// app.js - Line ~1593
safeSet('uploadZoneText', 'innerHTML', '📂 Klik atau drag &amp; drop file Excel / JSON di sini');

// app.js - Line ~1625
document.getElementById('uploadZoneText').innerHTML = '📂 Klik atau drag &amp; drop file Excel / JSON di sini';

// app.js - Line ~1791
document.getElementById('loadingText').textContent = text || 'Memproses...';
```

**Impact:** Users see mixed Indonesian and English text  
**Fix:** Translate to: "📂 Click or drag & drop Excel / JSON file here" and "Processing..."

---

### BUG-002: Bulk Bar Count Not Translated
**Severity:** Medium  
**Location:** app.js line ~1530  
**File:** `app.js`

**Issue:**
```javascript
document.getElementById('bulkCountBar').textContent = count + ' dipilih';
```

**Impact:** UI shows Indonesian text "dipilih" instead of "selected"  
**Fix:** Change to `count + ' selected'`

---

### BUG-003: Race Condition in saveToStorage()
**Severity:** High  
**Location:** app.js line ~310-345  
**File:** `app.js`

**Issue:**
The `savePromise` is never reset to `null` in the success path inside the setTimeout callback. If `saveToStorage()` is called while a save is pending, it returns the old promise. However, if that promise resolves/rejects, subsequent calls will create new promises but the `savePromise` variable might hold a resolved promise, causing issues.

**Impact:** Multiple rapid saves might not execute properly, potential data loss  
**Fix:**
```javascript
async function saveToStorage() {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  
  // Reset savePromise when starting fresh
  if (!savePromise) {
    savePromise = new Promise((resolve, reject) => {
      saveDebounceTimer = setTimeout(async () => {
        saveDebounceTimer = null;
        try {
          // ... save logic ...
          resolve();
        } catch (error) {
          reject(error);
        } finally {
          savePromise = null; // Always reset
        }
      }, 300);
    });
  }
  
  return savePromise;
}
```

---

### BUG-004: Memory Leak in Event Listeners
**Severity:** Medium  
**Location:** app.js line ~1700-1850  
**File:** `app.js`

**Issue:**
The `initRecapTabs()` function is called every time `refreshAll()` runs, and also every time tab 1 is switched to via `switchTab()`. This causes `renderDailyRecap()`, `renderPeriod()`, and `renderMonthly()` to be called multiple times unnecessarily.

**Impact:** Performance degradation with large datasets, unnecessary DOM manipulations  
**Fix:** Add a flag to prevent re-initialization:
```javascript
let recapInitialized = false;

function initRecapTabs() {
  if (recapInitialized) return;
  recapInitialized = true;
  // ... rest of init code
}
```

---

### BUG-005: Undo Delete Can Restore to Wrong Position
**Severity:** Medium  
**Location:** app.js line ~907-930  
**File:** `app.js`

**Issue:**
```javascript
const index = lastDeleted._originalIndex;
if (index !== undefined && index >= 0 && index <= rows.length) {
  rows.splice(index, 0, lastDeleted);
}
```

After deleting multiple items, the `_originalIndex` becomes invalid because the array has shrunk. Restoring inserts at the old index which may now be a different logical position.

**Impact:** Restored transactions appear in wrong order, confusing users  
**Fix:** Either disable undo after multiple deletes, or recalculate proper insertion position based on date sorting.

---

## 🟡 MEDIUM BUGS (UI/UX)

### BUG-006: Pagination Text Still Indonesian
**Severity:** Medium  
**Location:** app.js line ~834  
**File:** `app.js`

**Issue:**
```javascript
var html = '<span class="page-info">' + from + '-' + to + ' of ' + total + ' transactions</span>';
```

While mostly translated, this uses "of" which is correct but the format `from-to of total` is awkward. Should be `from-to of total` → `from-to out of total` or just `from-to / total`.

**Impact:** Minor UI text awkwardness  
**Fix:** Change to `' ' + from + '-' + to + ' / ' + total + ' transactions'`

---

### BUG-007: Filter Dropdown Labels Not Aligned Properly
**Severity:** Low  
**Location:** index.html, syphon.html  
**File:** HTML files

**Issue:**
The filter row has many inputs but on mobile screens, the labels "Dari:" and "Sampai:" (now "From:" and "To:") wrap awkwardly and don't align with their inputs.

**Impact:** Poor mobile UX, confusing layout  
**Fix:** Use proper grid/flexbox layout for filters on mobile, or make filter row horizontally scrollable.

---

### BUG-008: Loading Text Partially Translated
**Severity:** Low  
**Location:** app.js line ~1791  
**File:** `app.js`

**Issue:**
```javascript
function showLoading(text) {
  document.getElementById('loadingText').textContent = text || 'Memproses...';
}
```

Default fallback is still Indonesian "Memproses..."

**Impact:** Inconsistent language  
**Fix:** Change to `'Processing...'`

---

### BUG-009: No Loading State on Buttons
**Severity:** Low (UX)  
**Location:** index.html, syphon.html  
**File:** HTML + JS

**Issue:**
When user clicks "Parse & Load", "Download Excel", etc., there's no visual feedback on the button itself (only the overlay shows). User might click multiple times.

**Impact:** Double-clicks, confusion during slow operations  
**Fix:** Add disabled state + spinner to buttons during operations:
```javascript
function showLoading(text) {
  document.getElementById('loadingText').textContent = text || 'Processing...';
  document.getElementById('loadingOverlay').classList.add('visible');
  // Disable all action buttons
  document.querySelectorAll('.btn-primary, .btn-green').forEach(btn => {
    btn.disabled = true;
    btn.classList.add('loading');
  });
}
```

---

### BUG-010: Excel Export - Indonesian Locale in Numbers
**Severity:** Low  
**Location:** app.js line ~154  
**File:** `app.js`

**Issue:**
```javascript
function fmt(n){ return (n<0?'-':'') + Math.abs(Math.round(n)).toLocaleString('id-ID'); }
```

Numbers are formatted with Indonesian locale (1.000.000) which uses dots as thousand separators. For international users, this is confusing (looks like decimals).

**Impact:** Confusion for non-Indonesian users, potential misreading of amounts  
**Fix:** Use English locale or make it configurable:
```javascript
function fmt(n) { 
  return (n<0?'-':'') + Math.abs(Math.round(n)).toLocaleString('en-US'); 
}
```

---

### BUG-011: Date Format Inconsistency
**Severity:** Medium  
**Location:** Multiple locations  
**File:** app.js, syphon.js

**Issue:**
- Input uses ISO format: `2026-04-01T05:05`
- Display shows: `2026-04-01 05:05:00`
- Some comparisons use `.replace(' ', 'T')`
- Filter date inputs use `datetime-local` but comparisons strip time

**Impact:** Date filtering might miss transactions on boundary dates  
**Fix:** Standardize to one format internally, convert only for display.

---

### BUG-012: No Confirmation for "Load from Browser"
**Severity:** Low (UX)  
**Location:** app.js line ~369  
**File:** `app.js`

**Issue:**
```javascript
if (!confirm('Load data from browser? Current data will be replaced.')) return;
```

This confirmation exists, but if user accidentally clicks it and confirms, current unsaved data is lost without backup warning.

**Impact:** Accidental data loss  
**Fix:** Add check: "You have X unsaved transactions. They will be lost. Continue?"

---

## 🟢 LOW PRIORITY BUGS (Enhancement)

### BUG-013: Chart Function Still Called But Does Nothing
**Severity:** Low  
**Location:** app.js line ~1282, syphon.js line ~1388  
**File:** app.js, syphon.js

**Issue:**
```javascript
function renderChart() {
  // Chart feature has been removed in V8.1
  return;
}
```

But it's still called in `refreshAll()`:
```javascript
renderChart();  // Does nothing but wastes CPU cycle
```

**Impact:** Minor performance waste, code confusion  
**Fix:** Remove the function and its call entirely.

---

### BUG-014: Keyboard Shortcut Ctrl+S Conflicts with Browser Save
**Severity:** Low  
**Location:** app.js line ~1717  
**File:** `app.js`

**Issue:**
```javascript
if (ctrl && e.key === 's' && !isTyping) {
  e.preventDefault();
  saveToStorage()...
}
```

Browser's native Ctrl+S (Save Page As) is overridden. Some users might expect the browser behavior.

**Impact:** Unexpected browser behavior override  
**Fix:** Show a toast notification "Ctrl+S saved!" so user knows it worked, or use Alt+S instead.

---

### BUG-015: No Feedback When Select All Checkbox State is Inconsistent
**Severity:** Low  
**Location:** index.html, syphon.html  
**File:** HTML

**Issue:**
The "Select all" checkbox doesn't show indeterminate state when only some visible items are selected.

**Impact:** Confusing UX - user doesn't know if all or some are selected  
**Fix:**
```javascript
function updateSelectAllCheckbox() {
  const filtered = getFilteredRows();
  const selectedCount = filtered.filter(r => selectedIds.has(r.id)).length;
  const selectAllCb = document.getElementById('selectAllCb');
  
  if (selectedCount === 0) {
    selectAllCb.checked = false;
    selectAllCb.indeterminate = false;
  } else if (selectedCount === filtered.length) {
    selectAllCb.checked = true;
    selectAllCb.indeterminate = false;
  } else {
    selectAllCb.checked = false;
    selectAllCb.indeterminate = true;
  }
}
```

---

### BUG-016: Duplicate Detection Uses Exact Match Only
**Severity:** Low  
**Location:** app.js line ~159 (dupKey function)  
**File:** `app.js`

**Issue:**
```javascript
function dupKey(r){ return r.date + '|||' + r.player + '|||' + r.reason + '|||' + r.amount; }
```

Two transactions with same player/reason/amount but 1 second apart are not considered duplicates.

**Impact:** User might accidentally add near-duplicates  
**Fix:** Add fuzzy matching option or show warning for similar transactions.

---

### BUG-017: No Search in Player Recap (Syphon Only)
**Severity:** Low  
**Location:** syphon.html line ~226  
**File:** syphon.html

**Issue:**
The "Per Player" tab has a search input but it's not clearly labeled and might be missed.

**Impact:** Feature discoverability issue  
**Fix:** Add placeholder text "🔍 Search player name..." and make it more prominent.

---

### BUG-018: Toast Notifications Stack Instead of Queue
**Severity:** Low  
**Location:** app.js multiple locations  
**File:** `app.js`

**Issue:**
If multiple operations complete quickly, multiple toasts stack on top of each other and overlap.

**Impact:** UI clutter, unreadable messages  
**Fix:** Implement toast queue system or replace existing toast if one is already showing.

---

### BUG-019: Reset Modal Shows "0 transactions" Initially
**Severity:** Low  
**Location:** index.html line ~265  
**File:** index.html

**Issue:**
```html
<strong>Number of transactions:</strong> <span id="resetTxCount">0</span>
```

Default is 0, gets updated in `resetAll()` function, but if modal is shown before update, user sees "0".

**Impact:** Confusing if modal shows 0 when there are transactions  
**Fix:** Don't hardcode 0, use dynamic value or hide count until calculated.

---

### BUG-020: Service Worker Cleanup Only Runs Once
**Severity:** Medium  
**Location:** app.js line ~1740-1753  
**File:** `app.js`

**Issue:**
```javascript
var lastCleanup = sessionStorage.getItem('swCleanupDone');
if (hasOldSw && !lastCleanup) {
  // cleanup
  sessionStorage.setItem('swCleanupDone', '1');
  window.location.reload();
}
```

If the cleanup fails or SW re-registers with old cache, it won't cleanup again because `swCleanupDone` is set.

**Impact:** Users might get stuck with old cached content  
**Fix:** Add version check or time-based cleanup (e.g., cleanup if last cleanup > 24 hours ago).

---

## 📊 SUMMARY

| Severity | Count |
|----------|-------|
| 🔴 Critical | 5 |
| 🟡 Medium | 7 |
| 🟢 Low | 8 |
| **Total** | **20** |

---

## 🔧 FIXED BUGS (April 9, 2026)

### ✅ BUG-001: Translation Incomplete - Indonesian Text Remaining
**Status:** FIXED  
**Changes:**
- `app.js` line ~1593: `'📂 Klik atau drag &amp; drop file Excel / JSON di sini'` → `'📂 Click or drag &amp; drop Excel / JSON file here'`
- `app.js` line ~1625: Same translation fix
- `app.js` line ~1791: `'Memproses...'` → `'Processing...'`

### ✅ BUG-002: Bulk Bar Count Not Translated
**Status:** FIXED  
**Changes:**
- `app.js` line ~1530: `count + ' dipilih'` → `count + ' selected'`

### ✅ BUG-003: Race Condition in saveToStorage()
**Status:** FIXED  
**Changes:**
- Moved `savePromise = null` to `finally` block to ensure it's always reset
- Prevents promise leakage and ensures subsequent saves work correctly

### ✅ BUG-004: Memory Leak in Event Listeners
**Status:** FIXED  
**Changes:**
- Added `recapInitialized` flag to prevent redundant recap initialization
- Flag is reset in `refreshAll()` when data changes
- `initRecapTabs()` now returns early if already initialized

### ✅ BUG-005: Undo Delete Can Restore to Wrong Position
**Status:** FIXED  
**Changes:**
- Changed from using `_originalIndex` to date-based insertion
- Now finds correct insertion point by comparing dates
- Maintains chronological order after undo

### ✅ BUG-008: Loading Text Partially Translated
**Status:** FIXED  
**Changes:**
- `app.js` line ~1791: Default fallback changed from `'Memproses...'` to `'Processing...'`

### ✅ BUG-010: Excel Export - Indonesian Locale in Numbers
**Status:** FIXED  
**Changes:**
- `app.js` line ~154: `toLocaleString('id-ID')` → `toLocaleString('en-US')`
- Numbers now display as `1,000,000` instead of `1.000.000`

### ✅ BUG-013: Chart Function Still Called But Does Nothing
**Status:** FIXED  
**Changes:**
- Removed `renderChart()` function entirely
- Removed `renderChart()` call from `refreshAll()`
- Removed `window.renderChart` export
- Removed unused `shortNum()` helper function

### ✅ BUG-015: No Feedback When Select All Checkbox State is Inconsistent
**Status:** FIXED  
**Changes:**
- Added `updateSelectAllCheckbox()` function
- Implements indeterminate state when only some items are selected
- Called from `toggleSelect()`, `toggleSelectAll()`, `clearSelection()`, `confirmBulkDelete()`, and `resetAll()`

---

## 🔧 REMAINING BUGS (Not Yet Fixed)

These bugs require more extensive changes or are lower priority:

1. **BUG-006** - Pagination text format (minor UX improvement)
2. **BUG-007** - Filter dropdown mobile layout (CSS changes needed)
3. **BUG-009** - Button loading states (requires UI feedback changes)
4. **BUG-011** - Date format inconsistency (requires date handling refactor)
5. **BUG-012** - Load from browser confirmation improvement
6. **BUG-014** - Ctrl+S keyboard shortcut behavior
7. **BUG-016** - Fuzzy duplicate detection (enhancement)
8. **BUG-017** - Player search UX improvement (Syphon only)
9. **BUG-018** - Toast notification stacking
10. **BUG-019** - Reset modal transaction count display
11. **BUG-020** - Service Worker cleanup versioning

---

## ✅ POSITIVE FINDINGS

- ✅ Good use of caching (balMapCache, sortedRowsCache, statsCache)
- ✅ Proper XSS prevention with escHtml()
- ✅ Debounced save operations prevent excessive storage writes
- ✅ Audit logging for accountability
- ✅ IndexedDB fallback for large datasets
- ✅ PWA support with service worker
- ✅ Keyboard shortcuts for power users
- ✅ Bulk operations with undo capability
- ✅ Duplicate detection system

---

*End of Bug Report*
