// ═══════════════════════════════════════════════════════
// FINTLER PORTAL — CLIENT SIDE (client.js)
// ═══════════════════════════════════════════════════════

let activeClient = null;

// ── On load: check URL for ref param ──────────────────
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) {
    // Pre-fill slug hint; user still needs the password
    const inp = document.getElementById('pw-input');
    if (inp) inp.placeholder = 'Enter your Fintler password';
    // Store ref for use after login
    window._clientRef = ref;
  }
  // Auto-focus password input
  const pw = document.getElementById('pw-input');
  if (pw) pw.focus();
});

// ── Login ──────────────────────────────────────────────
async function tryLogin() {
  const pw = document.getElementById('pw-input').value.trim();
  const errorEl = document.getElementById('login-error');
  const btn = document.querySelector('.login-card .btn-primary');
  if (!pw) { showError('Please enter your password.'); return; }

  btn.textContent = 'Checking...';
  btn.disabled = true;

  const clients = loadClients();
  const ref = window._clientRef || null;

  // Try to match by slug (from URL) + password, or just password alone
  let matched = null;
  for (const c of clients) {
    const ok = await verifyPassword(pw, c.passwordHash);
    if (ok) {
      if (!ref || c.slug === ref) { matched = c; break; }
      if (!matched) matched = c; // fallback: password match without ref
    }
  }

  btn.textContent = 'Access my checklist';
  btn.disabled = false;

  if (!matched) {
    showError('Incorrect password. Please check with Fintler.');
    return;
  }

  activeClient = matched;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('client-portal').classList.remove('hidden');
  document.getElementById('client-nav-info').classList.remove('hidden');
  document.getElementById('client-name-badge').textContent = matched.name;
  renderClientPortal();
}

function showError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  document.getElementById('pw-input').value = '';
  document.getElementById('pw-input').focus();
}

// ── Render client portal ───────────────────────────────
function renderClientPortal() {
  const c = activeClient;
  const done = c.items.filter(i => i.status === 'received').length;
  const total = c.items.length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const dl = c.deadline
    ? new Date(c.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'To be confirmed';
  const isOverdue = c.deadline && new Date(c.deadline) < new Date() && done < total;

  // Hero
  document.getElementById('client-hero').innerHTML = `
    <h2>${c.name}</h2>
    <p>${c.docType} submission${c.period ? ' — ' + c.period : ''}</p>
    <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
      <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.15);border-radius:20px;padding:5px 13px;font-size:12px;font-weight:500">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Deadline: ${dl}
      </div>
      ${isOverdue ? '<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,100,100,.25);border-radius:20px;padding:5px 13px;font-size:12px;font-weight:500">⚠ Deadline passed — please submit as soon as possible</div>' : ''}
    </div>
  `;

  // Progress stats
  document.getElementById('progress-stats').innerHTML = `
    <div class="ps-card">
      <div class="ps-num" style="${pct === 100 ? 'color:var(--green-600)' : ''}">${pct}%</div>
      <div class="ps-lbl">Complete</div>
      <div class="progress-bar" style="margin-top:8px">
        <div class="progress-fill${pct === 100 ? ' complete' : ''}" style="width:${pct}%"></div>
      </div>
    </div>
    <div class="ps-card">
      <div class="ps-num" style="color:var(--amber-600)">${total - done}</div>
      <div class="ps-lbl">Still needed</div>
    </div>
    <div class="ps-card">
      <div class="ps-num" style="color:var(--green-600)">${done}</div>
      <div class="ps-lbl">Submitted</div>
    </div>
  `;

  // Checklist
  const pending = c.items.filter(i => i.status !== 'received');
  const received = c.items.filter(i => i.status === 'received');
  document.getElementById('checklist-items').innerHTML = `
    ${!c.items.length ? '<div class="empty">No items on your checklist yet. Fintler will update this shortly.</div>' : ''}
    ${pending.length ? `<div style="font-size:11px;font-weight:600;color:var(--amber-600);margin-bottom:10px;text-transform:uppercase;letter-spacing:.07em">Pending (${pending.length})</div>` : ''}
    ${pending.map(item => clientDocHTML(item)).join('')}
    ${received.length ? `<div style="font-size:11px;font-weight:600;color:var(--green-600);margin:16px 0 10px;text-transform:uppercase;letter-spacing:.07em">Submitted (${received.length})</div>` : ''}
    ${received.map(item => clientDocHTML(item)).join('')}
  `;
}

function clientDocHTML(item) {
  return `<div class="client-doc${item.status === 'received' ? ' done' : ''}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div style="flex:1">
        <div style="font-size:14px;font-weight:500;text-decoration:${item.status === 'received' ? 'line-through' : 'none'};color:${item.status === 'received' ? 'var(--gray-400)' : 'var(--gray-800)'}">
          ${item.name}
        </div>
        ${item.format ? `<div style="font-size:12px;color:var(--gray-400);margin-top:4px">Format requested: <span class="tag">${item.format}</span></div>` : ''}
        ${item.status === 'review' ? '<div style="font-size:12px;color:var(--blue-600);margin-top:5px;font-weight:500">Under review by Fintler</div>' : ''}
        ${item.status === 'rejected' ? '<div style="font-size:12px;color:var(--red-600);margin-top:5px;font-weight:500">Please re-submit — Fintler has a question about this item</div>' : ''}
      </div>
      <span class="badge ${item.status === 'received' ? 'b-received' : item.status === 'review' ? 'b-review' : item.status === 'rejected' ? 'b-overdue' : 'b-pending'}">
        ${item.status === 'received' ? 'Submitted' : item.status === 'review' ? 'Under review' : item.status === 'rejected' ? 'Re-submit' : 'Pending'}
      </span>
    </div>
    ${item.status !== 'received' && item.status !== 'review' ? `
      <button class="client-upload-btn" onclick="markSubmitted(${item.id})">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Mark as submitted / confirm you've sent this
      </button>` : ''}
    ${item.status === 'received' ? '<div style="font-size:12px;color:var(--green-600);margin-top:10px;font-weight:500;display:flex;align-items:center;gap:5px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Received — Fintler is reviewing</div>' : ''}
  </div>`;
}

function markSubmitted(iid) {
  const c = activeClient;
  if (!c) return;
  const item = c.items.find(i => i.id === iid);
  if (!item) return;
  item.status = 'received';
  item.notes.push({ author: 'Client', text: 'Marked as submitted by client via portal', time: nowStr() });

  // Sync back to shared storage so Fintler sees it
  const clients = loadClients();
  const idx = clients.findIndex(x => x.id === c.id);
  if (idx !== -1) { clients[idx] = c; saveClients(clients); }

  renderClientPortal();
  toast('Marked as submitted — Fintler will be notified');
}

function clientAddItem() {
  const inp = document.getElementById('client-add-inp');
  if (!inp || !inp.value.trim()) { toast('Please enter a document name'); return; }
  const c = activeClient;
  if (!c) return;
  const item = mkItem(genId(), inp.value.trim(), '', 'client');
  item.notes.push({ author: 'Client', text: 'Added by client via portal', time: nowStr() });
  c.items.push(item);

  // Sync to storage
  const clients = loadClients();
  const idx = clients.findIndex(x => x.id === c.id);
  if (idx !== -1) { clients[idx] = c; saveClients(clients); }

  inp.value = '';
  renderClientPortal();
  toast('Document added — Fintler has been notified');
}

// Allow Enter key on password field
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && document.getElementById('login-screen') && !document.getElementById('login-screen').classList.contains('hidden')) {
    tryLogin();
  }
});
