// ═══════════════════════════════════════════════════════
// FINTLER PORTAL — ADMIN v4 (Supabase connected)
// ═══════════════════════════════════════════════════════

const ADMIN_PASSWORDS = ['FintlerAdmin2025'];
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
        ${over?'<span class="badge b-overdue" style="font-size:10px">Late</span>':''}
      </div>
      <div class="cli-sub">${c.doc_type||''}${c.period?' · '+c.period:''}</div>
      <div class="progress-bar"><div class="progress-fill" style="background:#1B38DB;width:0%"></div></div>
      <div style="font-size:10px;color:var(--gray-400);margin-top:4px">Click to load</div>
    </div>`;
  }).join('');
}

function renderDetail() {
  const c = activeClientData; if(!c) return;
  const docs = activeDocs;
  const done = docs.filter(i=>i.status==='received').length;
  const total = docs.length;
  const pct = total?Math.round(done/total*100):0;
  const pending = docs.filter(i=>i.status==='pending').length;
  const inReview = docs.filter(i=>i.status==='review').length;
  const dl = c.deadline?new Date(c.deadline).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}):'No deadline';
  const over = c.deadline&&new Date(c.deadline)<new Date()&&done<total;

  document.getElementById('main-detail').innerHTML = `
    <div class="card">
      <div class="flex-between" style="margin-bottom:14px">
        <div>
          <div style="font-size:17px;font-weight:600;color:#1B38DB">${c.name}</div>
          <div style="font-size:12px;color:var(--gray-400);margin-top:3px">${c.doc_type||''}${c.period?' · '+c.period:''}${c.email?' · '+c.email:''}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-ghost btn-sm" onclick="openEditModal(${c.id})">✏️ Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="openShareModal()">↗ Share</button>
          <button class="btn btn-sm" style="background:var(--red-50);color:var(--red-600);border:1px solid var(--red-100)" onclick="deleteClient(${c.id})">🗑 Delete</button>
          <span class="badge ${over?'b-overdue':done===total&&total>0?'b-received':'b-pending'}">${over?'Overdue':done===total&&total>0?'Complete':'In progress'}</span>
        </div>
      </div>
      <div class="client-stats">
        <div class="cstat"><div class="cstat-num" style="color:var(--amber-600)">${pending}</div><div class="cstat-lbl">Pending</div></div>
        <div class="cstat"><div class="cstat-num" style="color:#1B38DB">${inReview}</div><div class="cstat-lbl">Under review</div></div>
        <div class="cstat"><div class="cstat-num" style="color:var(--green-600)">${done}</div><div class="cstat-lbl">Received</div></div>
        <div class="cstat"><div class="cstat-num">${total}</div><div class="cstat-lbl">Total</div></div>
      </div>
      <div class="flex-between" style="font-size:12px;color:var(--gray-400);margin-bottom:7px">
        <span>Deadline: <b style="color:var(--gray-600)">${dl}</b></span>
        <span>${pct}% complete</span>
      </div>
      <div class="progress-bar" style="height:7px"><div class="progress-fill" style="width:${pct}%;background:${pct===100?'var(--green-600)':'#1B38DB'}"></div></div>
      <div class="pw-box">
        <span style="font-size:12px;color:#1B38DB"><b>Client password:</b> <span style="font-family:var(--mono);font-size:14px">${c.password_plain}</span></span>
        <button class="btn btn-ghost btn-xs" onclick="navigator.clipboard.writeText('${c.password_plain}').then(()=>toast('Copied'))">Copy</button>
      </div>
    </div>
    <div class="inner-tabs">
      <button class="inner-tab active" onclick="innerTab('documents',this)">Documents <span class="tab-chip">${total}</span></button>
      <button class="inner-tab" onclick="innerTab('remarks',this)">Internal remarks</button>
    </div>
    <div id="itab-documents">${renderDocTab(docs)}</div>
    <div id="itab-remarks" class="hidden"><div class="card"><div class="card-title">Loading remarks...</div></div></div>
  `;
  loadRemarks();
}

function innerTab(name,btn){
  ['documents','remarks'].forEach(t=>{const el=document.getElementById('itab-'+t);if(el)el.classList.add('hidden');});
  document.querySelectorAll('.inner-tab').forEach(b=>b.classList.remove('active'));
  document.getElementById('itab-'+name).classList.remove('hidden');
  btn.classList.add('active');
  if(name==='remarks') loadRemarks();
}

async function loadRemarks() {
  const el = document.getElementById('itab-remarks'); if(!el||!activeId) return;
  const remarks = await dbGetRemarks(activeId);
  el.innerHTML = `<div class="card">
    <div class="card-title">Internal remarks <span style="color:var(--gray-300)">(not visible to client)</span></div>
    ${!remarks.length?'<p style="font-size:12px;color:var(--gray-400);margin-bottom:12px">No remarks yet.</p>':
      remarks.map(r=>`<div class="note-entry${r.is_edit?'" style="background:#E8ECFD;border-left:3px solid #1B38DB':''}">
        <div class="note-author" style="${r.is_edit?'color:#1B38DB':''}">${r.is_edit?'✏️ Edit log':'Fintler team'}</div>
        <div class="note-text">${r.text}</div>
        <div class="note-time">${r.time}</div>
      </div>`).join('')}
    <hr class="divider"/>
    <div class="add-row">
      <input type="text" id="remark-inp" placeholder="Add internal remark..." style="flex:1" onkeydown="if(event.key==='Enter')addRemark()"/>
      <button class="btn btn-fintler btn-sm" onclick="addRemark()">Save</button>
    </div>
  </div>`;
}

async function addRemark() {
  const inp = document.getElementById('remark-inp'); if(!inp||!inp.value.trim()) return;
  await dbAddRemark(activeId, inp.value.trim(), false);
  await dbLogActivity(activeId, activeClientData?.name||'', 'Internal remark added', 'Admin', inp.value.trim().substring(0,60));
  inp.value=''; loadRemarks(); renderFeed(activeId); toast('Saved');
}

function renderDocTab(docs) {
  const pending = docs.filter(i=>i.status!=='received');
  const received = docs.filter(i=>i.status==='received');
  return `
    <div class="section-head">
      <div class="section-lbl" style="margin-bottom:0">Checklist</div>
      <button class="btn btn-ghost btn-sm" onclick="openItemModal()">+ Add item</button>
    </div>
    ${!docs.length?'<div class="empty">No items yet.</div>':''}
    ${pending.length?`<div style="font-size:11px;font-weight:600;color:var(--amber-600);margin-bottom:8px">PENDING (${pending.length})</div>`:''}
    ${pending.map(item=>docItemHTML(item)).join('')}
    ${received.length?`<div style="font-size:11px;font-weight:600;color:var(--green-600);margin:14px 0 8px">RECEIVED (${received.length})</div>`:''}
    ${received.map(item=>docItemHTML(item)).join('')}
  `;
}

function docItemHTML(item) {
  const isPending = item.status !== 'received';
  return `<div class="doc-item" id="di-${item.id}">
    <div style="display:flex;align-items:flex-start;gap:10px">
      <div class="doc-check${item.status==='received'?' received':''}" onclick="toggleStatus(${item.id})"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500;text-decoration:${item.status==='received'?'line-through':'none'};color:${item.status==='received'?'var(--gray-400)':'var(--gray-800)'}">
          ${item.name}
        </div>
        <div style="margin-top:5px;display:flex;gap:5px;flex-wrap:wrap">
          ${item.format?`<span class="tag">${item.format}</span>`:''}
          <span class="badge ${item.status==='received'?'b-received':item.status==='review'?'b-review':'b-pending'}">${item.status}</span>
          ${item.addedBy==='client'?'<span class="badge b-client">Client added</span>':''}
        </div>
        ${item.fileUrl?`<a href="${item.fileUrl}" target="_blank" class="file-attached">📎 ${item.fileName||'View file'}</a>`:''}
        ${isPending ? `
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-sm" style="background:#E8ECFD;color:#1B38DB;border:1px solid #C5CCEF;font-size:11px;padding:4px 10px" onclick="sendRequestEmail(${item.id})">
              📧 Request from client
            </button>
            <button class="btn btn-sm" style="background:#FFF8E6;color:#8A6200;border:1px solid #F5D78B;font-size:11px;padding:4px 10px" onclick="sendReminderEmail(${item.id})">
              ⏰ Send reminder
            </button>
          </div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <select onchange="changeStatus(${item.id},this.value)" style="width:120px;font-size:11px;padding:5px 7px">
          ${['pending','received','review','rejected'].map(s=>`<option value="${s}"${item.status===s?' selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
        </select>
        <button class="btn-icon" onclick="removeItem(${item.id})">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
        </button>
      </div>
    </div>
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--gray-100)">
      ${(item.notes||[]).map(n=>`<div class="note-entry"><div class="note-author">${n.author}</div><div class="note-text">${n.text}</div><div class="note-time">${n.time}</div></div>`).join('')}
      <div class="add-row">
        <input type="text" id="note-${item.id}" placeholder="Add note..." style="flex:1;font-size:12px" onkeydown="if(event.key==='Enter')addNote(${item.id})"/>
        <button class="btn btn-ghost btn-sm" onclick="addNote(${item.id})">Note</button>
      </div>
    </div>
  </div>`;
}

async function sendRequestEmail(docId) {
  const item = activeDocs.find(i=>i.id===docId); if(!item||!activeClientData) return;
  const c = activeClientData;
  if (!c.email) { toast('No email address for this client — add one in Edit'); return; }
  const btn = event.target; btn.textContent = 'Sending...'; btn.disabled = true;
  const ok = await sendDocumentEmail({
    clientName: c.name, clientEmail: c.email, documentName: item.name,
    period: c.period||'', portalUrl: getClientPortalUrl(c), password: c.password_plain, isReminder: false,
  });
  if (ok) {
    await dbLogActivity(activeId, c.name, `Document request email sent: "${item.name}"`, 'Admin', c.email);
    await dbAddNote(docId, activeId, 'Admin', `📧 Request email sent to ${c.email}`);
    activeDocs = await dbGetDocuments(activeId); renderDetail(); renderFeed(activeId);
    toast('Email sent to ' + c.email + ' ✅');
  } else { btn.textContent = '📧 Request from client'; btn.disabled = false; toast('Failed to send email'); }
}

async function sendReminderEmail(docId) {
  const item = activeDocs.find(i=>i.id===docId); if(!item||!activeClientData) return;
  const c = activeClientData;
  if (!c.email) { toast('No email address for this client — add one in Edit'); return; }
  const btn = event.target; btn.textContent = 'Sending...'; btn.disabled = true;
  const ok = await sendDocumentEmail({
    clientName: c.name, clientEmail: c.email, documentName: item.name,
    period: c.period||'', portalUrl: getClientPortalUrl(c), password: c.password_plain, isReminder: true,
  });
  if (ok) {
    await dbLogActivity(activeId, c.name, `Reminder email sent: "${item.name}"`, 'Admin', c.email);
    await dbAddNote(docId, activeId, 'Admin', `⏰ Reminder email sent to ${c.email}`);
    activeDocs = await dbGetDocuments(activeId); renderDetail(); renderFeed(activeId);
    toast('Reminder sent to ' + c.email + ' ✅');
  } else { btn.textContent = '⏰ Send reminder'; btn.disabled = false; toast('Failed to send email'); }
}

function openItemModal(){openModal('item-modal');document.getElementById('im-name').value='';document.getElementById('im-note').value='';}

async function addDocItem() {
  const name=document.getElementById('im-name').value.trim();
  const format=document.getElementById('im-format').value;
  const note=document.getElementById('im-note').value.trim();
  if(!name){toast('Enter document name');return;}
  const doc = await dbSaveDocument(activeId,{name,format,status:'pending',addedBy:'fintler'},true);
  if(doc&&note) await dbAddNote(doc.id, activeId, 'Admin', note);
  await dbLogActivity(activeId,activeClientData?.name||'','Item added to checklist','Admin',name);
  activeDocs = await dbGetDocuments(activeId);
  closeModal('item-modal');renderDetail();renderFeed(activeId);renderStatusChips();toast('Item added');
}

async function toggleStatus(iid) {
  const item=activeDocs.find(i=>i.id===iid);if(!item)return;
  const prev=item.status;
  item.status=item.status==='received'?'pending':'received';
  await dbSaveDocument(activeId,item,false);
  await dbLogActivity(activeId,activeClientData?.name||'',`"${item.name}" marked as ${item.status}`,'Admin',`Previous: ${prev}`);
  activeDocs=await dbGetDocuments(activeId);renderDetail();renderFeed(activeId);renderStatusChips();
}

async function changeStatus(iid,val) {
  const item=activeDocs.find(i=>i.id===iid);if(!item)return;
  const prev=item.status;item.status=val;
  await dbSaveDocument(activeId,item,false);
  await dbLogActivity(activeId,activeClientData?.name||'',`"${item.name}" status → ${val}`,'Admin',`Previous: ${prev}`);
  activeDocs=await dbGetDocuments(activeId);renderDetail();renderFeed(activeId);renderStatusChips();
}

async function removeItem(iid) {
  const item=activeDocs.find(i=>i.id===iid);
  if(item){await dbDeleteDocument(iid);await dbLogActivity(activeId,activeClientData?.name||'','Item removed','Admin',`"${item.name}"`);}
  activeDocs=await dbGetDocuments(activeId);renderDetail();renderFeed(activeId);renderStatusChips();
}

async function addNote(iid) {
  const inp=document.getElementById('note-'+iid);if(!inp||!inp.value.trim())return;
  const item=activeDocs.find(i=>i.id===iid);if(!item)return;
  await dbAddNote(iid,activeId,'Admin',inp.value.trim());
  await dbLogActivity(activeId,activeClientData?.name||'',`Note added on "${item.name}"`,'Admin',inp.value.trim().substring(0,60));
  inp.value='';activeDocs=await dbGetDocuments(activeId);renderDetail();renderFeed(activeId);
}

function openShareModal() {
  const c=activeClientData;if(!c)return;
  const clientURL=getClientPortalUrl(c);
  dbLogActivity(c.id,c.name,'Client link shared','Admin','');
  renderFeed(activeId);
  document.getElementById('share-content').innerHTML=`
    <p style="font-size:13px;color:var(--gray-600);margin-bottom:18px">Send <b>${c.name}</b> the link and password below.</p>
    <div style="margin-bottom:6px;font-size:12px;font-weight:500;color:var(--gray-600)">Client portal link</div>
    <div class="share-link-box">${clientURL}</div>
    <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText('${clientURL}').then(()=>toast('Link copied'))" style="margin-bottom:16px">Copy link</button>
    <div style="margin-bottom:6px;font-size:12px;font-weight:500;color:var(--gray-600)">Access password</div>
    <div class="share-pw-box">
      <span style="font-size:18px;font-weight:600;font-family:var(--mono);color:var(--gray-800)">${c.password_plain}</span>
      <button class="btn btn-ghost btn-xs" onclick="navigator.clipboard.writeText('${c.password_plain}').then(()=>toast('Password copied'))">Copy</button>
    </div>
    <div style="background:var(--gray-50);border-radius:var(--r-md);padding:16px">
      <div style="font-size:12px;font-weight:600;color:var(--gray-600);margin-bottom:10px">Suggested message</div>
      <div style="font-size:13px;color:var(--gray-600);line-height:1.7" id="share-msg-text">Dear ${c.name},<br><br>Please find below your document submission link for ${c.period||'the current period'}.<br><br><b>Portal link:</b> ${clientURL}<br><b>Password:</b> ${c.password_plain}<br><br>If you have any questions, please contact us at ansam@fintler.com or info@fintler.com.<br><br>Best regards,<br>Fintler Financial Consultancy</div>
      <button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="navigator.clipboard.writeText(document.getElementById('share-msg-text').innerText).then(()=>toast('Message copied'))">Copy message</button>
    </div>
  `;
  openModal('share-modal');
}
