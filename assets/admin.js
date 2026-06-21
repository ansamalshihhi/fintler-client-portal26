// ═══════════════════════════════════════════════════════
// FINTLER PORTAL — ADMIN SIDE v2 (admin.js)
// ═══════════════════════════════════════════════════════

const ADMIN_PASSWORDS = ['FintlerAdmin2025', 'AliAdmin2025'];
let clients = [];
let activeId = null;
let selDocType = '';
let dragSrcId = null;

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
  clients = await seedDemoIfEmpty();
  renderClientList();
  renderStatusPanel();
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

function logActivity(c, action, by, detail) {
  if (!c.activityLog) c.activityLog = [];
  c.activityLog.unshift({ action, by, detail: detail||'', time: nowStr(), ts: Date.now() });
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
  const sugg = DOC_SUGG[selDocType] || [];
  const items = sugg.map((s,i) => mkItem(genId()+i, s.name, s.format, 'fintler'));
  const c = {
    id: genId(), name, email, period, docType, deadline,
    slug: slugify(name), passwordHash: pwHash, passwordPlain: pw,
    items, internalRemarks: [], activityLog: [], analysis: null,
    createdAt: new Date().toISOString(),
  };
  logActivity(c, 'Engagement created', 'Admin', `${docType} · ${period}`);
  clients.push(c);
  saveClients(clients);
  closeModal('add-modal'); resetAddForm();
  renderClientList(); selectClient(c.id); renderStatusPanel();
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
  document.getElementById('e-pw-hint').textContent = '(current: ' + c.passwordPlain + ')';
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
  if (newName && newName!==c.name) { changes.push(`Name: "${c.name}"→"${newName}"`); c.name=newName; c.slug=slugify(newName); }
  if (newEmail!==(c.email||'')) { changes.push('Email updated'); c.email=newEmail; }
  if (newPeriod!==(c.period||'')) { changes.push(`Period: "${c.period||''}"→"${newPeriod}"`); c.period=newPeriod; }
  if (newDeadline!==(c.deadline||'')) { changes.push(`Deadline updated to ${newDeadline}`); c.deadline=newDeadline; }
  if (newPw) { c.passwordHash=await hashPassword(newPw); c.passwordPlain=newPw; changes.push('Password changed'); }
  if (changes.length) {
    logActivity(c, 'Engagement edited', 'Admin', changes.join(' | '));
    c.internalRemarks=c.internalRemarks||[];
    c.internalRemarks.unshift({ text:'✏️ Admin edit — '+changes.join(' | '), time:nowStr(), isEdit:true });
  }
  saveClients(clients); closeModal('edit-modal');
  renderClientList(); if(activeId===id) renderDetail(); renderStatusPanel();
  toast('Engagement updated');
}

function deleteClient(id) {
  const c = clients.find(x=>x.id===id); if(!c) return;
  if (!confirm(`Delete engagement for "${c.name}"? This cannot be undone.`)) return;
  clients = clients.filter(x=>x.id!==id);
  saveClients(clients);
  if (activeId===id) { activeId=null; document.getElementById('main-detail').innerHTML='<div class="empty card" style="padding:60px"><p>Select a client</p></div>'; }
  renderClientList(); renderStatusPanel(); toast('Engagement deleted');
}

function selectClient(id) { activeId=id; renderClientList(); renderDetail(); }

function renderClientList() {
  const el = document.getElementById('client-list');
  if (!clients.length) { el.innerHTML='<div class="empty" style="padding:20px 10px;font-size:12px">No clients yet.</div>'; return; }
  el.innerHTML = clients.map(c => {
    const done=c.items.filter(i=>i.status==='received').length, total=c.items.length;
    const pct=total?Math.round(done/total*100):0;
    const over=c.deadline&&new Date(c.deadline)<new Date()&&done<total;
    const edited=c.internalRemarks&&c.internalRemarks.some(r=>r.isEdit);
    return `<div class="cli-item${c.id===activeId?' active':''}" onclick="selectClient(${c.id})">
      <div class="flex-between">
        <div class="cli-name">${c.name}</div>
        <div style="display:flex;gap:4px">
          ${edited?'<span class="badge" style="font-size:10px;background:#f0edfb;color:#6b3fc7">✏️</span>':''}
          ${over?'<span class="badge b-overdue" style="font-size:10px">Late</span>':''}
        </div>
      </div>
      <div class="cli-sub">${c.docType}${c.period?' · '+c.period:''}</div>
      <div class="progress-bar"><div class="progress-fill${pct===100?' complete':''}" style="width:${pct}%"></div></div>
      <div style="font-size:10px;color:var(--gray-400);margin-top:4px">${done}/${total} received</div>
    </div>`;
  }).join('');
}

function renderStatusPanel() {
  const el = document.getElementById('status-panel-content');
  if (!clients.length) { el.innerHTML='<div class="no-status">No clients yet</div>'; return; }
  const overdue = clients.filter(c => c.deadline && new Date(c.deadline)<new Date() && c.items.some(i=>i.status==='pending'));
  const intrack = clients.filter(c => !overdue.includes(c) && c.items.some(i=>i.status==='pending'));
  const complete = clients.filter(c => c.items.length && c.items.every(i=>i.status==='received'));
  let html = '';
  if (overdue.length) {
    html += `<div class="status-divider">⚠ Overdue (${overdue.length})</div>`;
    html += overdue.map(c => {
      const pending=c.items.filter(i=>i.status!=='received').length;
      const dl=c.deadline?new Date(c.deadline).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'';
      return `<div class="status-item" onclick="selectClient(${c.id})">
        <div class="status-item-name">${c.name}</div>
        <div class="status-item-doc">${c.docType}${c.period?' · '+c.period:''}</div>
        <div><span class="status-item-badge overdue-badge">⚠ ${pending} pending · Due ${dl}</span></div>
      </div>`;
    }).join('');
  }
  if (intrack.length) {
    html += `<div class="status-divider">📋 In progress (${intrack.length})</div>`;
    html += intrack.map(c => {
      const done=c.items.filter(i=>i.status==='received').length, total=c.items.length;
      const pct=total?Math.round(done/total*100):0;
      return `<div class="status-item" onclick="selectClient(${c.id})">
        <div class="status-item-name">${c.name}</div>
        <div class="status-item-doc">${c.docType}${c.period?' · '+c.period:''}</div>
        <div><span class="status-item-badge intrack-badge">${pct}% · ${done}/${total} received</span></div>
      </div>`;
    }).join('');
  }
  if (complete.length) {
    html += `<div class="status-divider">✅ Complete (${complete.length})</div>`;
    html += complete.map(c => `<div class="status-item" onclick="selectClient(${c.id})">
      <div class="status-item-name">${c.name}</div>
      <div class="status-item-doc">${c.docType}${c.period?' · '+c.period:''}</div>
      <div><span class="status-item-badge complete-badge">All documents received</span></div>
    </div>`).join('');
  }
  if (!html) html = '<div class="no-status">No active engagements</div>';
  el.innerHTML = html;
}

function renderDetail() {
  const c = clients.find(x=>x.id===activeId); if(!c) return;
  const done=c.items.filter(i=>i.status==='received').length, total=c.items.length;
  const pct=total?Math.round(done/total*100):0;
  const pending=c.items.filter(i=>i.status==='pending').length;
  const inReview=c.items.filter(i=>i.status==='review').length;
  const dl=c.deadline?new Date(c.deadline).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}):'No deadline';
  const over=c.deadline&&new Date(c.deadline)<new Date()&&done<total;

  document.getElementById('main-detail').innerHTML = `
    <div class="card">
      <div class="flex-between" style="margin-bottom:14px">
        <div>
          <div style="font-size:17px;font-weight:600;color:#0B2E55">${c.name}</div>
          <div style="font-size:12px;color:var(--gray-400);margin-top:3px">${c.docType}${c.period?' · '+c.period:''}${c.email?' · '+c.email:''}</div>
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
        <div class="cstat"><div class="cstat-num" style="color:var(--blue-600)">${inReview}</div><div class="cstat-lbl">Under review</div></div>
        <div class="cstat"><div class="cstat-num" style="color:var(--green-600)">${done}</div><div class="cstat-lbl">Received</div></div>
        <div class="cstat"><div class="cstat-num">${total}</div><div class="cstat-lbl">Total items</div></div>
      </div>
      <div class="flex-between" style="font-size:12px;color:var(--gray-400);margin-bottom:7px">
        <span>Deadline: <b style="color:var(--gray-600)">${dl}</b></span>
        <span>${pct}% complete</span>
      </div>
      <div class="progress-bar" style="height:7px"><div class="progress-fill${pct===100?' complete':''}" style="width:${pct}%;${pct===100?'':'background:#0B2E55'}"></div></div>
      <div class="pw-display">
        <span style="font-size:12px;color:#6b3fc7"><b>Client password:</b> <span style="font-family:var(--mono);font-size:14px;letter-spacing:.05em">${c.passwordPlain}</span></span>
        <button class="btn btn-ghost btn-xs" onclick="navigator.clipboard.writeText('${c.passwordPlain}').then(()=>toast('Password copied'))">Copy</button>
      </div>
    </div>
    <div class="inner-tabs">
      <button class="inner-tab active" onclick="innerTab('documents',this)">Documents <span class="tab-chip">${total}</span></button>
      <button class="inner-tab" onclick="innerTab('activity',this)">Activity log <span class="tab-chip">${(c.activityLog||[]).length}</span></button>
      <button class="inner-tab" onclick="innerTab('remarks',this)">Internal remarks ${c.internalRemarks.length?`<span class="tab-chip">${c.internalRemarks.length}</span>`:''}</button>
    </div>
    <div id="itab-documents">${renderDocTab(c)}</div>
    <div id="itab-activity" class="hidden">${renderActivityTab(c)}</div>
    <div id="itab-remarks" class="hidden">${renderRemarksTab(c)}</div>
  `;
}

function innerTab(name,btn){
  ['documents','activity','remarks'].forEach(t=>{const el=document.getElementById('itab-'+t);if(el)el.classList.add('hidden');});
  document.querySelectorAll('.inner-tab').forEach(b=>b.classList.remove('active'));
  document.getElementById('itab-'+name).classList.remove('hidden');
  btn.classList.add('active');
}

function renderActivityTab(c) {
  const log = c.activityLog || [];
  if (!log.length) return `<div class="card"><p style="font-size:12px;color:var(--gray-400)">No activity logged yet.</p></div>`;
  const dotClass = { Admin:'dot-admin', Team:'dot-team', Client:'dot-client', System:'dot-system' };
  return `<div class="card">
    <div class="card-title">Full activity log</div>
    ${log.map(entry => `
      <div class="activity-entry">
        <div class="activity-dot ${dotClass[entry.by]||'dot-system'}"></div>
        <div>
          <div class="activity-text"><b>${entry.by}</b> — ${entry.action}${entry.detail?' <span style="color:var(--gray-400)">· '+entry.detail+'</span>':''}</div>
          <div class="activity-meta">${entry.time}</div>
        </div>
      </div>`).join('')}
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--gray-100);display:flex;gap:12px;flex-wrap:wrap">
      <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--gray-400)"><span style="width:8px;height:8px;border-radius:50%;background:#6b3fc7;display:inline-block"></span>Admin</span>
      <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--gray-400)"><span style="width:8px;height:8px;border-radius:50%;background:#1A5EA8;display:inline-block"></span>Team</span>
      <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--gray-400)"><span style="width:8px;height:8px;border-radius:50%;background:#0F7A5A;display:inline-block"></span>Client</span>
    </div>
  </div>`;
}

function renderDocTab(c) {
  const pending=c.items.filter(i=>i.status!=='received');
  const received=c.items.filter(i=>i.status==='received');
  return `
    <div class="section-head">
      <div class="section-lbl" style="margin-bottom:0">Checklist</div>
      <button class="btn btn-ghost btn-sm" onclick="openItemModal()">+ Add item</button>
    </div>
    ${!c.items.length?'<div class="empty">No items yet.</div>':''}
    ${pending.length?`<div style="font-size:11px;font-weight:600;color:var(--amber-600);margin-bottom:8px">PENDING (${pending.length}) <span style="font-weight:400;color:var(--gray-400)">— drag to reorder</span></div>`:''}
    ${pending.map(item=>docItemHTML(item,true)).join('')}
    ${received.length?`<div style="font-size:11px;font-weight:600;color:var(--green-600);margin:14px 0 8px">RECEIVED (${received.length})</div>`:''}
    ${received.map(item=>docItemHTML(item,false)).join('')}
  `;
}

function docItemHTML(item,draggable){
  return `<div class="doc-item" id="di-${item.id}"
    ${draggable?`draggable="true" ondragstart="onDragStart(event,${item.id})" ondragend="onDragEnd(event)" ondragover="onDragOver(event,${item.id})" ondrop="onDrop(event,${item.id})"`:''}>
    <div style="display:flex;align-items:flex-start;gap:10px">
      ${draggable?'<div style="cursor:grab;color:var(--gray-300);font-size:16px;margin-top:2px;flex-shrink:0">⠿</div>':'<div style="width:16px;flex-shrink:0"></div>'}
      <div class="doc-check${item.status==='received'?' received':''}" onclick="toggleStatus(${item.id})"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500;text-decoration:${item.status==='received'?'line-through':'none'};color:${item.status==='received'?'var(--gray-400)':'var(--gray-800)'}">
          ${item.name}
        </div>
        <div style="margin-top:5px;display:flex;gap:5px;flex-wrap:wrap">
          ${item.format?`<span class="tag">${item.format}</span>`:''}
          <span class="badge ${item.status==='received'?'b-received':item.status==='review'?'b-review':'b-pending'}">${item.status}</span>
          ${item.addedBy==='client'?'<span class="badge b-client">Client added</span>':''}
          ${item.edited?'<span class="badge" style="background:#f0edfb;color:#6b3fc7;font-size:10px">✏️ edited</span>':''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <button class="btn btn-ghost btn-xs" onclick="openItemEdit(${item.id})">✏️</button>
        <select onchange="changeStatus(${item.id},this.value)" style="width:120px;font-size:11px;padding:5px 7px">
          ${['pending','received','review','rejected'].map(s=>`<option value="${s}"${item.status===s?' selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
        </select>
        <button class="btn-icon" onclick="removeItem(${item.id})">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
        </button>
      </div>
    </div>
    <div id="item-edit-${item.id}" class="hidden" style="margin-top:10px;padding:10px;background:var(--gray-50);border-radius:var(--r-sm)">
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input type="text" id="item-name-${item.id}" value="${item.name}" style="flex:1;font-size:12px"/>
        <select id="item-format-${item.id}" style="width:130px;font-size:12px">
          <option value="">Any format</option>
          ${['Scanned PDF','Excel / CSV','Email / image','Original hard copy'].map(f=>`<option value="${f}"${item.format===f?' selected':''}>${f}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:6px;justify-content:flex-end">
        <button class="btn btn-ghost btn-xs" onclick="cancelItemEdit(${item.id})">Cancel</button>
        <button class="btn btn-primary btn-xs" style="background:#0B2E55" onclick="saveItemEdit(${item.id})">Save</button>
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

function openItemEdit(iid){document.getElementById('item-edit-'+iid).classList.remove('hidden');}
function cancelItemEdit(iid){document.getElementById('item-edit-'+iid).classList.add('hidden');}
function saveItemEdit(iid){
  const c=clients.find(x=>x.id===activeId);if(!c)return;
  const item=c.items.find(i=>i.id===iid);if(!item)return;
  const newName=document.getElementById('item-name-'+iid).value.trim();
  const newFormat=document.getElementById('item-format-'+iid).value;
  const changes=[];
  if(newName&&newName!==item.name){changes.push(`Name: "${item.name}"→"${newName}"`);item.name=newName;}
  if(newFormat!==item.format){changes.push('Format updated');item.format=newFormat;}
  if(changes.length){
    item.edited=true;
    item.notes=item.notes||[];
    item.notes.push({author:'Admin',text:'✏️ '+changes.join(' | '),time:nowStr()});
    logActivity(c,'Document edited','Admin',changes.join(' | '));
    c.internalRemarks=c.internalRemarks||[];
    c.internalRemarks.unshift({text:'✏️ Admin edit — '+changes.join(' | '),time:nowStr(),isEdit:true});
  }
  saveClients(clients);renderDetail();renderStatusPanel();toast('Item updated');
}

function openItemModal(){openModal('item-modal');document.getElementById('im-name').value='';document.getElementById('im-note').value='';}
function addDocItem(){
  const name=document.getElementById('im-name').value.trim();
  const format=document.getElementById('im-format').value;
  const note=document.getElementById('im-note').value.trim();
  if(!name){toast('Enter document name');return;}
  const c=clients.find(x=>x.id===activeId);if(!c)return;
  const item=mkItem(genId(),name,format,'fintler');
  item.notes=item.notes||[];
  if(note)item.notes.push({author:'Admin',text:note,time:nowStr()});
  c.items.push(item);
  logActivity(c,'Item added','Admin',name);
  saveClients(clients);closeModal('item-modal');renderDetail();renderClientList();renderStatusPanel();toast('Item added');
}

function toggleStatus(iid){
  const c=clients.find(x=>x.id===activeId);if(!c)return;
  const item=c.items.find(i=>i.id===iid);if(!item)return;
  const prev=item.status;
  item.status=item.status==='received'?'pending':'received';
  logActivity(c,`"${item.name}" marked ${item.status}`,'Admin',`was ${prev}`);
  saveClients(clients);renderDetail();renderClientList();renderStatusPanel();
}
function changeStatus(iid,val){
  const c=clients.find(x=>x.id===activeId);if(!c)return;
  const item=c.items.find(i=>i.id===iid);if(!item)return;
  const prev=item.status;item.status=val;
  logActivity(c,`"${item.name}" status → ${val}`,'Admin',`was ${prev}`);
  saveClients(clients);renderDetail();renderClientList();renderStatusPanel();
}
function removeItem(iid){
  const c=clients.find(x=>x.id===activeId);if(!c)return;
  const item=c.items.find(i=>i.id===iid);
  if(item)logActivity(c,`Item removed: "${item.name}"`,'Admin','');
  c.items=c.items.filter(i=>i.id!==iid);
  saveClients(clients);renderDetail();renderClientList();renderStatusPanel();
}
function addNote(iid){
  const inp=document.getElementById('note-'+iid);if(!inp||!inp.value.trim())return;
  const c=clients.find(x=>x.id===activeId);if(!c)return;
  const item=c.items.find(i=>i.id===iid);if(!item)return;
  item.notes=item.notes||[];
  item.notes.push({author:'Admin',text:inp.value.trim(),time:nowStr()});
  logActivity(c,`Note added on "${item.name}"`,'Admin',inp.value.trim().substring(0,40));
  inp.value='';saveClients(clients);renderDetail();
}

function onDragStart(e,id){dragSrcId=id;e.dataTransfer.effectAllowed='move';setTimeout(()=>{const el=document.getElementById('di-'+id);if(el)el.style.opacity='0.4';},0);}
function onDragEnd(){const el=document.getElementById('di-'+dragSrcId);if(el)el.style.opacity='1';document.querySelectorAll('.doc-item').forEach(el=>el.style.borderColor='');}
function onDragOver(e,id){e.preventDefault();document.querySelectorAll('.doc-item').forEach(el=>el.style.borderColor='');const el=document.getElementById('di-'+id);if(el)el.style.borderColor='#0B2E55';}
function onDrop(e,tid){e.preventDefault();document.querySelectorAll('.doc-item').forEach(el=>el.style.borderColor='');if(dragSrcId===tid)return;const c=clients.find(x=>x.id===activeId);if(!c)return;const si=c.items.findIndex(i=>i.id===dragSrcId),ti=c.items.findIndex(i=>i.id===tid);if(si===-1||ti===-1)return;const[moved]=c.items.splice(si,1);c.items.splice(ti,0,moved);logActivity(c,'Checklist reordered','Admin','');saveClients(clients);renderDetail();toast('Reordered');}

function renderRemarksTab(c){
  return `<div class="card">
    <div class="card-title">Internal remarks <span style="color:var(--gray-300)">(not visible to client)</span></div>
    ${!(c.internalRemarks||[]).length?'<p style="font-size:12px;color:var(--gray-400);margin-bottom:12px">No remarks yet.</p>':
      (c.internalRemarks||[]).map(r=>`<div class="note-entry${r.isEdit?'" style="background:#f0edfb;border-left:3px solid #6b3fc7':''}">
        <div class="note-author" style="${r.isEdit?'color:#6b3fc7':''}">${r.isEdit?'✏️ Edit log':'Fintler team'}</div>
        <div class="note-text">${r.text}</div>
        <div class="note-time">${r.time}</div>
      </div>`).join('')}
    <hr class="divider"/>
    <div class="add-row">
      <input type="text" id="remark-inp" placeholder="Add internal remark..." style="flex:1" onkeydown="if(event.key==='Enter')addRemark()"/>
      <button class="btn btn-primary btn-sm" style="background:#0B2E55" onclick="addRemark()">Save</button>
    </div>
  </div>`;
}
function addRemark(){
  const inp=document.getElementById('remark-inp');if(!inp||!inp.value.trim())return;
  const c=clients.find(x=>x.id===activeId);if(!c)return;
  c.internalRemarks=c.internalRemarks||[];
  c.internalRemarks.push({text:inp.value.trim(),time:nowStr()});
  logActivity(c,'Internal remark added','Admin',inp.value.trim().substring(0,40));
  saveClients(clients);renderDetail();innerTab('remarks',document.querySelectorAll('.inner-tab')[2]);toast('Saved');
}

function openShareModal(){
  const c=clients.find(x=>x.id===activeId);if(!c)return;
  const base=window.location.origin+window.location.pathname.replace(/admin\/?.*$/,'');
  const clientURL=base+'client/?ref='+encodeURIComponent(c.slug);
  document.getElementById('share-content').innerHTML=`
    <p style="font-size:13px;color:var(--gray-600);margin-bottom:18px">Send <b>${c.name}</b> the link and password below.</p>
    <div style="margin-bottom:6px;font-size:12px;font-weight:500;color:var(--gray-600)">Client portal link</div>
    <div class="share-link-box">${clientURL}</div>
    <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText('${clientURL}').then(()=>toast('Link copied'))" style="margin-bottom:16px">Copy link</button>
    <div style="margin-bottom:6px;font-size:12px;font-weight:500;color:var(--gray-600)">Access password</div>
    <div class="share-pw-box">
      <span style="font-size:18px;font-weight:600;font-family:var(--mono);color:var(--gray-800)">${c.passwordPlain}</span>
      <button class="btn btn-ghost btn-xs" onclick="navigator.clipboard.writeText('${c.passwordPlain}').then(()=>toast('Password copied'))">Copy</button>
    </div>
    <div style="background:var(--gray-50);border-radius:var(--r-md);padding:16px">
      <div style="font-size:12px;font-weight:600;color:var(--gray-600);margin-bottom:10px">Suggested message</div>
      <div style="font-size:13px;color:var(--gray-600);line-height:1.7" id="share-msg-text">Dear ${c.name},<br><br>Please find below your document submission link for ${c.period||'the current period'}.<br><br><b>Portal link:</b> ${clientURL}<br><b>Password:</b> ${c.passwordPlain}<br><br>You can use this portal to submit and track your documents. If you have any questions, please contact us at ansam@fintler.com or info@fintler.com.<br><br>Best regards,<br>Fintler Financial Consultancy</div>
      <button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="navigator.clipboard.writeText(document.getElementById('share-msg-text').innerText).then(()=>toast('Message copied'))">Copy message</button>
    </div>
  `;
  openModal('share-modal');
}
