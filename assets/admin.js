// ═══════════════════════════════════════════════════════
// FINTLER PORTAL — ADMIN v4 (Supabase connected)
// ═══════════════════════════════════════════════════════

const ADMIN_PASSWORDS = ['FintlerAdmin2025', 'AliAdmin2025'];
let clients = [];
let activeId = null;
let activeClientData = null;
let activeDocs = [];
let selDocType = '';
let dragSrcId = null;

const SUPABASE_FUNCTIONS_URL = 'https://hhxdosdevqmfgdofxxxc.supabase.co/functions/v1';

async function sendDocumentEmail({ clientName, clientEmail, documentName, period, portalUrl, password, isReminder }) {
  if (!clientEmail) { toast('No email set for this client'); return false; }
  try {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/send-document-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ clientName, clientEmail, documentName, period, portalUrl, password, isReminder }),
    });
    const data = await res.json();
    return data.success;
  } catch (err) { console.error('Email send failed:', err); return false; }
}

function getClientPortalUrl(c) {
  return `https://ansamalshihhi.github.io/fintler-client-portal26/client/?ref=${encodeURIComponent(c.slug)}`;
}

async function adminLogin() {
  const pw = document.getElementById('admin-pw').value.trim();
  if (!pw) return;
  if (!ADMIN_PASSWORDS.includes(pw)) {
    document.getElementById('admin-error').classList.remove('hidden');
    document.getElementById('admin-pw').value = '';
    return;
  }
  document.getElementById('admin-login').classList.add('hidden');
  document.getElementById('admin-panel').classList.remove('hidden');
  toast('Loading...');
  await seedDemoIfEmpty();
  clients = await dbGetClients();
  renderClientList();
  renderFeed();
  renderStatusChips();
  initNotificationBell('admin');
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function selType(btn, val) {
  document.querySelectorAll('#m-type-grid .type-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected'); selDocType = val;
  document.getElementById('m-other-row').classList.toggle('hidden', val !== 'Other');
}
function genPassword() {
  const words = ['Alpha','Beta','Gamma','Delta','Sigma','Zeta','Nova','Apex','Orion','Vega'];
  document.getElementById('m-password').value = words[Math.floor(Math.random()*words.length)] + Math.floor(1000+Math.random()*9000);
}

async function renderFeed(filterClientId) {
  const el = document.getElementById('feed-scroll'); if (!el) return;
  el.innerHTML = '<div class="feed-empty">Loading...</div>';
  const entries = filterClientId ? await dbGetActivityLog(filterClientId) : await dbGetAllActivity();
  if (!entries.length) { el.innerHTML = '<div class="feed-empty">No activity yet.</div>'; return; }
  el.innerHTML = entries.map(e => `
    <div class="feed-entry by-${e.by}">
      <div class="feed-who">${e.by}</div>
      <div class="feed-action">${e.action}</div>
      ${e.detail?`<div class="feed-detail">${e.detail}</div>`:''}
      ${!filterClientId&&e.client_name?`<div class="feed-detail" style="color:#1B38DB;font-weight:500">${e.client_name}</div>`:''}
      <div class="feed-time">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${e.timestamp}
      </div>
    </div>`).join('');
}

async function renderStatusChips() {
  const el = document.getElementById('status-chips'); if (!el) return;
  if (!clients.length) { el.innerHTML = '<span style="font-size:11px;color:#C0BEB9">No clients yet</span>'; return; }
  let html = '';
  for (const c of clients) {
    const docs = await dbGetDocuments(c.id);
    const pending = docs.filter(d => d.status === 'pending').length;
    const total = docs.length;
    const done = docs.filter(d => d.status === 'received').length;
    const over = c.deadline && new Date(c.deadline) < new Date() && pending > 0;
    const pct = total ? Math.round(done/total*100) : 0;
    if (over) html += `<div class="status-chip chip-overdue" onclick="selectClient(${c.id})">⚠ ${c.name} — ${pending} pending · overdue</div>`;
    else if (pending > 0) html += `<div class="status-chip chip-inprog" onclick="selectClient(${c.id})">📋 ${c.name} — ${pct}% · ${done}/${total}</div>`;
    else if (total > 0) html += `<div class="status-chip chip-complete">✅ ${c.name} — complete</div>`;
  }
  el.innerHTML = html || '<span style="font-size:11px;color:#C0BEB9">All clear</span>';
}

async function createClient() {
  const name = document.getElementById('m-client').value.trim();
  const email = document.getElementById('m-email').value.trim();
  const period = document.getElementById('m-period').value.trim();
  const deadline = document.getElementById('m-deadline').value;
  const pw = document.getElementById('m-password').value.trim();
  const docType = selDocType==='Other' ? document.getElementById('m-other').value.trim() : selDocType;
  if (!name) { toast('Enter client name'); return; }
  if (!docType) { toast('Select a document type'); return; }
  if (!pw) { toast('Set a portal password'); return; }
  const pwHash = await hashPassword(pw);
  const c = await dbSaveClient({ name, email, period, docType, deadline, slug:slugify(name), passwordHash:pwHash, passwordPlain:pw }, true);
  if (!c) { toast('Error creating client'); return; }
  const sugg = DOC_SUGG[selDocType] || [];
  for (const s of sugg) { await dbSaveDocument(c.id, { name:s.name, format:s.format, status:'pending', addedBy:'fintler' }, true); }
  await dbLogActivity(c.id, c.name, 'Engagement created', 'Admin', `${docType} · ${period}`);
  clients = await dbGetClients();
  closeModal('add-modal'); resetAddForm();
  renderClientList(); selectClient(c.id); renderFeed(); renderStatusChips();
  toast('Engagement created for ' + name);
}

function resetAddForm() {
  ['m-client','m-email','m-period','m-deadline','m-other','m-password'].forEach(id=>document.getElementById(id).value='');
  document.querySelectorAll('#m-type-grid .type-btn').forEach(b=>b.classList.remove('selected'));
  document.getElementById('m-other-row').classList.add('hidden');
  selDocType='';
}

function openEditModal(id) {
  const c = clients.find(x=>x.id===id); if(!c) return;
  document.getElementById('edit-modal-title').textContent = 'Edit — ' + c.name;
  document.getElementById('e-name').value = c.name;
  document.getElementById('e-email').value = c.email||'';
  document.getElementById('e-period').value = c.period||'';
  document.getElementById('e-deadline').value = c.deadline||'';
  document.getElementById('e-password').value = '';
  document.getElementById('e-pw-hint').textContent = '(current: ' + c.password_plain + ')';
  openModal('edit-modal');
  document.getElementById('edit-modal').dataset.clientId = id;
}

async function saveEdit() {
  const id = parseInt(document.getElementById('edit-modal').dataset.clientId);
  const c = clients.find(x=>x.id===id); if(!c) return;
  const changes = [];
  const newName = document.getElementById('e-name').value.trim();
  const newEmail = document.getElementById('e-email').value.trim();
  const newPeriod = document.getElementById('e-period').value.trim();
  const newDeadline = document.getElementById('e-deadline').value;
  const newPw = document.getElementById('e-password').value.trim();
  const updated = { ...c, name:c.name, email:c.email, period:c.period, deadline:c.deadline, slug:c.slug, passwordHash:c.password_hash, passwordPlain:c.password_plain };
  if (newName && newName!==c.name) { changes.push(`Name: "${c.name}"→"${newName}"`); updated.name=newName; updated.slug=slugify(newName); }
  if (newEmail!==(c.email||'')) { changes.push('Email updated'); updated.email=newEmail; }
  if (newPeriod!==(c.period||'')) { changes.push(`Period→"${newPeriod}"`); updated.period=newPeriod; }
  if (newDeadline!==(c.deadline||'')) { changes.push(`Deadline→${newDeadline}`); updated.deadline=newDeadline; }
  if (newPw) { updated.passwordHash=await hashPassword(newPw); updated.passwordPlain=newPw; changes.push('Password changed'); }
  await dbSaveClient({ ...updated, id }, false);
  if (changes.length) {
    await dbLogActivity(id, updated.name, 'Engagement edited', 'Admin', changes.join(' | '));
    await dbAddRemark(id, '✏️ Admin edit — '+changes.join(' | '), true);
  }
  clients = await dbGetClients();
  closeModal('edit-modal');
  renderClientList(); if(activeId===id) renderDetail(); renderFeed(activeId||undefined); renderStatusChips();
  toast('Engagement updated');
}

async function deleteClient(id) {
  const c = clients.find(x=>x.id===id); if(!c) return;
  if (!confirm(`Delete engagement for "${c.name}"? This cannot be undone.`)) return;
  await dbDeleteClient(id);
  clients = await dbGetClients();
  if (activeId===id) { activeId=null; activeClientData=null; activeDocs=[]; document.getElementById('main-detail').innerHTML='<div class="empty card" style="padding:60px"><p>Select a client</p></div>'; }
  renderClientList(); renderFeed(); renderStatusChips(); toast('Engagement deleted');
}

async function selectClient(id) {
  activeId = id;
  activeClientData = clients.find(x=>x.id===id);
  renderClientList();
  activeDocs = await dbGetDocuments(id);
  renderDetail();
  renderFeed(id);
}

function renderClientList() {
  const el = document.getElementById('client-list');
  if (!clients.length) { el.innerHTML='<div class="empty" style="padding:20px 10px;font-size:12px">No clients yet.</div>'; return; }
  el.innerHTML = clients.map(c => {
    const over = c.deadline && new Date(c.deadline)<new Date();
    return `<div class="cli-item${c.id===activeId?' active':''}" onclick="selectClient(${c.id})">
      <div class="flex-between">
        <div class="cli-name">${c.name}</div>
