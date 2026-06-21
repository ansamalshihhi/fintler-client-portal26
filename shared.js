// ═══════════════════════════════════════════════════════
// FINTLER PORTAL — SHARED DATA LAYER
// Both portal.js and client.js depend on this file.
// ═══════════════════════════════════════════════════════

const DB_KEY = 'fintler_clients_v1';

// ── Storage ──────────────────────────────────────────
function saveClients(clients) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(clients)); } catch(e) {}
}
function loadClients() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return [];
}

// ── Utilities ─────────────────────────────────────────
function nowStr() {
  return new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtAmt(n) {
  if (typeof n !== 'number') return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function genId() { return Date.now() + Math.floor(Math.random() * 1000); }

function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

// ── Password hashing (simple, no server needed) ───────
async function hashPassword(pw) {
  const enc = new TextEncoder().encode(pw + '_fintler_salt_2025');
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function verifyPassword(pw, hash) {
  const h = await hashPassword(pw);
  return h === hash;
}

// ── Client slug (used in URL) ──────────────────────────
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ── Document type suggestions ─────────────────────────
const DOC_SUGG = {
  'Bank statement': [
    { name: 'Bank statement – Month 1', format: 'Scanned PDF' },
    { name: 'Bank statement – Month 2', format: 'Scanned PDF' },
    { name: 'Bank statement – Month 3', format: 'Scanned PDF' },
  ],
  'VAT return': [
    { name: 'Sales invoices (full period)', format: 'Excel / CSV' },
    { name: 'Purchase invoices (full period)', format: 'Excel / CSV' },
    { name: 'Previous VAT return copy', format: 'Scanned PDF' },
    { name: 'VAT registration certificate', format: 'Scanned PDF' },
  ],
  'Payroll record': [
    { name: 'Payroll summary sheet', format: 'Excel / CSV' },
    { name: 'Employee list with salaries', format: 'Excel / CSV' },
    { name: 'PASI / social insurance confirmation', format: 'Scanned PDF' },
  ],
  'Sales invoices': [
    { name: 'Sales invoice register', format: 'Excel / CSV' },
    { name: 'Customer statements', format: 'Scanned PDF' },
    { name: 'Credit notes (if any)', format: 'Scanned PDF' },
  ],
  'Purchase invoices': [
    { name: 'Supplier invoices', format: 'Scanned PDF' },
    { name: 'Payment receipts', format: 'Scanned PDF' },
    { name: 'Petty cash vouchers', format: 'Scanned PDF' },
  ],
  'Trial balance': [
    { name: 'Opening trial balance', format: 'Excel / CSV' },
    { name: 'Closing trial balance', format: 'Excel / CSV' },
    { name: 'Supporting schedules', format: 'Excel / CSV' },
  ],
  'Financial statements': [
    { name: 'Signed financial statements', format: 'Scanned PDF' },
    { name: 'Board approval letter', format: 'Scanned PDF' },
    { name: 'Prior year comparatives', format: 'Excel / CSV' },
  ],
};

function mkItem(id, name, format, addedBy) {
  return { id, name, format, status: 'pending', notes: [], fintlerRemark: '', addedBy };
}
