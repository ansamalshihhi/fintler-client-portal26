// ═══════════════════════════════════════════════════════
// FINTLER PORTAL — TEAM v4 (Supabase connected)
// ═══════════════════════════════════════════════════════

let clients = [];
let activeId = null;
let activeClientData = null;
let activeDocs = [];

(async function init() {
  await seedDemoIfEmpty();
  clients = await dbGetClients();
  renderClientList();
  updateStats();
  renderFeed();
  renderStatusChips();
})();

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

async function renderFeed(filterClientId) {
  const el = document.getElementById('feed-scroll'); if (!el) return;
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
    const pending = docs.filter(d=>d.status==='pending').length;
    const total = docs.length;
    const done = docs.filter(d=>d.status==='received').length;
    const over = c.deadline && new Date(c.deadline)<new Date() && pending>0;
    const pct = total?Math.round(done/total*100):0;
    if (over) html += `<div class="status-chip chip-overdue" onclick="selectClient(${c.id})">⚠ ${c.name} — ${pending} pending · overdue</div>`;
    else if (pending>0) html += `<div class="status-chip chip-inprog" onclick="selectClient(${c.id})">📋 ${c.name} — ${pct}% · ${done}/${total}</div>`;
    else if (total>0) html += `<div class="status-chip chip-complete">✅ ${c.name} — complete</div>`;
  }
  el.innerHTML = html || '<span style="font-size:11px;color:#C0BEB9">All clear</span>';
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
  if (!clients.length) { el.innerHTML='<div class="empty" style="padding:20px;font-size:12px">No clients yet.</div>'; return; }
  el.innerHTML = clients.map(c => {
    const over = c.deadline&&new Date(c.deadline)<new Date();
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

async function updateStats() {
  let p=0,r=0,o=0;
  for (const c of clients) {
    const docs = await dbGetDocuments(c.id);
    p += docs.filter(i=>i.status==='pending').length;
    r += docs.filter(i=>i.status==='received').length;
    if (c.deadline&&new Date(c.deadline)<new Date()&&docs.some(i=>i.status==='pending')) o++;
  }
  document.getElementById('s-clients').textContent=clients.length;
  document.getElementById('s-pending').textContent=p;
  document.getElementById('s-received').textContent=r;
  document.getElementById('s-overdue').textContent=o;
}

function renderDetail() {
  const c=activeClientData; if(!c) return;
  const docs=activeDocs;
  const done=docs.filter(i=>i.status==='received').length, total=docs.length;
  const pct=total?Math.round(done/total*100):0;
  const dl=c.deadline?new Date(c.deadline).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}):'No deadline';
  const over=c.deadline&&new Date(c.deadline)<new Date()&&done<total;
  document.getElementById('main-detail').innerHTML=`
    <div class="card">
      <div class="flex-between" style="margin-bottom:14px">
        <div>
          <div style="font-size:17px;font-weight:600;color:#1B38DB">${c.name}</div>
          <div style="font-size:12px;color:var(--gray-400);margin-top:3px">${c.doc_type||''}${c.period?' · '+c.period:''}${c.email?' · '+c.email:''}</div>
        </div>
        <span class="badge ${over?'b-overdue':done===total&&total>0?'b-received':'b-pending'}">${over?'Overdue':done===total&&total>0?'Complete':'In progress'}</span>
      </div>
      <div class="flex-between" style="font-size:12px;color:var(--gray-400);margin-bottom:7px">
        <span>Deadline: <b style="color:var(--gray-600)">${dl}</b></span>
        <span>${done}/${total} received (${pct}%)</span>
      </div>
      <div class="progress-bar" style="height:7px"><div class="progress-fill" style="width:${pct}%;background:${pct===100?'var(--green-600)':'#1B38DB'}"></div></div>
    </div>
    <div class="inner-tabs">
      <button class="inner-tab active" onclick="innerTab('documents',this)">Documents <span class="tab-chip">${total}</span></button>
      <button class="inner-tab" onclick="innerTab('remarks',this)">Internal remarks</button>
    </div>
    <div id="itab-documents">${renderDocTab(docs)}</div>
    <div id="itab-remarks" class="hidden"><div class="card"><p style="font-size:12px;color:var(--gray-400)">Loading...</p></div></div>
  `;
}

function innerTab(name,btn){
  ['documents','remarks'].forEach(t=>{const el=document.getElementById('itab-'+t);if(el)el.classList.add('hidden');});
  document.querySelectorAll('.inner-tab').forEach(b=>b.classList.remove('active'));
  document.getElementById('itab-'+name).classList.remove('hidden');
  btn.classList.add('active');
  if(name==='remarks') loadRemarks();
}

async function loadRemarks() {
  const el=document.getElementById('itab-remarks'); if(!el||!activeId) return;
  const remarks=await dbGetRemarks(activeId);
  el.innerHTML=`<div class="card">
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
      <button class="btn btn-primary btn-sm" style="background:#1B38DB" onclick="addRemark()">Save</button>
    </div>
  </div>`;
}

async function addRemark() {
  const inp=document.getElementById('remark-inp');if(!inp||!inp.value.trim())return;
  await dbAddRemark(activeId,inp.value.trim(),false);
  await dbLogActivity(activeId,activeClientData?.name||'','Internal remark added','Team',inp.value.trim().substring(0,60));
  inp.value='';loadRemarks();renderFeed(activeId);toast('Saved');
}

function renderDocTab(docs) {
  const pending=docs.filter(i=>i.status!=='received');
  const received=docs.filter(i=>i.status==='received');
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
        ${!item.fileUrl?`
          <label class="upload-btn" for="team-file-${item.id}" style="margin-top:6px;font-size:11px;padding:5px 10px">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload file
          </label>
          <input type="file" id="team-file-${item.id}" style="display:none" accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.doc,.docx" onchange="teamUploadFile(${item.id}, this)"/>
        `:''}
      </div>
      <select onchange="changeStatus(${item.id},this.value)" style="width:120px;font-size:11px;padding:5px 7px;flex-shrink:0">
        ${['pending','received','review','rejected'].map(s=>`<option value="${s}"${item.status===s?' selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
      </select>
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

function openItemModal(){
  openModal('item-modal');
  document.getElementById('im-name').value='';
  document.getElementById('im-note').value='';
}

async function addDocItem() {
  const name=document.getElementById('im-name').value.trim();
  const format=document.getElementById('im-format').value;
  const note=document.getElementById('im-note').value.trim();
  if(!name){toast('Enter document name');return;}
  const doc=await dbSaveDocument(activeId,{name,format,status:'pending',addedBy:'fintler'},true);
  if(doc&&note) await dbAddNote(doc.id,activeId,'Fintler team',note);
  await dbLogActivity(activeId,activeClientData?.name||'','Item added to checklist','Team',name);
  activeDocs=await dbGetDocuments(activeId);
  closeModal('item-modal');renderDetail();renderFeed(activeId);renderStatusChips();toast('Item added');
}

async function toggleStatus(iid) {
  const item=activeDocs.find(i=>i.id===iid);if(!item)return;
  const prev=item.status;
  item.status=item.status==='received'?'pending':'received';
  await dbSaveDocument(activeId,item,false);
  await dbLogActivity(activeId,activeClientData?.name||'',`"${item.name}" marked as ${item.status}`,'Team',`Previous: ${prev}`);
  activeDocs=await dbGetDocuments(activeId);renderDetail();renderFeed(activeId);renderStatusChips();updateStats();
}

async function changeStatus(iid,val) {
  const item=activeDocs.find(i=>i.id===iid);if(!item)return;
  const prev=item.status;item.status=val;
  await dbSaveDocument(activeId,item,false);
  await dbLogActivity(activeId,activeClientData?.name||'',`"${item.name}" status → ${val}`,'Team',`Previous: ${prev}`);
  activeDocs=await dbGetDocuments(activeId);renderDetail();renderFeed(activeId);renderStatusChips();updateStats();
}

async function addNote(iid) {
  const inp=document.getElementById('note-'+iid);if(!inp||!inp.value.trim())return;
  const item=activeDocs.find(i=>i.id===iid);if(!item)return;
  await dbAddNote(iid,activeId,'Fintler team',inp.value.trim());
  await dbLogActivity(activeId,activeClientData?.name||'',`Note added on "${item.name}"`,'Team',inp.value.trim().substring(0,60));
  inp.value='';activeDocs=await dbGetDocuments(activeId);renderDetail();renderFeed(activeId);
}

async function teamUploadFile(docId, input) {
  const file=input.files[0]; if(!file) return;
  toast('Uploading...');
  const result=await uploadFile(file, activeId, docId);
  if(!result){toast('Upload failed. Please try again.');return;}
  const item=activeDocs.find(i=>i.id===docId); if(!item) return;
  item.status='received';
  item.fileUrl=result.url;
  item.fileName=result.name;
  await dbSaveDocument(activeId,item,false);
  await dbAddNote(docId,activeId,'Fintler team',`File uploaded by team: ${file.name}`);
  await dbLogActivity(activeId,activeClientData?.name||'',`File uploaded: "${item.name}"`,'Team',file.name);
  activeDocs=await dbGetDocuments(activeId);
  renderDetail();renderFeed(activeId);renderStatusChips();updateStats();
  toast('File uploaded ✅');
}
