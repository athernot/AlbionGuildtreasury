(function() {
  'use strict';

  // ==================== V8.0 GLOBAL VARIABLES ====================
  /** @type {Array<{date:string,player:string,reason:string,amount:number,id:string}>} */
  let rows = [];
  /** @type {object|null} */
  let lastDeleted = null;
  let lastBulkDeleted = null;
  /** @type {number|null} */
  let undoTimeout = null;
  /** @type {object|null} */
  let balMapCache = null;
  let balMapCacheVersion = 0;
  const APP_VERSION = 'V8.0';
  const STORAGE_KEY = 'albionGuildTreasuryV80';
  /** @type {{col:number,dir:'asc'|'desc'}} */
  let currentSort = { col: 1, dir: 'desc' };
  /** @type {string|null} */
  let editingId = null;
  /** @type {number|null} */
  let lastSavedTime = null;
  let useIndexedDB = false;
  const DB_NAME = 'albionTreasuryDB';
  const DB_VERSION = 1;
  /** @type {IDBDatabase|null} */
  let db = null;
  /** @type {number|null} */
  let saveDebounceTimer = null;
  /** @type {Set<string>} */
  let selectedIds = new Set();
  let currentPage = 1;
  let rowsPerPage = 50;
  let existingKeysCache = new Set();
  let dirtyIds = { added: new Set(), deleted: new Set() };
  let lastDuplicates = [];
  let auditLog = [];
  let sortedRowsCache = null;
  let statsCache = null;
  let filterCache = { players: null, reasons: null, tags: null, currencies: null, version: -1 };

  function logAudit(action, details) {
  auditLog.push({ timestamp: new Date().toISOString(), action: action, details: details });
  if (auditLog.length > 500) auditLog = auditLog.slice(-500);
  try { localStorage.setItem('albionAuditLog', JSON.stringify(auditLog)); } catch(e) {
    console.warn('⚠️ Audit log gagal disimpan ke localStorage:', e);
    // Silently drop oldest entries to stay within limits
    if (auditLog.length > 100) auditLog = auditLog.slice(-100);
  }
}

  // ==================== INDEXEDDB ====================
  /**
   * Initialize IndexedDB database with transactions and settings stores
   * @returns {Promise<void>}
   */
  async function initDB() {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = e => {
        const dbInstance = e.target.result;
        if (!dbInstance.objectStoreNames.contains('transactions')) dbInstance.createObjectStore('transactions', { keyPath: 'id' });
        if (!dbInstance.objectStoreNames.contains('settings')) dbInstance.createObjectStore('settings');
      };
      request.onsuccess = e => { db = e.target.result; resolve(); };
      request.onerror = e => {
        console.warn('IndexedDB tidak tersedia:', e.target.error);
        useIndexedDB = false;
        resolve();
      };
    } catch (err) {
      console.warn('IndexedDB init error:', err);
      useIndexedDB = false;
      resolve();
    }
  });
}

  /**
   * Save current rows and config to IndexedDB
   * @throws {Error} On quota exceeded or permission denied
   * @returns {Promise<void>}
   */
   async function saveToIndexedDB() {
  if (!db) return;
  try {
    const tx = db.transaction(['transactions','settings'], 'readwrite');
    const store = tx.objectStore('transactions');
    var currentIds = new Set(rows.map(function(r) { return r.id; }));
    dirtyIds.added.forEach(function(id) {
      var r = rows.find(function(row) { return row.id === id; });
      if (r) store.put(r);
    });
    dirtyIds.deleted.forEach(function(id) {
      if (!currentIds.has(id)) store.delete(id);
    });
    tx.objectStore('settings').put({initBal: parseFloat(document.getElementById('initBal').value)||0}, 'config');
    dirtyIds.added.clear();
    dirtyIds.deleted.clear();
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    if (err.name === 'QuotaExceededError') {
      alert('⚠️ Penyimpanan browser penuh! Data tidak bisa disimpan ke IndexedDB. Export JSON backup sekarang.');
      useIndexedDB = false;
      saveToStorage();
    } else if (err.name === 'NotAllowedError') {
      alert('⚠️ Akses ke IndexedDB ditolak. Cek izin browser.');
      useIndexedDB = false;
    } else {
      console.error('IndexedDB save error:', err);
    }
    throw err;
  }
}

 async function loadFromIndexedDB() {
  if (!db) return false;
  try {
    const tx = db.transaction(['transactions','settings']);
    const rowsReq = tx.objectStore('transactions').getAll();
    const configReq = tx.objectStore('settings').get('config');
    const [loadedRows, config] = await new Promise((resolve, reject) => {
      rowsReq.onsuccess = () => resolve([rowsReq.result, configReq.result]);
      rowsReq.onerror = () => reject(rowsReq.error);
    });
    if (loadedRows && loadedRows.length) {
      rows = loadedRows.map(function(r) {
        if (!r.playerLc) r.playerLc = (r.player || '').toLowerCase();
        if (!r.reasonLc) r.reasonLc = (r.reason || '').toLowerCase();
        return r;
      });
      balMapCache = null;
      sortedRowsCache = null;
      statsCache = null;
      document.getElementById('initBal').value = config ? config.initBal : 0;
      return true;
    }
  } catch (err) {
    console.error('IndexedDB load error:', err);
    useIndexedDB = false;
  }
  return false;
}

  // ==================== UTILITIES ====================
  /**
   * Format number as Indonesian locale string (e.g. 1.000.000)
   * @param {number} n
   * @returns {string}
   */
  function fmt(n){ return (n<0?'-':'') + Math.abs(Math.round(n)).toLocaleString('id-ID'); }

  /**
   * Generate a unique key for a transaction row (used for running balance map)
   * Includes the row id to prevent collision on identical transactions
   * @param {object} r
   * @returns {string}
   */
  function rowKey(r){ return r.id + '|||' + r.date + '|||' + r.player + '|||' + r.reason + '|||' + r.amount; }

  /**
   * Escape HTML special characters to prevent XSS
   * @param {string} str
   * @returns {string}
   */
   function escHtml(str) {
   if (str == null) return '';
   return String(str)
     .replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;')
     .replace(/'/g, '&#039;');
 }

  /**
   * Validate date string format (YYYY-MM-DD HH:MM:SS minimum)
   * @param {string} dateStr
   * @returns {boolean}
   */
  function isValidDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(dateStr)) return false;
  const d = new Date(dateStr.replace(' ', 'T'));
  return d instanceof Date && !isNaN(d.getTime());
}

// ==================== PERBAIKAN FILTER TANGGAL (FIX UTAMA) ====================
  /**
   * Convert date string to timestamp (ms) at local midnight for consistent date comparison
   * @param {string} dateStr
   * @returns {number}
   */
   function getTimestamp(dateStr) {
   if (!dateStr) return 0;
   // Extract date portion only (YYYY-MM-DD) for consistent comparison
   const datePart = dateStr.split(/[T ]/)[0];
   const parts = datePart.split('-');
   if (parts.length !== 3) return 0;
   // Create date at local midnight to avoid timezone shift issues
   const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
   if (isNaN(d.getTime())) return 0;
   return d.getTime();
}

  /**
   * Calculate week number within a month (Monday-based)
   * @param {string} dateStr
   * @returns {number}
   */
  function getWeekOfMonth(dateStr) {
  const d = new Date(dateStr.replace(' ', 'T'));
  const day = d.getDate();
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
  const dayOfWeek = firstDay.getDay();
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return Math.floor((day + offset - 1) / 7) + 1;
}

  /**
   * Convert YYYY-MM to Indonesian month label (e.g. "Apr 2026")
   * @param {string} ym
   * @returns {string}
   */
  function monthLabel(ym) {
  const [y, m] = ym.split('-');
  const names = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return names[parseInt(m)-1] + ' ' + y;
}

  /**
   * Generate a unique ID for a transaction
   * @returns {string}
   */
  function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
}

// ==================== HELPERS ====================
  function getInitialBalance() {
    const el = document.getElementById('initBal');
    return el ? parseFloat(el.value) || 0 : 0;
  }

  function setInitialBalance(val) {
    const el = document.getElementById('initBal');
    if (el) el.value = val;
  }

  function safeAddListener(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }

  /**
   * Safely get element by ID, returns null if not found
   * @param {string} id
   * @returns {HTMLElement|null}
   */
  function $(id) { return document.getElementById(id); }

  /**
   * Safely set element property only if element exists
   * @param {string} id
   * @param {string} prop
   * @param {*} value
   */
  function safeSet(id, prop, value) {
    const el = document.getElementById(id);
    if (el) el[prop] = value;
  }

// ==================== AUTH ====================
  function toggleDarkMode() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('darkMode', isDark ? '1' : '0');
    document.getElementById('darkBtn').textContent = isDark ? '☀️' : '🌙';
  }

  function logout() {
    if (!confirm('🚪 Logout? Anda perlu login lagi untuk mengakses aplikasi.')) return;
    sessionStorage.removeItem('treasuryLoggedIn');
    window.location.href = './login.html';
  }

  // ==================== STORAGE (Hybrid) ====================
  /** @type {Promise<void>|null} */
  let savePromise = null;
  /**
   * Save data to localStorage or IndexedDB (debounced 300ms)
   * @returns {Promise<void>}
   */
  async function saveToStorage() {
    // Clear existing timer if any
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);

    // If there's an existing pending promise, return it
    // so callers don't hang waiting for a promise that will never resolve
    if (savePromise) return savePromise;

    // Return a new promise that will be resolved/rejected after debounce
    savePromise = new Promise((resolve, reject) => {
      saveDebounceTimer = setTimeout(async () => {
        saveDebounceTimer = null;
        savePromise = null;
        try {
          const init = getInitialBalance();
          if (useIndexedDB && db) {
            try { await saveToIndexedDB(); } catch(e) {
              // Fallback to localStorage on IndexedDB error
              useIndexedDB = false;
              const data = { version: APP_VERSION, timestamp: Date.now(), initBal: init, rows };
              localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            }
          } else {
            const data = { version: APP_VERSION, timestamp: Date.now(), initBal: init, rows };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          }
          lastSavedTime = Date.now();
          updateStorageBadge();
          resolve();
        } catch (error) {
          savePromise = null;
          reject(error);
        }
      }, 300);
    });

    return savePromise;
  }

async function loadFromStorage() {
  if (rows.length > 5000) {
    await initDB();
    useIndexedDB = true;
    if (await loadFromIndexedDB()) {
      alert('✅ Data dimuat dari IndexedDB (5000+ transaksi)');
      refreshAll();
      return;
    }
  }
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const toast = document.getElementById('dlToast');
    document.getElementById('dlToastText').textContent = '⚠️ Belum ada data tersimpan di browser. Upload file Excel/JSON atau paste log baru.';
    toast.classList.add('show');
    setTimeout(() => hideToast('dlToast'), 4000);
    return;
  }
  if (!confirm('Load data dari browser? Data saat ini akan terganti.')) return;
  let data;
  try { data = JSON.parse(saved); } catch(e) { return alert('❌ Data di browser rusak/corrupt. Hapus data browser atau import backup JSON.'); }
  document.getElementById('initBal').value = data.initBal || 0;
  rows = (data.rows || []).map(function(r) {
    if (!r.playerLc) r.playerLc = (r.player || '').toLowerCase();
    if (!r.reasonLc) r.reasonLc = (r.reason || '').toLowerCase();
    return r;
  });
  balMapCache = null;
  sortedRowsCache = null;
  statsCache = null;
  existingKeysCache = new Set(rows.map(rowKey));
  dirtyIds.added.clear();
  dirtyIds.deleted.clear();
  document.getElementById('uploadZone').classList.add('upload-loaded');
  document.getElementById('uploadZoneText').innerHTML = `✅ Data browser dimuat — ${rows.length} transaksi`;
  saveToStorage();
  refreshAll();
  alert('✅ Data berhasil dimuat dari browser!');
}

function saveJSONBackup() {
  if (rows.length === 0) return alert('Tidak ada data untuk di-backup.');
  const data = { version: APP_VERSION, timestamp: Date.now(), initBal: parseFloat(document.getElementById('initBal').value)||0, rows };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `guild_treasury_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
}

function updateStorageBadge() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const badge = document.getElementById('storageBadge');
  if (saved) {
    const data = JSON.parse(saved);
    const date = new Date(data.timestamp);
    badge.textContent = `Browser: ${data.rows.length} tx • ${date.toLocaleDateString('id-ID')}`;
    const lastSavedEl = document.getElementById('lastSaved');
    lastSavedEl.style.display = 'block';
    lastSavedEl.innerHTML = `💾 Terakhir disimpan: ${date.toLocaleString('id-ID')}`;
  } else {
    badge.textContent = 'Browser Storage: Kosong';
  }
}

// ==================== FILE UPLOAD & PARSE LOG ====================
  // Handle file upload (Excel .xlsx or JSON backup)
  function handleFileSelect(e) {
  let file = e.target && e.target.files ? e.target.files[0] : (e.dataTransfer ? e.dataTransfer.files[0] : null);
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'json' && ext !== 'xlsx' && ext !== 'xls') {
    return alert('⚠️ Format file tidak didukung. Gunakan .xlsx, .xls, atau .json');
  }
  if (ext === 'json') {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.rows || !Array.isArray(data.rows)) {
          return alert('⚠️ File JSON tidak memiliki field "rows" yang valid.');
        }
        let validCount = 0, invalidCount = 0;
        const validRows = data.rows.filter(function(r) {
          if (!r || typeof r !== 'object') { invalidCount++; return false; }
          if (!r.date || !r.player || !r.reason || r.amount === undefined || r.amount === null) { invalidCount++; return false; }
          if (!isValidDate(String(r.date))) { invalidCount++; return false; }
          const amt = Number(r.amount);
          if (isNaN(amt) || !isFinite(amt)) { invalidCount++; return false; }
          r.amount = amt;
          r.date = String(r.date);
          r.player = String(r.player);
          r.reason = String(r.reason);
          if (!r.id) r.id = generateId();
          validCount++;
          return true;
        });
        if (validRows.length === 0) {
          return alert('⚠️ Tidak ada transaksi valid di file JSON. (' + invalidCount + ' baris tidak valid)');
        }
        rows = validRows.map(function(r) {
          if (!r.playerLc) r.playerLc = (r.player || '').toLowerCase();
          if (!r.reasonLc) r.reasonLc = (r.reason || '').toLowerCase();
          return r;
        });
        balMapCache = null;
        sortedRowsCache = null;
        statsCache = null;
        document.getElementById('initBal').value = data.initBal || 0;
        document.getElementById('uploadZone').classList.add('upload-loaded');
        let msg = '✅ ' + escHtml(file.name) + ' (JSON) — ' + validRows.length + ' transaksi';
        if (invalidCount > 0) msg += ' (' + invalidCount + ' baris dilewati)';
        document.getElementById('uploadZoneText').innerHTML = msg;
        saveToStorage();
        refreshAll();
        alert('✅ Backup JSON berhasil dimuat!' + (invalidCount > 0 ? '\n⚠️ ' + invalidCount + ' baris tidak valid dilewati.' : ''));
      } catch(err) { alert('❌ Gagal membaca JSON: ' + err.message); }
    };
    reader.readAsText(file);
  } else {
    // Check if XLSX library is available
    if (typeof XLSX === 'undefined') {
      return alert('⚠️ Library XLSX (SheetJS) belum dimuat. Pastikan koneksi internet tersedia untuk memuat library dari CDN.\n\nAlternatif: Gunakan file JSON backup.');
    }
    const reader = new FileReader();
    reader.onload = function(ev) {
      try {
        const wb = XLSX.read(new Uint8Array(ev.target.result), {type:'array'});
        const sheetName = wb.SheetNames.find(function(n) { return n.toLowerCase().includes('log'); }) || wb.SheetNames[0];
        if (!sheetName) return alert('⚠️ File Excel tidak memiliki sheet.');
        const ws = wb.Sheets[sheetName];
        const aoa = XLSX.utils.sheet_to_json(ws, {header:1});
        if (!aoa || aoa.length < 2) return alert('⚠️ Sheet "' + sheetName + '" kosong atau tidak memiliki data.');
        let validCount = 0, invalidCount = 0;
        rows = [];
        for (let i = 1; i < aoa.length; i++) {
          const r = aoa[i];
          if (!r || r.length < 5) { invalidCount++; continue; }
          const amt = Number(r[4]);
          if (isNaN(amt) || !isFinite(amt)) { invalidCount++; continue; }
          const dateStr = String(r[1]);
          if (!isValidDate(dateStr)) { invalidCount++; continue; }
          rows.push({date: dateStr, player: String(r[2]), reason: String(r[3]), amount: amt, id: generateId(), playerLc: String(r[2]).toLowerCase(), reasonLc: String(r[3]).toLowerCase()});
          validCount++;
        }
        balMapCache = null;
        sortedRowsCache = null;
        statsCache = null;
        document.getElementById('uploadZone').classList.add('upload-loaded');
        let msg = '✅ ' + escHtml(file.name) + ' — ' + validCount + ' transaksi';
        if (invalidCount > 0) msg += ' (' + invalidCount + ' baris dilewati)';
        document.getElementById('uploadZoneText').innerHTML = msg;
        saveToStorage();
        refreshAll();
        if (invalidCount > 0) alert('✅ Excel berhasil dimuat!\n⚠️ ' + invalidCount + ' baris tidak valid dilewati.');
      } catch(err) { alert('❌ Gagal membaca file: ' + err.message); }
    };
    reader.readAsArrayBuffer(file);
  }
}

  // Parse pasted log text and add new transactions (skip duplicates)
  function parseLog() {
  const raw = document.getElementById('logInput').value.trim();
  if (!raw) return;
  showLoading('Parsing log...');
  setTimeout(() => {
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    if (existingKeysCache.size === 0 || existingKeysCache.size !== rows.length) {
      existingKeysCache = new Set(rows.map(rowKey));
    }
    const added = [], duplicates = [];
    for (const line of lines) {
      if (/^\s*"?date\s+"?player\s+"?reason\s+"?amount/i.test(line)) continue;
      const matches = line.match(/"([^"]*)"/g);
      if (!matches || matches.length < 4) continue;
      const values = matches.map(m => m.slice(1, -1));
      const amt = parseFloat(values[3]);
      if (isNaN(amt) || !isFinite(amt)) continue;
      const entry = { date: values[0], player: values[1], reason: values[2], amount: amt, id: generateId(), playerLc: values[1].toLowerCase(), reasonLc: values[2].toLowerCase() };
      if (!isValidDate(entry.date)) continue;
      const key = rowKey(entry);
      if (existingKeysCache.has(key)) {
        duplicates.push(entry);
      } else {
        rows.push(entry);
        existingKeysCache.add(key);
        dirtyIds.added.add(entry.id);
        added.push(entry);
      }
    }
    hideLoading();
    showNotices(added.length, duplicates);
    balMapCache = null;
    sortedRowsCache = null;
    statsCache = null;
    saveToStorage();
    refreshAll();
  }, 50);
}

function showNotices(addedCount, duplicates) {
  lastDuplicates = duplicates;
  safeSet('dupNotice', 'style.display', 'none');
  safeSet('okNotice', 'className', '');
  safeSet('mergeDupBtn', 'style.display', duplicates.length > 0 ? 'inline-block' : 'none');
  if (duplicates.length > 0) {
    safeSet('dupSummary', 'textContent', `${duplicates.length} baris dilewati (duplikat). ${addedCount} baris baru ditambahkan.`);
    safeSet('dupBody', 'innerHTML', duplicates.map((r,i) => `
      <tr>
        <td style="color:#aaa">${i+1}</td>
        <td>${escHtml(r.date)}</td>
        <td><strong>${escHtml(r.player)}</strong></td>
        <td>${escHtml(r.reason)}</td>
        <td style="color:${r.amount>=0?'#1D9E75':'#D85A30'};font-weight:600">${fmt(r.amount)}</td>
        <td><span style="background:#fde68a;color:#78350f;font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600">DUPLIKAT</span></td>
      </tr>`).join(''));
    safeSet('dupNotice', 'style.display', 'block');
    setTimeout(() => { safeSet('dupNotice', 'style.display', 'none'); }, 8000);
  } else if (addedCount > 0) {
    safeSet('okText', 'textContent', `${addedCount} transaksi berhasil ditambahkan.`);
    safeSet('okNotice', 'className', 'visible');
    setTimeout(() => { safeSet('okNotice', 'className', ''); }, 4000);
  }
}

function mergeDuplicates() {
  if (lastDuplicates.length === 0) return;
  const grouped = {};
  lastDuplicates.forEach(function(d) {
    const key = rowKey(d);
    if (!grouped[key]) {
      grouped[key] = { date: d.date, player: d.player, reason: d.reason, amount: d.amount, count: 1 };
    } else {
      grouped[key].amount += d.amount;
      grouped[key].count++;
    }
  });
  let mergedCount = 0;
  Object.keys(grouped).forEach(function(key) {
    const g = grouped[key];
    if (g.count > 1) {
      const existing = rows.find(function(r) { return rowKey(r) === key; });
      if (existing) {
        existing.amount += g.amount;
        mergedCount++;
      }
    }
  });
  lastDuplicates = [];
  safeSet('dupNotice', 'style.display', 'none');
  safeSet('mergeDupBtn', 'style.display', 'none');
  balMapCache = null;
  sortedRowsCache = null;
  statsCache = null;
  saveToStorage();
  refreshAll();
  safeSet('okText', 'textContent', '✅ ' + mergedCount + ' duplikat di-merge (amount dijumlahkan).');
  safeSet('okNotice', 'className', 'visible');
  setTimeout(() => { safeSet('okNotice', 'className', ''); }, 4000);
}

// ==================== STATS & BALANCE MAP ====================
  // Unified function: compute stats + balance map in one traversal
  function computeStatsAndBalMap() {
  const init = parseFloat(document.getElementById('initBal').value) || 0;
  const sorted = sortedRowsCache && sortedRowsCache.length === rows.length
    ? sortedRowsCache
    : [...rows].sort((a, b) => a.date.localeCompare(b.date));

  let dep = 0, wit = 0, net = 0;
  let latestTime = 0;
  let run = init;
  const map = {};

  sorted.forEach(r => {
    if (r.amount > 0) dep += r.amount; else wit += r.amount;
    const t = new Date(r.date.replace(' ', 'T')).getTime();
    if (t > latestTime) latestTime = t;
    run += r.amount;
    map[rowKey(r)] = run;
  });

  net = dep + wit;
  statsCache = { init, dep, wit, net, latestTime, rowCount: rows.length };
  balMapCache = map;
  sortedRowsCache = sorted;
  return { map, stats: statsCache };
}

  // Recalculate all stats (balance, deposits, withdrawals, net)
  function recalc() {
  if (!statsCache || statsCache.rowCount !== rows.length || balMapCache === null) {
    computeStatsAndBalMap();
  }
  const s = statsCache;
  const init = parseFloat(document.getElementById('initBal').value) || 0;

  if (!s.latestTime) {
    document.getElementById('st-bal').textContent = fmt(init);
    document.getElementById('st-dep').textContent = '0';
    document.getElementById('st-wit').textContent = '0';
    document.getElementById('st-cnt').textContent = '0';
    document.getElementById('st-net').textContent = '0';
    document.getElementById('st-net').className = 'stat-value amber';
    document.getElementById('st-net24').textContent = '0';
    document.getElementById('st-net24').className = 'stat-value amber';
    document.getElementById('st-netWeek').textContent = '0';
    document.getElementById('st-netWeek').className = 'stat-value amber';
    return;
  }

  // Compute net24 and netWeek from balMapCache (sorted iteration)
  const latestDate = new Date(s.latestTime);
  const latestYm = latestDate.getFullYear() + '-' + String(latestDate.getMonth()+1).padStart(2,'0');
  const latestDateStr = latestDate.getFullYear() + '-' + String(latestDate.getMonth()+1).padStart(2,'0') + '-' + String(latestDate.getDate()).padStart(2,'0');
  const latestWeek = getWeekOfMonth(latestDateStr);
  let net24 = 0, netWeek = 0;
  sortedRowsCache.forEach(r => {
    const rt = new Date(r.date.replace(' ', 'T')).getTime();
    if (s.latestTime - rt <= 86400000) net24 += r.amount;
    const rDate = new Date(r.date.replace(' ', 'T'));
    const rYm = rDate.getFullYear() + '-' + String(rDate.getMonth()+1).padStart(2,'0');
    const rWeek = getWeekOfMonth(r.date);
    if (rYm === latestYm && rWeek === latestWeek) netWeek += r.amount;
  });

  const net = s.dep + s.wit;
  document.getElementById('st-bal').textContent = fmt(init + net);
  document.getElementById('st-dep').textContent = fmt(s.dep);
  document.getElementById('st-wit').textContent = fmt(s.wit);
  document.getElementById('st-cnt').textContent = rows.length;
  const netEl = document.getElementById('st-net');
  netEl.textContent = (net >= 0 ? '+' : '') + fmt(net);
  netEl.className = 'stat-value ' + (net > 0 ? 'green' : net < 0 ? 'red' : 'amber');
  const net24El = document.getElementById('st-net24');
  net24El.textContent = (net24 >= 0 ? '+' : '') + fmt(net24);
  net24El.className = 'stat-value ' + (net24 > 0 ? 'green' : net24 < 0 ? 'red' : 'amber');
  const netWeekEl = document.getElementById('st-netWeek');
  netWeekEl.textContent = (netWeek >= 0 ? '+' : '') + fmt(netWeek);
  netWeekEl.className = 'stat-value ' + (netWeek > 0 ? 'green' : netWeek < 0 ? 'red' : 'amber');
}

  // Calculate running balance map for all transactions (sorted by date)
  function buildBalMap() {
  if (balMapCache && statsCache && statsCache.rowCount === rows.length) {
    return balMapCache;
  }
  computeStatsAndBalMap();
  return balMapCache;
}

// ==================== FILTERS & TABLE (FILTER TANGGAL SUDAH DIFIX) ====================
  // Update filter dropdowns (player, reason) from current data
  function updateFilters() {
  // Use a simple checksum: count + first item's key to detect any data change
  const version = rows.length + '_' + (rows[0] ? rows[0].id : '');
  if (filterCache.version !== version) {
    filterCache.players = [...new Set(rows.map(r => r.player))].sort();
    filterCache.reasons = [...new Set(rows.map(r => r.reason))].sort();
    filterCache.tags = [...new Set(rows.map(r => r.tag || '').filter(Boolean))].sort();
    filterCache.currencies = [...new Set(rows.map(r => r.currency || 'Silver'))].sort();
    filterCache.version = version;
  }
  const fp = document.getElementById('fPlayer'), fr = document.getElementById('fReason'), ft = document.getElementById('fTag'), fc = document.getElementById('fCurrency');
  const pv = fp.value, rv = fr.value, tv = ft ? ft.value : '', cv = fc ? fc.value : '';
  fp.innerHTML = '<option value="">All</option>' + filterCache.players.map(p => `<option value="${escHtml(p)}">${escHtml(p)}</option>`).join('');
  fr.innerHTML = '<option value="">All</option>' + filterCache.reasons.map(r => `<option value="${escHtml(r)}">${escHtml(r)}</option>`).join('');
  if (ft) ft.innerHTML = '<option value="">All</option>' + filterCache.tags.map(t => `<option value="${escHtml(t)}">${escHtml(t)}</option>`).join('');
  if (fc) fc.innerHTML = '<option value="">All</option>' + filterCache.currencies.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');
  fp.value = pv; fr.value = rv; if (ft) ft.value = tv; if (fc) fc.value = cv;
}

  // Get currently filtered rows (respects all active filters)
  function getFilteredRows() {
    const fp = document.getElementById('fPlayer').value;
    const fr = document.getElementById('fReason').value;
    const ft = document.getElementById('fTag').value;
    const fc = document.getElementById('fCurrency').value;
    const fromVal = document.getElementById('fDateFrom').value;
    const toVal = document.getElementById('fDateTo').value;
    const sq = document.getElementById('fSearch').value.toLowerCase();

    // Precompute time values at midnight for consistent date comparison
    const fromTime = fromVal ? getTimestamp(fromVal.replace('T', ' ')) : 0;
    const toTime = toVal ? getTimestamp(toVal.replace('T', ' ').substring(0, 10) + ' 23:59:59') : 0;

    // Single pass filter instead of multiple .filter() chains
    const data = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (fp && r.player !== fp) continue;
      if (fr && r.reason !== fr) continue;
      if (ft && (r.tag || '') !== ft) continue;
      if (fc && (r.currency || 'Silver') !== fc) continue;
      if (fromTime && getTimestamp(r.date) < fromTime) continue;
      if (toTime && getTimestamp(r.date) > toTime) continue;
      if (sq) {
        const playerMatch = r.playerLc || r.player.toLowerCase();
        const reasonMatch = r.reasonLc || r.reason.toLowerCase();
        const tagMatch = (r.tag || '').toLowerCase();
        if (!playerMatch.includes(sq) && !reasonMatch.includes(sq) && !tagMatch.includes(sq) && !r.date.includes(sq)) continue;
      }
      data.push(r);
    }
    return data;
  }

  // Render transaction table with filters, sorting, and checkboxes
   function renderTable() {
   if (!balMapCache) balMapCache = buildBalMap();
   let data = getFilteredRows();

   // Create a map for O(1) lookup of row index in original rows array
   const rowIndexMap = new Map();
   rows.forEach((row, index) => {
     rowIndexMap.set(row.id, index);
   });

   // Sorting
   data.sort((a, b) => {
     let va, vb;
     switch (currentSort.col) {
       case 1: va = a.date; vb = b.date; break;
       case 2: va = a.player; vb = b.player; break;
       case 3: va = a.reason; vb = b.reason; break;
       case 4: va = a.tag || ''; vb = b.tag || ''; break;
       case 5: va = a.currency || 'Silver'; vb = b.currency || 'Silver'; break;
       case 6: va = a.amount; vb = b.amount; break;
       case 7: va = balMapCache[rowKey(a)]; vb = balMapCache[rowKey(b)]; break;
       default: va = a.date; vb = b.date;
     }
     if (typeof va === 'number' && typeof vb === 'number') {
       return currentSort.dir === 'asc' ? va - vb : vb - va;
     }
     return currentSort.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
   });

   const total = data.length;
   const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
   if (currentPage > totalPages) currentPage = totalPages;
   const start = (currentPage - 1) * rowsPerPage;
   const pageData = data.slice(start, start + rowsPerPage);

   document.getElementById('tbl-badge').textContent = rows.length + ' rows';
   const tbody = document.getElementById('tblBody');
   if (!total) {
     tbody.innerHTML = '<tr><td colspan="10" class="empty">Tidak ada data yang cocok</td></tr>';
     document.getElementById('pagination').className = 'pagination hidden';
     return;
   }
   tbody.innerHTML = pageData.map((r, i) => {
     const bal = balMapCache[rowKey(r)] ?? '';
     const pill = r.reason.toLowerCase().includes('deposit') ? 'pill-dep' : r.reason.toLowerCase().includes('withdrawal') ? 'pill-wit' : 'pill-oth';
     const checked = selectedIds.has(r.id) ? 'checked' : '';
     const globalIdx = (rowIndexMap.get(r.id) !== undefined ? rowIndexMap.get(r.id) + 1 : start + i + 1);
     return '<tr>' +
       '<td class="cb-cell"><input type="checkbox" ' + checked + ' onchange="toggleSelect(\'' + r.id + '\', this)"></td>' +
       '<td style="color:#aaa;font-size:11px">' + globalIdx + '</td>' +
       '<td style="font-size:12px">' + escHtml(r.date) + '</td>' +
       '<td style="font-weight:600">' + escHtml(r.player) + '</td>' +
       '<td><span class="pill ' + pill + '">' + escHtml(r.reason) + '</span></td>' +
       '<td>' + (r.tag ? '<span class="pill pill-oth" style="cursor:pointer" onclick="quickEditTag(\'' + r.id + '\')" title="Klik untuk edit tag">' + escHtml(r.tag) + '</span>' : '<span style="color:#ccc;cursor:pointer;font-size:11px" onclick="quickEditTag(\'' + r.id + '\')">+ tag</span>') + '</td>' +
       '<td><span class="pill pill-oth">' + escHtml(r.currency || 'Silver') + '</span></td>' +
       '<td class="' + (r.amount>=0?'amount-pos':'amount-neg') + '">' + fmt(r.amount) + '</td>' +
       '<td style="font-weight:600;font-size:12px">' + fmt(bal) + '</td>' +
       '<td class="action-btns">' +
         '<span onclick="editTransaction(\'' + r.id + '\')" title="Edit">✏️</span>' +
         '<span onclick="deleteTransaction(\'' + r.id + '\')" title="Delete">🗑️</span>' +
       '</td>' +
     '</tr>';
   }).join('');
   renderPagination(total, totalPages, start);
   updateBulkBar();
 }

function renderPagination(total, totalPages, start) {
  const container = document.getElementById('pagination');
  if (totalPages <= 1) {
    container.className = 'pagination hidden';
    return;
  }
  container.className = 'pagination';
  const from = start + 1;
  const to = Math.min(start + rowsPerPage, total);
  var html = '<span class="page-info">' + from + '-' + to + ' dari ' + total + ' transaksi</span>';
  html += '<div class="page-btns">';
  html += '<button onclick="goPage(' + (currentPage - 1) + ')" ' + (currentPage <= 1 ? 'disabled' : '') + '>‹</button>';
  var maxVisible = 7;
  var startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  var endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);
  if (startPage > 1) {
    html += '<button onclick="goPage(1)">1</button>';
    if (startPage > 2) html += '<span style="padding:0 4px;color:#94a3b8">…</span>';
  }
  for (var p = startPage; p <= endPage; p++) {
    html += '<button onclick="goPage(' + p + ')" class="' + (p === currentPage ? 'active' : '') + '">' + p + '</button>';
  }
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += '<span style="padding:0 4px;color:#94a3b8">…</span>';
    html += '<button onclick="goPage(' + totalPages + ')">' + totalPages + '</button>';
  }
  html += '<button onclick="goPage(' + (currentPage + 1) + ')" ' + (currentPage >= totalPages ? 'disabled' : '') + '>›</button>';
  html += '<select onchange="changeRPP(this.value)" style="margin-left:8px">';
  [25, 50, 100, 250, 500].forEach(function(n) {
    html += '<option value="' + n + '" ' + (n === rowsPerPage ? 'selected' : '') + '>' + n + '/hal</option>';
  });
  html += '</select></div>';
  container.innerHTML = html;
}

function goPage(p) {
  var data = getFilteredRows();
  var totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage));
  if (p < 1 || p > totalPages) return;
  currentPage = p;
  renderTable();
  document.querySelector('.tbl-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function changeRPP(n) {
  rowsPerPage = parseInt(n, 10);
  currentPage = 1;
  renderTable();
}

// ==================== CRUD ====================
function deleteTransaction(id) {
   if (!confirm('🗑️ Hapus transaksi ini secara permanen?')) return;
   const tx = rows.find(r => r.id === id);
   if (!tx) return;
   const index = rows.indexOf(tx);
   lastDeleted = { ...tx, _originalIndex: index };
   existingKeysCache.delete(rowKey(tx));
   dirtyIds.deleted.add(tx.id);
   rows = rows.filter(r => r.id !== id);
   balMapCache = null;
   sortedRowsCache = null;
   statsCache = null;
   logAudit('delete', { id: tx.id, player: tx.player, reason: tx.reason, amount: tx.amount, date: tx.date });
   saveToStorage();
   refreshAll();
   showUndoToast();
}

function showUndoToast() {
  if (undoTimeout) clearTimeout(undoTimeout);
  document.getElementById('undoToastText').innerHTML = `Transaksi dihapus. <strong>Undo?</strong>`;
  const toast = document.getElementById('undoToast');
  toast.style.display = 'flex';
  toast.classList.add('show');
  undoTimeout = setTimeout(() => hideToast('undoToast'), 8000);
}

function undoDelete() {
   if (lastDeleted) {
     if (!lastDeleted.playerLc) lastDeleted.playerLc = lastDeleted.player.toLowerCase();
     if (!lastDeleted.reasonLc) lastDeleted.reasonLc = lastDeleted.reason.toLowerCase();
     // Insert back at original position instead of pushing to end
     const index = lastDeleted._originalIndex;
     if (index !== undefined && index >= 0 && index <= rows.length) {
       rows.splice(index, 0, lastDeleted);
     } else {
       rows.push(lastDeleted); // fallback
     }
     existingKeysCache.add(rowKey(lastDeleted));
     lastDeleted = null;
   } else if (lastBulkDeleted) {
     lastBulkDeleted.forEach(function(r) {
       if (!r.playerLc) r.playerLc = r.player.toLowerCase();
       if (!r.reasonLc) r.reasonLc = r.reason.toLowerCase();
     });
     rows = rows.concat(lastBulkDeleted);
     lastBulkDeleted.forEach(function(r) { existingKeysCache.add(rowKey(r)); });
     lastBulkDeleted = null;
   } else {
     return;
   }
   hideToast('undoToast');
   if (undoTimeout) clearTimeout(undoTimeout);
   balMapCache = null;
   sortedRowsCache = null;
   statsCache = null;
   saveToStorage();
   refreshAll();
}

function editTransaction(id) {
  const tx = rows.find(r => r.id === id);
  if (!tx) return;
  editingId = id;
  document.getElementById('editDate').value = tx.date.replace(' ', 'T').substring(0, 16);
  document.getElementById('editPlayer').value = tx.player;
  document.getElementById('editReason').value = tx.reason;
  document.getElementById('editTag').value = tx.tag || '';
  document.getElementById('editCurrency').value = tx.currency || 'Silver';
  document.getElementById('editAmount').value = tx.amount;
  document.getElementById('editModal').style.display = 'flex';
}

function saveEdit() {
   if (!editingId) return;
   const tx = rows.find(r => r.id === editingId);
   if (!tx) return;
   const newDate = document.getElementById('editDate').value.trim().replace('T', ' ');
   const newPlayer = document.getElementById('editPlayer').value.trim();
   const newReason = document.getElementById('editReason').value.trim();
   const newTag = document.getElementById('editTag').value.trim();
   const newCurrency = document.getElementById('editCurrency').value;
   const newAmount = document.getElementById('editAmount').value;
   const dateStr = newDate.length <= 16 ? newDate + ':00' : newDate;
   if (!newDate) return showEditError('Tanggal tidak boleh kosong!');
   if (!newPlayer) return showEditError('Player name tidak boleh kosong!');
   if (!newReason) return showEditError('Reason tidak boleh kosong!');
   if (!isValidDate(dateStr)) return showEditError('Format tanggal tidak valid!');
   if (newAmount === '' || newAmount === null || newAmount === undefined) return showEditError('Amount tidak boleh kosong! Gunakan 0 untuk transaksi netral.');
   const amountNum = parseFloat(newAmount);
   if (isNaN(amountNum)) return showEditError('Amount harus berupa angka!');
   if (!isFinite(amountNum)) return showEditError('Amount tidak valid (Infinity)!');
   if (Math.abs(amountNum) > 9e15) return showEditError('Amount terlalu besar! Maks: 9.000.000.000.000.000');
   
   // Capture old values BEFORE overwriting
   const oldValues = {
     id: tx.id,
     date: tx.date,
     player: tx.player,
     reason: tx.reason,
     tag: tx.tag,
     currency: tx.currency,
     amount: tx.amount,
     playerLc: tx.playerLc,
     reasonLc: tx.reasonLc
   };
   
   tx.date = dateStr;
   tx.player = newPlayer;
   tx.reason = newReason;
   tx.tag = newTag || '';
   tx.currency = newCurrency;
   tx.amount = amountNum;
   tx.playerLc = newPlayer.toLowerCase();
   tx.reasonLc = newReason.toLowerCase();
   
   logAudit('edit', { 
     id: tx.id, 
     oldPlayer: oldValues.player, newPlayer: newPlayer, 
     oldReason: oldValues.reason, newReason: newReason,
     oldTag: oldValues.tag, newTag: newTag,
     oldCurrency: oldValues.currency, newCurrency: newCurrency,
     oldAmount: oldValues.amount, newAmount: amountNum
   });
   closeModal();
   balMapCache = null;
   sortedRowsCache = null;
   statsCache = null;
   saveToStorage();
   refreshAll();
}

function showEditError(msg) {
  const errEl = document.getElementById('editError');
  errEl.textContent = '❌ ' + msg;
  errEl.style.display = 'block';
  setTimeout(() => { errEl.style.display = 'none'; }, 4000);
}

function closeModal() {
  document.getElementById('editModal').style.display = 'none';
  const errEl = document.getElementById('editError');
  if (errEl) errEl.style.display = 'none';
  editingId = null;
}

function openAddModal() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  document.getElementById('addDate').value = local;
  document.getElementById('addPlayer').value = '';
  document.getElementById('addReason').value = '';
  document.getElementById('addTag').value = '';
  document.getElementById('addCurrency').value = 'Silver';
  document.getElementById('addAmount').value = '';
  document.getElementById('addError').style.display = 'none';
  document.getElementById('addModal').style.display = 'flex';
}

function closeAddModal() {
  document.getElementById('addModal').style.display = 'none';
  document.getElementById('addError').style.display = 'none';
}

function showAddError(msg) {
  const errEl = document.getElementById('addError');
  errEl.textContent = '❌ ' + msg;
  errEl.style.display = 'block';
  setTimeout(() => { errEl.style.display = 'none'; }, 4000);
}

function saveAdd() {
  const newDate = document.getElementById('addDate').value.trim().replace('T', ' ');
  const newPlayer = document.getElementById('addPlayer').value.trim();
  const newReason = document.getElementById('addReason').value.trim();
  const newTag = document.getElementById('addTag').value.trim();
  const newCurrency = document.getElementById('addCurrency').value;
  const newAmount = document.getElementById('addAmount').value;
  const dateStr = newDate.length <= 16 ? newDate + ':00' : newDate;
  if (!newDate) return showAddError('Tanggal tidak boleh kosong!');
  if (!newPlayer) return showAddError('Player name tidak boleh kosong!');
  if (!newReason) return showAddError('Reason tidak boleh kosong!');
  if (!isValidDate(dateStr)) return showAddError('Format tanggal tidak valid!');
  if (newAmount === '' || newAmount === null || newAmount === undefined) return showAddError('Amount tidak boleh kosong! Gunakan 0 untuk transaksi netral.');
  const amountNum = parseFloat(newAmount);
  if (isNaN(amountNum)) return showAddError('Amount harus berupa angka!');
  if (!isFinite(amountNum)) return showAddError('Amount tidak valid (Infinity)!');
  if (Math.abs(amountNum) > 9e15) return showAddError('Amount terlalu besar! Maks: 9.000.000.000.000.000');
  const entry = { date: dateStr, player: newPlayer, reason: newReason, tag: newTag || '', currency: newCurrency, amount: amountNum, id: generateId(), playerLc: newPlayer.toLowerCase(), reasonLc: newReason.toLowerCase() };
  rows.push(entry);
  existingKeysCache.add(rowKey(entry));
  dirtyIds.added.add(entry.id);
  balMapCache = null;
  sortedRowsCache = null;
  statsCache = null;
  logAudit('add', { id: entry.id, player: newPlayer, reason: newReason, tag: newTag || '', amount: amountNum, date: dateStr });
  closeAddModal();
  saveToStorage();
  refreshAll();
  const toast = document.getElementById('dlToast');
  document.getElementById('dlToastText').textContent = '✅ 1 transaksi ditambahkan.';
  toast.classList.add('show');
  setTimeout(() => hideToast('dlToast'), 3000);
}

function quickEditTag(id) {
  var tx = rows.find(function(r) { return r.id === id; });
  if (!tx) return;
  var newTag = prompt('Edit tag untuk ' + tx.player + ' (kosongkan untuk hapus):', tx.tag || '');
  if (newTag === null) return;
  tx.tag = newTag.trim();
  balMapCache = null;
  saveToStorage();
  refreshAll();
}

// ==================== PERIOD & MONTHLY ====================
  // Build weekly/daily period aggregation data
  function buildPeriodData() {
  const grouped = {};
  // Use cached sorted rows (ascending), then iterate in reverse for newest-first
  const sorted = sortedRowsCache && sortedRowsCache.length === rows.length
    ? [...sortedRowsCache].reverse()
    : [...rows].sort((a,b) => b.date.localeCompare(a.date));
  sorted.forEach(r => {
    const ymd = r.date.substring(0,10);
    const ym = r.date.substring(0,7);
    const week = getWeekOfMonth(r.date);
    const weekKey = ym + '-W' + week;
    if (!grouped[weekKey]) grouped[weekKey] = { ym, week, net:0, dep:0, wit:0, days:{} };
    if (!grouped[weekKey].days[ymd]) grouped[weekKey].days[ymd] = { net:0, dep:0, wit:0 };
    grouped[weekKey].net += r.amount;
    grouped[weekKey].days[ymd].net += r.amount;
    if (r.amount > 0) {
      grouped[weekKey].dep += r.amount;
      grouped[weekKey].days[ymd].dep += r.amount;
    } else {
      grouped[weekKey].wit += r.amount;
      grouped[weekKey].days[ymd].wit += r.amount;
    }
  });
  return grouped;
}

function renderPeriod() {
  const grouped = buildPeriodData();
  const container = document.getElementById('periodGrid');
  const keys = Object.keys(grouped).sort((a,b) => b.localeCompare(a));
  if (!keys.length) {
    container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:#aaa;font-size:13px">Belum ada data</div>';
    return;
  }
  container.innerHTML = keys.map(k => {
    const w = grouped[k];
    const dayKeys = Object.keys(w.days).sort((a,b) => b.localeCompare(a));
    const daysHtml = dayKeys.map(d => {
      const dayData = w.days[d];
      const netCls = dayData.net >= 0 ? 'green' : 'red';
      return `<div style="display:flex;justify-content:space-between;font-size:11px;padding:4px 0;border-bottom:1px dashed #eee;">
          <span>📅 ${d}</span>
          <span class="${netCls}" style="font-weight:600">${dayData.net >= 0 ? '+' : ''}${fmt(dayData.net)}</span>
      </div>`;
    }).join('');
    const wNetCls = w.net >= 0 ? 'green' : 'red';
    return `<div class="month-card">
      <div class="month-label">Bulan ${w.ym} - Minggu ${w.week}</div>
      <div class="month-rows" style="margin-bottom:8px">
        <div class="month-row"><span class="month-row-label">Total Masuk</span><span class="month-row-val green">+${fmt(w.dep)}</span></div>
        <div class="month-row"><span class="month-row-label">Total Keluar</span><span class="month-row-val red">${fmt(w.wit)}</span></div>
        <div class="month-row" style="margin-top:4px"><span class="month-row-label" style="font-weight:600;color:#333">Net Minggu Ini</span><span class="month-row-val ${wNetCls}" style="font-size:13px">${w.net >= 0 ? '+' : ''}${fmt(w.net)}</span></div>
      </div>
      <div style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;margin-top:8px">Rincian Harian:</div>
      ${daysHtml}
    </div>`;
  }).join('');
}

  // Build monthly aggregation data (open balance, deposits, withdrawals, close balance)
  function buildMonthlyData() {
  const init = parseFloat(document.getElementById('initBal').value) || 0;
  const sorted = sortedRowsCache && sortedRowsCache.length === rows.length
    ? sortedRowsCache
    : [...rows].sort((a,b) => a.date.localeCompare(b.date));
  const monthOrder = [], monthMap = {};
  let run = init;
  sorted.forEach(r => {
    const ym = r.date.substring(0,7);
    if (!monthMap[ym]) {
      monthMap[ym] = {ym, openBal: run, dep:0, wit:0, count:0, closeBal:run};
      monthOrder.push(ym);
    }
    run += r.amount;
    if (r.amount > 0) monthMap[ym].dep += r.amount; else monthMap[ym].wit += r.amount;
    monthMap[ym].count++;
    monthMap[ym].closeBal = run;
  });
  return {monthOrder, monthMap};
}

function renderMonthly() {
  const {monthOrder, monthMap} = buildMonthlyData();
  const grid = document.getElementById('monthlyGrid');
  if (!monthOrder.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:#aaa;font-size:13px">Belum ada data</div>';
    return;
  }
  grid.innerHTML = monthOrder.map(ym => {
    const m = monthMap[ym];
    const net = m.dep + m.wit;
    const netCls = net >= 0 ? 'green' : 'red';
    return `<div class="month-card">
      <div class="month-label">📅 ${monthLabel(ym)}<span class="month-cnt">${m.count} transaksi</span></div>
      <div class="month-rows">
        <div class="month-row"><span class="month-row-label">Saldo Awal (Tgl 1)</span><span class="month-row-val">${fmt(m.openBal)}</span></div>
        <div class="month-row"><span class="month-row-label">Total Masuk</span><span class="month-row-val green">+${fmt(m.dep)}</span></div>
        <div class="month-row"><span class="month-row-label">Total Keluar</span><span class="month-row-val red">${fmt(m.wit)}</span></div>
        <div class="month-row"><span class="month-row-label">Net Bulan Ini</span><span class="month-row-val ${netCls}">${net>=0?'+':''}${fmt(net)}</span></div>
      </div>
      <hr class="month-divider">
      <div class="month-row"><span class="month-row-label" style="font-weight:600">Saldo Akhir</span><span class="month-bal amber">${fmt(m.closeBal)}</span></div>
    </div>`;
  }).join('');
}

// ==================== CHART ====================
function renderChart() {
  const container = document.getElementById('chartContainer');
  const {monthOrder, monthMap} = buildMonthlyData();
  if (!monthOrder.length) {
    container.innerHTML = '<div style="text-align:center;padding:2rem;color:#aaa;font-size:13px">Belum ada data</div>';
    return;
  }
  const type = document.getElementById('chartType').value;
  const metric = document.getElementById('chartMetric').value;
  const labels = monthOrder.map(ym => monthLabel(ym));
  const values = monthOrder.map(ym => {
    const m = monthMap[ym];
    if (metric === 'net') return m.dep + m.wit;
    if (metric === 'dep') return m.dep;
    if (metric === 'wit') return Math.abs(m.wit);
    if (metric === 'count') return m.count;
    return 0;
  });
  const maxVal = Math.max.apply(null, values.concat([1]));
  const minVal = Math.min.apply(null, values);
  const hasNeg = minVal < 0;
  const chartH = 220;
  const padL = 60, padR = 10, padT = 10, padB = 50;
  const W = Math.max(600, labels.length * 80);
  const chartW = W - padL - padR;
  const chartH2 = chartH - padT - padB;
  const zeroY = hasNeg ? padT + chartH2 / 2 : padT + chartH2;
  const scaleH = hasNeg ? chartH2 / 2 : chartH2;

  let svg = '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + chartH + '" xmlns="http://www.w3.org/2000/svg">';

  // Grid lines
  var steps = 4;
  for (var i = 0; i <= steps; i++) {
    var y = padT + (chartH2 / steps) * i;
    var val = hasNeg ? maxVal - (maxVal - minVal) * (i / steps) : maxVal * (1 - i / steps);
    svg += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" stroke="#e2e8f0" stroke-width="1"/>';
    svg += '<text x="' + (padL - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="9" fill="#94a3b8">' + shortNum(val) + '</text>';
  }
  if (hasNeg) {
    svg += '<line x1="' + padL + '" y1="' + zeroY + '" x2="' + (W - padR) + '" y2="' + zeroY + '" stroke="#94a3b8" stroke-width="1.5"/>';
  }

  var barW = Math.min(40, (chartW / labels.length) * 0.6);
  var gap = chartW / labels.length;

  if (type === 'bar' || type === 'both') {
    for (var j = 0; j < values.length; j++) {
      var x = padL + gap * j + (gap - barW) / 2;
      var v = values[j];
      var barH = (Math.abs(v) / (hasNeg ? Math.max(maxVal, Math.abs(minVal)) : maxVal)) * scaleH;
      var barY = v >= 0 ? zeroY - barH : zeroY;
      var color = v >= 0 ? '#1D9E75' : '#D85A30';
      svg += '<rect x="' + x + '" y="' + barY + '" width="' + barW + '" height="' + barH + '" fill="' + color + '" rx="3" opacity="0.85">';
      svg += '<title>' + labels[j] + ': ' + fmt(v) + '</title></rect>';
    }
  }

  if (type === 'line' || type === 'both') {
    var pts = [];
    for (var k = 0; k < values.length; k++) {
      var px = padL + gap * k + gap / 2;
      var py = zeroY - (values[k] / (hasNeg ? Math.max(maxVal, Math.abs(minVal)) : maxVal)) * scaleH;
      pts.push({ x: px, y: py, v: values[k], label: labels[k] });
    }
    if (pts.length > 1) {
      var pathD = pts.map(function(p, i) { return (i === 0 ? 'M' : 'L') + p.x + ' ' + p.y; }).join(' ');
      svg += '<path d="' + pathD + '" fill="none" stroke="#1e40af" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    pts.forEach(function(p) {
      svg += '<circle cx="' + p.x + '" cy="' + p.y + '" r="4" fill="#1e40af" stroke="#fff" stroke-width="1.5">';
      svg += '<title>' + p.label + ': ' + fmt(p.v) + '</title></circle>';
    });
  }

  // X labels
  for (var l = 0; l < labels.length; l++) {
    var lx = padL + gap * l + gap / 2;
    svg += '<text x="' + lx + '" y="' + (chartH - 4) + '" text-anchor="middle" font-size="9" fill="#64748b" transform="rotate(-30,' + lx + ',' + (chartH - 4) + ')">' + labels[l] + '</text>';
  }

  svg += '</svg>';

  // Legend
  var legend = '<div class="chart-legend">';
  if (type === 'bar' || type === 'both') {
    legend += '<span><span class="dot" style="background:#1D9E75"></span> Positif</span>';
    legend += '<span><span class="dot" style="background:#D85A30"></span> Negatif</span>';
  }
  if (type === 'line' || type === 'both') {
    legend += '<span><span class="dot" style="background:#1e40af"></span> Trend</span>';
  }
  legend += '</div>';

  container.innerHTML = '<div class="chart-wrap">' + svg + '<div class="chart-tooltip" id="chartTip"></div></div>' + legend;
}

function shortNum(n) {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.round(n).toString();
}

// ==================== SORT ====================
 function sortTable(col) {
  if (currentSort.col === col) {
    currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.col = col;
    currentSort.dir = 'desc';
  }
  document.getElementById('fSort').value = currentSort.dir;
  applySortClasses();
  renderTable();
}

function applySort(dir) {
  currentSort.dir = dir;
  applySortClasses();
  renderTable();
}

function applySortClasses() {
  document.querySelectorAll('th.sortable').forEach(function(th) {
    th.classList.remove('sort-active', 'asc', 'desc');
    if (parseInt(th.dataset.col) === currentSort.col) {
      th.classList.add('sort-active', currentSort.dir);
    }
  });
}

// ==================== DOWNLOAD EXCEL ====================
function autoDownloadExcel() {
  if (typeof XLSX === 'undefined') {
    return alert('⚠️ Library XLSX (SheetJS) belum dimuat. Pastikan koneksi internet tersedia.\n\nAlternatif: Export CSV.');
  }
  showLoading('Membuat Excel...');
  setTimeout(() => {
    const wb = XLSX.utils.book_new();
    const init = parseFloat(document.getElementById('initBal').value) || 0;
    const filtered = getFilteredRows();
    const exportRows = filtered.length > 0 ? filtered : rows;
    const balMap = balMapCache || buildBalMap();
    const sorted = [...exportRows].sort((a,b) => a.date.localeCompare(b.date));
    const txAoa = [['#','Date & Time','Player','Reason','Amount','Running Balance']];
    sorted.forEach((r,i) => txAoa.push([i+1, r.date, r.player, r.reason, r.amount, balMap[rowKey(r)] ?? '']));
    const ws1 = XLSX.utils.aoa_to_sheet(txAoa);
    ws1['!cols'] = [{wch:5},{wch:22},{wch:16},{wch:14},{wch:14},{wch:18}];
    XLSX.utils.book_append_sheet(wb, ws1, 'Log Transaksi');

    const periodData = buildPeriodData();
    const pKeys = Object.keys(periodData).sort((a,b) => b.localeCompare(a));
    const pAoa = [['Bulan - Minggu','Tanggal / Periode','Total Masuk','Total Keluar','Net']];
    pKeys.forEach(k => {
      const w = periodData[k];
      pAoa.push([`Bulan ${w.ym} - Minggu ${w.week}`, 'Mingguan', w.dep, w.wit, w.net]);
      const dKeys = Object.keys(w.days).sort((a,b)=>b.localeCompare(a));
      dKeys.forEach(d => {
        const dayData = w.days[d];
        pAoa.push(['', d, dayData.dep, dayData.wit, dayData.net]);
      });
    });
    const wsP = XLSX.utils.aoa_to_sheet(pAoa);
    wsP['!cols'] = [{wch:25},{wch:18},{wch:15},{wch:15},{wch:15}];
    XLSX.utils.book_append_sheet(wb, wsP, 'Rekap Mingguan & Harian');

    const {monthOrder, monthMap} = buildMonthlyData();
    const mAoa = [['Bulan','Saldo Awal (Tgl 1)','Total Masuk','Total Keluar','Net','Saldo Akhir','Jumlah Transaksi']];
    monthOrder.forEach(ym => {
      const m = monthMap[ym];
      mAoa.push([monthLabel(ym), m.openBal, m.dep, m.wit, m.dep+m.wit, m.closeBal, m.count]);
    });
    const totalDep = monthOrder.reduce((s,ym) => s + monthMap[ym].dep, 0);
    const totalWit = monthOrder.reduce((s,ym) => s + monthMap[ym].wit, 0);
    mAoa.push(['TOTAL','',''+totalDep,''+totalWit,''+(totalDep+totalWit),'',''+rows.length]);
    const ws2 = XLSX.utils.aoa_to_sheet(mAoa);
    ws2['!cols'] = [{wch:12},{wch:20},{wch:16},{wch:16},{wch:14},{wch:16},{wch:18}];
    XLSX.utils.book_append_sheet(wb, ws2, 'Rekap Bulanan');

    const now = new Date();
    const ws3 = XLSX.utils.aoa_to_sheet([
      ['Guild Treasury — Albion Online ' + APP_VERSION],
      ['Generated', now.toLocaleString('id-ID')],
      ['Initial Balance', init],
      ['Total Transaksi', rows.length],
      ['Filtered', filtered.length > 0 ? filtered.length : rows.length],
      ['Current Balance', init + rows.reduce((s,r) => s + r.amount, 0)]
    ]);
    XLSX.utils.book_append_sheet(wb, ws3, 'Info');

    const ts = now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0');
    const suffix = filtered.length > 0 && filtered.length < rows.length ? '_filtered' : '';
    const fname = `guild_treasury${suffix}_${ts}.xlsx`;
    XLSX.writeFile(wb, fname);

    hideLoading();
    const toast = document.getElementById('dlToast');
    document.getElementById('dlToastText').textContent = `${fname} terunduh! (${exportRows.length} tx)`;
    toast.classList.add('show');
    setTimeout(() => hideToast('dlToast'), 3500);
  }, 50);
}

// ==================== EXPORT CSV ====================
function exportCSV() {
  if (!rows.length) return alert('Tidak ada data');
  const filtered = getFilteredRows();
  const exportRows = filtered.length > 0 ? filtered : rows;
  const balMap = balMapCache || buildBalMap();
  const csvContent = [
    ['Date & Time','Player','Reason','Amount','Running Balance'],
    ...exportRows.map(r => [r.date, r.player, r.reason, r.amount, balMap[rowKey(r)] ?? ''])
  ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `guild_treasury${filtered.length > 0 && filtered.length < rows.length ? '_filtered' : ''}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  const toast = document.getElementById('dlToast');
  document.getElementById('dlToastText').innerHTML = `✅ CSV berhasil diunduh! (${exportRows.length} tx)`;
  toast.classList.add('show');
  setTimeout(() => hideToast('dlToast'), 3000);
}

function exportPDF() {
  if (typeof XLSX === 'undefined') {
    return alert('⚠️ Library XLSX (SheetJS) belum dimuat. Pastikan koneksi internet tersedia.');
  }
  if (!rows.length) return alert('Tidak ada data');
  const filtered = getFilteredRows();
  const exportRows = filtered.length > 0 ? filtered : rows;
  const balMap = balMapCache || buildBalMap();
  const init = parseFloat(document.getElementById('initBal').value) || 0;
  const sorted = [...exportRows].sort((a, b) => a.date.localeCompare(b.date));
  const totalDep = exportRows.reduce(function(s, r) { return s + (r.amount > 0 ? r.amount : 0); }, 0);
  const totalWit = exportRows.reduce(function(s, r) { return s + (r.amount < 0 ? r.amount : 0); }, 0);
  const net = totalDep + totalWit;

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Guild Treasury Report</title>';
  html += '<style>';
  html += '@page{margin:1.5cm}';
  html += 'body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;padding:0}';
  html += '.rpt-header{text-align:center;border-bottom:2px solid #1e40af;padding-bottom:10px;margin-bottom:16px}';
  html += '.rpt-header h1{font-size:16px;color:#1e40af;margin:0}';
  html += '.rpt-header p{font-size:10px;color:#64748b;margin:4px 0 0}';
  html += '.rpt-summary{display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap}';
  html += '.rpt-stat{flex:1;min-width:120px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px}';
  html += '.rpt-stat-label{font-size:9px;color:#94a3b8;text-transform:uppercase}';
  html += '.rpt-stat-value{font-size:14px;font-weight:700}';
  html += '.green{color:#1D9E75}.red{color:#D85A30}.amber{color:#BA7517}';
  html += 'table{width:100%;border-collapse:collapse;margin-bottom:16px}';
  html += 'th{background:#f1f5f9;text-align:left;padding:6px 8px;font-size:9px;color:#64748b;border-bottom:1px solid #e2e8f0}';
  html += 'td{padding:5px 8px;border-bottom:1px solid #f1f5f9;font-size:10px}';
  html += 'tr:nth-child(even){background:#fafafa}';
  html += '.amount-pos{color:#1D9E75;font-weight:600}.amount-neg{color:#D85A30;font-weight:600}';
  html += '.rpt-footer{font-size:9px;color:#94a3b8;text-align:center;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px}';
  html += '</style></head><body>';

  html += '<div class="rpt-header"><h1>Guild Treasury — Albion Online</h1>';
  html += '<p>Laporan: ' + new Date().toLocaleString('id-ID') + ' | ' + sorted.length + ' transaksi</p></div>';

  html += '<div class="rpt-summary">';
  html += '<div class="rpt-stat"><div class="rpt-stat-label">Saldo Awal</div><div class="rpt-stat-value">' + fmt(init) + '</div></div>';
  html += '<div class="rpt-stat"><div class="rpt-stat-label">Total Masuk</div><div class="rpt-stat-value green">+' + fmt(totalDep) + '</div></div>';
  html += '<div class="rpt-stat"><div class="rpt-stat-label">Total Keluar</div><div class="rpt-stat-value red">' + fmt(totalWit) + '</div></div>';
  html += '<div class="rpt-stat"><div class="rpt-stat-label">Net</div><div class="rpt-stat-value ' + (net >= 0 ? 'green' : 'red') + '">' + (net >= 0 ? '+' : '') + fmt(net) + '</div></div>';
  html += '<div class="rpt-stat"><div class="rpt-stat-label">Saldo Akhir</div><div class="rpt-stat-value amber">' + fmt(init + net) + '</div></div>';
  html += '</div>';

  html += '<table><thead><tr><th>#</th><th>Tanggal</th><th>Player</th><th>Reason</th><th>Amount</th><th>Balance</th></tr></thead><tbody>';
  sorted.forEach(function(r, i) {
    var bal = balMap[rowKey(r)] ?? '';
    var cls = r.amount >= 0 ? 'amount-pos' : 'amount-neg';
    html += '<tr><td>' + (i + 1) + '</td><td>' + escHtml(r.date) + '</td><td>' + escHtml(r.player) + '</td><td>' + escHtml(r.reason) + '</td><td class="' + cls + '">' + fmt(r.amount) + '</td><td>' + fmt(bal) + '</td></tr>';
  });
  html += '</tbody></table>';

  html += '<div class="rpt-footer">Guild Treasury V8.0 — Generated ' + new Date().toLocaleString('id-ID') + '</div>';
  html += '</body></html>';

  var win = window.open('', '_blank');
  if (!win) return alert('⚠️ Pop-up diblokir. Izinkan pop-up untuk export PDF.');
  win.document.write(html);
  win.document.close();
  win.onload = function() { win.print(); };
}

// ==================== TAB SWITCH ====================
function switchTab(n) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', i === n));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('tab-' + n);
  if (panel) panel.classList.add('active');
}

// ==================== BULK SELECT & DELETE ====================
function toggleSelect(id, cb) {
  if (cb.checked) selectedIds.add(id); else selectedIds.delete(id);
  updateBulkBar();
}

 function toggleSelectAll(cb) {
  const filtered = getFilteredRows();
  if (cb.checked) {
    filtered.forEach(r => selectedIds.add(r.id));
  } else {
    const filteredIds = new Set(filtered.map(r => r.id));
    for (const id of selectedIds) {
      if (filteredIds.has(id)) selectedIds.delete(id);
    }
  }
  renderTable();
}

function selectAllVisible() {
  getFilteredRows().forEach(r => selectedIds.add(r.id));
  renderTable();
}

function clearSelection() {
  selectedIds.clear();
  document.getElementById('selectAllCb').checked = false;
  renderTable();
}

function updateBulkBar() {
  const bar = document.getElementById('bulkBar');
  const count = selectedIds.size;
  document.getElementById('bulkCountBar').textContent = count + ' dipilih';
  if (count > 0) {
    bar.classList.add('visible');
  } else {
    bar.classList.remove('visible');
  }
}

function openBulkModal() {
  if (selectedIds.size === 0) return;
  document.getElementById('bulkCount').textContent = selectedIds.size;
  document.getElementById('bulkModal').style.display = 'flex';
}

function closeBulkModal() {
  document.getElementById('bulkModal').style.display = 'none';
}

function confirmBulkDelete() {
   if (selectedIds.size === 0) return;
   const count = selectedIds.size;
   lastBulkDeleted = rows.filter(r => selectedIds.has(r.id)).map(function(r) { return Object.assign({}, r); });
   lastBulkDeleted.forEach(function(r) { dirtyIds.deleted.add(r.id); });
   lastBulkDeleted.forEach(function(r) { existingKeysCache.delete(rowKey(r)); });
   rows = rows.filter(r => !selectedIds.has(r.id));
   logAudit('bulk_delete', { count: count, ids: Array.from(selectedIds) });
   selectedIds.clear();
   closeBulkModal();
   document.getElementById('selectAllCb').checked = false;
   balMapCache = null;
   sortedRowsCache = null;
   statsCache = null;
   saveToStorage();
   refreshAll();
  const toast = document.getElementById('undoToast');
  if (toast) {
    safeSet('undoToastText', 'innerHTML', `🗑 ${count} transaksi dihapus. <strong>Undo?</strong>`);
    toast.style.display = 'flex';
    toast.classList.add('show');
  }
  if (undoTimeout) clearTimeout(undoTimeout);
  undoTimeout = setTimeout(() => hideToast('undoToast'), 8000);
}

// ==================== RESET WITH AUTO-BACKUP ====================
function resetAll() {
  if (rows.length === 0) {
    rows = [];
    safeSet('logInput', 'value', '');
    safeSet('excelFile', 'value', '');
    safeSet('uploadZone', 'className', 'upload-zone');
    safeSet('uploadZoneText', 'innerHTML', '📂 Klik atau drag &amp; drop file Excel / JSON di sini');
    safeSet('dupNotice', 'style.display', 'none');
    safeSet('okNotice', 'className', '');
    balMapCache = null;
    sortedRowsCache = null;
    statsCache = null;
    filterCache = { players: null, reasons: null, tags: null, currencies: null, version: -1 };
    saveToStorage();
    refreshAll();
    return;
  }
  document.getElementById('resetTxCount').textContent = rows.length;
  document.getElementById('resetModal').style.display = 'flex';
}

function closeResetModal() {
  document.getElementById('resetModal').style.display = 'none';
}

async function confirmReset() {
  showLoading('Membuat backup...');
  let backupOk = false;
  try {
    const data = { version: APP_VERSION, timestamp: Date.now(), initBal: parseFloat(document.getElementById('initBal').value)||0, rows };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `guild_treasury_RESET_BACKUP_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    backupOk = true;
  } catch(e) {
    hideLoading();
    return alert('❌ Gagal membuat backup. Reset dibatalkan.');
  }
  if (!backupOk) { hideLoading(); return; }
   existingKeysCache.clear();
   rows = [];
   selectedIds.clear();
   document.getElementById('selectAllCb').checked = false;
   document.getElementById('logInput').value = '';
   document.getElementById('excelFile').value = '';
   document.getElementById('uploadZone').className = 'upload-zone';
   document.getElementById('uploadZoneText').innerHTML = '📂 Klik atau drag &amp; drop file Excel / JSON di sini';
   document.getElementById('dupNotice').style.display = 'none';
   document.getElementById('okNotice').className = '';
   closeResetModal();
   balMapCache = null;
   sortedRowsCache = null;
   statsCache = null;
   filterCache = { players: null, reasons: null, tags: null, currencies: null, version: -1 };
   saveToStorage();
   refreshAll();
  hideLoading();
  const toast = document.getElementById('dlToast');
  document.getElementById('dlToastText').textContent = '✅ Data direset. Backup telah diunduh.';
  toast.classList.add('show');
  setTimeout(() => hideToast('dlToast'), 4000);
}

// ==================== MISC ====================
function showToast(msg, duration) {
  const toast = document.getElementById('dlToast');
  document.getElementById('dlToastText').textContent = msg;
  toast.classList.add('show');
  setTimeout(function() { hideToast('dlToast'); }, duration || 3000);
}

function downloadJSON(data, filename) {
  var blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getColorClass(value) {
  return value > 0 ? 'green' : value < 0 ? 'red' : 'amber';
}

function updateDownloadBtn() {
  const btn = document.getElementById('dlBtn');
  const has = rows.length > 0;
  btn.disabled = !has;
  btn.style.opacity = has ? '1' : '0.4';
  btn.style.cursor = has ? 'pointer' : 'not-allowed';
}

function hideToast(id) {
  const toast = document.getElementById(id);
  toast.classList.remove('show');
  setTimeout(() => { toast.style.display = 'none'; }, 300);
}

function showLoading(text) {
  document.getElementById('loadingText').textContent = text || 'Memproses...';
  document.getElementById('loadingOverlay').classList.add('visible');
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.remove('visible');
}

  // Refresh all UI components (filters, stats, tables, recaps)
// ==================== REFRESH & INIT ====================
  function refreshAll() {
  balMapCache = null;
  sortedRowsCache = null;
  statsCache = null;
  // Rebuild existingKeysCache to reflect any edits
  existingKeysCache = new Set(rows.map(rowKey));
  updateFilters();
  recalc();
  renderTable();
  renderPeriod();
  renderMonthly();
  renderChart();
  updateDownloadBtn();
  updateStorageBadge();
}

// ==================== KEYBOARD SHORTCUTS ====================
  document.addEventListener('keydown', function(e) {
    // Don't trigger shortcuts when user is typing in input fields
    const tag = e.target.tagName.toLowerCase();
    const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const ctrl = isMac ? e.metaKey : e.ctrlKey;

    // Ctrl+Enter always works (parse log)
    if (ctrl && e.key === 'Enter') {
      e.preventDefault();
      parseLog();
    }
    // Ctrl+S: save (skip when typing in inputs to avoid conflicts)
    if (ctrl && e.key === 's' && !isTyping) {
      e.preventDefault();
      saveToStorage().then(() => {
        const toast = document.getElementById('dlToast');
        if (toast) {
          safeSet('dlToastText', 'textContent', '💾 Data tersimpan!');
          toast.classList.add('show');
          setTimeout(() => hideToast('dlToast'), 2000);
        }
      });
    }
    // Ctrl+E: export (skip when typing)
    if (ctrl && e.key === 'e' && !isTyping) {
      e.preventDefault();
      if (rows.length > 0) autoDownloadExcel();
    }
    // Escape: always works to close modals
    if (e.key === 'Escape') {
      closeModal();
      closeAddModal();
      closeResetModal();
      closeBulkModal();
      safeSet('dupNotice', 'style.display', 'none');
    }
    // Ctrl+F: focus search (skip when already typing)
    if (ctrl && e.key === 'f' && !isTyping) {
      e.preventDefault();
      const searchEl = document.getElementById('fSearch');
      if (searchEl) searchEl.focus();
    }
  });

// ==================== INIT ====================
window.onload = async function () {
  try {
    await initDB();
    try {
      const savedAudit = localStorage.getItem('albionAuditLog');
      if (savedAudit) auditLog = JSON.parse(savedAudit);
    } catch(e) { auditLog = []; }
    if (localStorage.getItem('darkMode') === '1') {
      document.body.classList.add('dark');
      document.getElementById('darkBtn').textContent = '☀️';
    }
    updateStorageBadge();
    // Initial balance input listener (if element exists)
    const initBalEl = document.getElementById('initBal');
    if (initBalEl) {
      initBalEl.addEventListener('input', function() { recalc(); renderMonthly(); renderPeriod(); saveToStorage(); });
    }
    const logoutBtnEl = document.getElementById('logoutBtn');
    if (logoutBtnEl) logoutBtnEl.addEventListener('click', logout);
    safeAddListener('loadBtn', 'click', loadFromStorage);
    safeAddListener('backupBtn', 'click', saveJSONBackup);
    safeAddListener('resetBtn', 'click', resetAll);
    safeAddListener('parseBtn', 'click', parseLog);
    safeAddListener('addManualBtn', 'click', openAddModal);
    safeAddListener('clearLogBtn', 'click', function() { const el = document.getElementById('logInput'); if (el) el.value = ''; });
    safeAddListener('dlBtn', 'click', autoDownloadExcel);
    safeAddListener('csvBtn', 'click', exportCSV);
    safeAddListener('pdfBtn', 'click', exportPDF);
    safeAddListener('fPlayer', 'change', renderTable);
    safeAddListener('fReason', 'change', renderTable);
    safeAddListener('fTag', 'change', renderTable);
    safeAddListener('fCurrency', 'change', renderTable);
    safeAddListener('fDateFrom', 'change', renderTable);
    safeAddListener('fDateTo', 'change', renderTable);
    safeAddListener('fSort', 'change', function() { applySort(this.value); });
    safeAddListener('fSearch', 'input', renderTable);
    safeAddListener('selectAllCb', 'change', function() { toggleSelectAll(this); });

    document.querySelectorAll('.tab-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { switchTab(parseInt(btn.dataset.tab)); });
    });
    const uploadZone = document.getElementById('uploadZone');
    uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
    uploadZone.addEventListener('drop', e => {
      e.preventDefault();
      uploadZone.classList.remove('drag-over');
      handleFileSelect(e);
    });
    if (localStorage.getItem(STORAGE_KEY)) {
      document.getElementById('uploadZoneText').innerHTML += `<br><small style="color:#15803d">💡 Ada data tersimpan — klik "Load from Browser"</small>`;
    }
    const oldKey = 'albionGuildTreasuryV61';
    if (!localStorage.getItem(STORAGE_KEY) && localStorage.getItem(oldKey)) {
      try {
        const oldData = JSON.parse(localStorage.getItem(oldKey));
        rows = (oldData.rows || []).map(function(r) {
          if (!r.playerLc) r.playerLc = (r.player || '').toLowerCase();
          if (!r.reasonLc) r.reasonLc = (r.reason || '').toLowerCase();
          return r;
        });
        document.getElementById('initBal').value = oldData.initBal || 0;
        saveToStorage();
        localStorage.removeItem(oldKey);
      } catch(e) {
        console.warn('Legacy data corrupt, skipping migration');
        localStorage.removeItem(oldKey);
      }
    }

    refreshAll();
    registerPWA();
  } catch(err) {
    console.error('App init error:', err);
    document.body.innerHTML = '<div style="text-align:center;margin-top:100px;font-size:18px;color:#dc2626">❌ App gagal dimuat. Buka Console (F12) untuk detail error.</div>';
  }
};

// ==================== PWA ====================
var deferredPrompt = null;
var swRegistration = null;

function registerPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(function(reg) {
      swRegistration = reg;
      reg.addEventListener('updatefound', function() {
        var newWorker = reg.installing;
        newWorker.addEventListener('statechange', function() {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });
    }).catch(function(err) {
      console.warn('PWA: SW registration failed:', err);
    });
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    var banner = document.getElementById('pwaBanner');
    var installBtn = document.getElementById('pwaInstallBtn');
    var updateBtn = document.getElementById('pwaUpdateBtn');
    document.getElementById('pwaBannerText').textContent = '📲 Install aplikasi untuk akses offline';
    installBtn.style.display = 'inline-block';
    updateBtn.style.display = 'none';
    banner.classList.add('visible');
    installBtn.onclick = function() {
      banner.classList.remove('visible');
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(result) {
        if (result.outcome === 'accepted') {
          showToast('✅ Aplikasi berhasil diinstall!', 3000);
        }
        deferredPrompt = null;
      });
    };
  });

  if (window.matchMedia('(display-mode: standalone)').matches) {
    // PWA running as installed app
  }
}

function showUpdateBanner() {
  var banner = document.getElementById('pwaBanner');
  var installBtn = document.getElementById('pwaInstallBtn');
  var updateBtn = document.getElementById('pwaUpdateBtn');
  document.getElementById('pwaBannerText').textContent = '🔄 Update baru tersedia — refresh untuk update';
  installBtn.style.display = 'none';
  updateBtn.style.display = 'inline-block';
  banner.classList.add('visible');
  updateBtn.onclick = function() {
    if (swRegistration && swRegistration.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };
  setTimeout(function() { banner.classList.remove('visible'); }, 15000);
}

  // Warn before leaving if there's unsaved data
  window.addEventListener('beforeunload', function(e) {
    if (rows.length > 0) {
      e.preventDefault();
      e.returnValue = 'Ada ' + rows.length + ' transaksi yang belum di-export. Yakin ingin keluar?';
    }
  });

  // ==================== EXPOSE TO WINDOW ====================
  window.getFilteredRows = getFilteredRows;
  window.recalc = recalc;
  window.renderMonthly = renderMonthly;
  window.renderPeriod = renderPeriod;
  window.saveToStorage = saveToStorage;
  window.toggleDarkMode = toggleDarkMode;
  window.logout = logout;
  window.loadFromStorage = loadFromStorage;
  window.saveJSONBackup = saveJSONBackup;
  window.handleFileSelect = handleFileSelect;
  window.parseLog = parseLog;
  window.renderTable = renderTable;
  window.deleteTransaction = deleteTransaction;
  window.undoDelete = undoDelete;
  window.editTransaction = editTransaction;
  window.saveEdit = saveEdit;
  window.closeModal = closeModal;
  window.openAddModal = openAddModal;
  window.closeAddModal = closeAddModal;
  window.saveAdd = saveAdd;
  window.sortTable = sortTable;
  window.autoDownloadExcel = autoDownloadExcel;
  window.exportCSV = exportCSV;
  window.exportPDF = exportPDF;
  window.switchTab = switchTab;
  window.toggleSelect = toggleSelect;
  window.toggleSelectAll = toggleSelectAll;
  window.selectAllVisible = selectAllVisible;
  window.clearSelection = clearSelection;
  window.openBulkModal = openBulkModal;
  window.closeBulkModal = closeBulkModal;
  window.confirmBulkDelete = confirmBulkDelete;
  window.resetAll = resetAll;
  window.closeResetModal = closeResetModal;
  window.confirmReset = confirmReset;
  window.hideToast = hideToast;
  window.showToast = showToast;
  window.downloadJSON = downloadJSON;
  window.getColorClass = getColorClass;
  window.renderPagination = renderPagination;
  window.goPage = goPage;
  window.changeRPP = changeRPP;
  window.applySort = applySort;
  window.mergeDuplicates = mergeDuplicates;
  window.renderChart = renderChart;
  window.quickEditTag = quickEditTag;
})();
