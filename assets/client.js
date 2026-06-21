// ═══════════════════════════════════════════════════════
// FINTLER PORTAL — CLIENT v4 (Supabase + file upload)
// ═══════════════════════════════════════════════════════

let activeClient = null;
let activeDocs = [];

window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) window._clientRef = ref;
  const pw = document.getElementById('pw-input');
  if (pw) pw.focus();
});

async function tryLogin() {
  const pw = document.getElementById('pw-input').value.trim();
  const btn = document.querySelector('.login-card .btn-primary');
  if (!pw) { showError('Please enter your password.'); return; }
  btn.textContent = 'Checking...'; btn.disabled = true;

  const { data: clients, error } = await db.from('clients').select('*');
  btn.textContent = 'Access my checklist'; btn.disabled = false;
  if (error) { showError('Connection error. Please try again.'); return; }

  const ref = window._clientRef || null;
  let matched = null;
  for (const c of (clients||[])) {
    const ok = await verifyPassword(pw, c.password_hash);
    if (ok) { if (!ref || c.slug === ref) { matched = c; break; } if (!matched) matched = c; }
  }

  if (!matched) { showError('Incorrect password. Please check with Fintler.'); return; }

  activeClient = matched;
  activeDocs = await dbGetDocuments(matched.id);

  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('client-portal').classList.remove('hidden');
  document.getElementById('client-nav-info').classList.remove('hidden');
  document.getElementById('client-name-badge').textContent = matched.name;

  await dbLogActivity(matched.id, matched.name, 'Client logged in to portal', 'Client', '');
  renderClientPortal();
}

function showError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg; el.classList.remove('hidden');
  document.getElementById('pw-input').value = '';
  document.getElementById('pw-input').focus();
}

function renderClientPortal() {
  const c = activeClient;
  const docs = activeDocs;
  const done = docs.filter(i=>i.status==='received').length;
  const total = docs.length;
  const pct = total ? Math.round(done/total*100) : 0;
  const dl = c.deadline ? new Date(c.deadline).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}) : 'To be confirmed';
  const isOverdue = c.deadline && new Date(c.deadline)<new Date() && done<total;

  document.getElementById('client-hero').innerHTML=`
    <h2>${c.name}</h2>
    <p>${c.doc_type||''} submission${c.period?' — '+c.period:''}</p>
    <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
      <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.15);border-radius:20px;padding:5px 13px;font-size:12px;font-weight:500">
        📅 Deadline: ${dl}
      </div>
      ${isOverdue?'<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,100,100,.25);border-radius:20px;padding:5px 13px;font-size:12px;font-weight:500">⚠ Deadline passed — please submit as soon as possible</div>':''}
    </div>
  `;

  document.getElementById('progress-stats').innerHTML=`
    <div class="ps-card"><div class="ps-num" style="${pct===100?'color:var(--green-600)':''}">${pct}%</div><div class="ps-lbl">Complete</div><div class="progress-bar" style="margin-top:8px"><div class="progress-fill" style="width:${pct}%;background:${pct===100?'var(--green-600)':'#1B38DB'}"></div></div></div>
    <div class="ps-card"><div class="ps-num" style="color:var(--amber-600)">${total-done}</div><div class="ps-lbl">Still needed</div></div>
    <div class="ps-card"><div class="ps-num" style="color:var(--green-600)">${done}</div><div class="ps-lbl">Submitted</div></div>
  `;

  const pending = docs.filter(i=>i.status!=='received');
  const received = docs.filter(i=>i.status==='received');

  document.getElementById('checklist-items').innerHTML=`
    ${!docs.length?'<div class="empty">No items yet. Fintler will update this shortly.</div>':''}
    ${pending.length?`<div style="font-size:11px;font-weight:600;color:var(--amber-600);margin-bottom:10px;text-transform:uppercase;letter-spacing:.07em">Pending (${pending.length})</div>`:''}
    ${pending.map(item=>clientDocHTML(item)).join('')}
    ${received.length?`<div style="font-size:11px;font-weight:600;color:var(--green-600);margin:16px 0 10px;text-transform:uppercase;letter-spacing:.07em">Submitted (${received.length})</div>`:''}
    ${received.map(item=>clientDocHTML(item)).join('')}
  `;
}

function clientDocHTML(item) {
  return `<div class="client-doc${item.status==='received'?' done':''}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div style="flex:1">
        <div style="font-size:14px;font-weight:500;text-decoration:${item.status==='received'?'line-through':'none'};color:${item.status==='received'?'var(--gray-400)':'var(--gray-800)'}">
          ${item.name}
        </div>
        ${item.format?`<div style="font-size:12px;color:var(--gray-400);margin-top:4px">Format: <span class="tag">${item.format}</span></div>`:''}
        ${item.status==='review'?'<div style="font-size:12px;color:#1B38DB;margin-top:5px;font-weight:500">Under review by Fintler</div>':''}
        ${item.status==='rejected'?'<div style="font-size:12px;color:var(--red-600);margin-top:5px;font-weight:500">Please re-submit — Fintler has a question about this item</div>':''}
        ${item.fileUrl?`<a href="${item.fileUrl}" target="_blank" class="file-attached">📎 ${item.fileName||'View uploaded file'}</a>`:''}
      </div>
      <span class="badge ${item.status==='received'?'b-received':item.status==='review'?'b-review':item.status==='rejected'?'b-overdue':'b-pending'}">
        ${item.status==='received'?'Submitted':item.status==='review'?'Under review':item.status==='rejected'?'Re-submit':'Pending'}
      </span>
    </div>

    ${item.status!=='received'&&item.status!=='review'?`
      <div style="margin-top:12px">
        <label class="upload-btn" for="file-${item.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Upload file (PDF, Excel, image)
        </label>
        <input type="file" id="file-${item.id}" style="display:none" accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.doc,.docx" onchange="handleFileUpload(${item.id}, this)"/>
        <div id="upload-progress-${item.id}" style="display:none" class="upload-progress"><div class="upload-progress-fill" id="upload-fill-${item.id}" style="width:0%"></div></div>
        <button class="client-upload-btn" onclick="markSubmitted(${item.id})" style="margin-top:8px">
          ✓ Mark as submitted without uploading
        </button>
      </div>`:''}

    ${item.status==='received'?`
      <div style="font-size:12px;color:var(--green-600);margin-top:10px;font-weight:500;display:flex;align-items:center;gap:5px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Received — Fintler is reviewing
      </div>
      <button onclick="clientUnsubmit(${item.id})" style="margin-top:6px;font-size:11px;color:var(--gray-400);background:none;border:1px solid var(--gray-200);border-radius:4px;padding:3px 10px;cursor:pointer">
        ↩ Undo submission
      </button>`:''}

    ${(item.notes||[]).filter(n=>n.author!=='Fintler team'&&!n.text.includes('✏️')).map(n=>`
      <div style="margin-top:8px;padding:8px 10px;background:var(--gray-50);border-radius:6px;font-size:12px;color:var(--gray-600)">
        <b>${n.author}:</b> ${n.text} <span style="color:var(--gray-400);font-size:10px">· ${n.time}</span>
      </div>`).join('')}
  </div>`;
}

async function handleFileUpload(docId, input) {
  const file = input.files[0]; if (!file) return;
  const progressWrap = document.getElementById('upload-progress-'+docId);
  const progressFill = document.getElementById('upload-fill-'+docId);
  if (progressWrap) progressWrap.style.display = 'block';
  if (progressFill) progressFill.style.width = '30%';
  toast('Uploading file...');

  const result = await uploadFile(file, activeClient.id, docId);
  if (!result) { toast('Upload failed. Please try again.'); if(progressWrap) progressWrap.style.display='none'; return; }

  if (progressFill) progressFill.style.width = '70%';

  const item = activeDocs.find(i=>i.id===docId); if(!item) return;
  item.status = 'received';
  item.fileUrl = result.url;
  item.fileName = result.name;

  await dbSaveDocument(activeClient.id, item, false);
  await dbAddNote(docId, activeClient.id, 'Client', `File uploaded: ${file.name}`);
  await dbLogActivity(activeClient.id, activeClient.name, `File uploaded: "${item.name}"`, 'Client', file.name);

  if (progressFill) progressFill.style.width = '100%';
  setTimeout(async () => {
    activeDocs = await dbGetDocuments(activeClient.id);
    renderClientPortal();
    toast('File uploaded successfully ✅');
  }, 500);
}

async function markSubmitted(docId) {
  const item = activeDocs.find(i=>i.id===docId); if(!item) return;
  item.status = 'received';
  await dbSaveDocument(activeClient.id, item, false);
  await dbAddNote(docId, activeClient.id, 'Client', 'Marked as submitted by client');
  await dbLogActivity(activeClient.id, activeClient.name, `"${item.name}" marked as submitted`, 'Client', '');
  activeDocs = await dbGetDocuments(activeClient.id);
  renderClientPortal();
  toast('Marked as submitted ✅');
}

async function clientUnsubmit(docId) {
  const item = activeDocs.find(i=>i.id===docId); if(!item) return;
  item.status = 'pending';
  await dbSaveDocument(activeClient.id, item, false);
  await dbLogActivity(activeClient.id, activeClient.name, `"${item.name}" submission undone`, 'Client', '');
  activeDocs = await dbGetDocuments(activeClient.id);
  renderClientPortal();
  toast('Submission undone');
}

async function clientAddItem() {
  const inp = document.getElementById('client-add-inp');
  if (!inp||!inp.value.trim()) { toast('Enter a document name'); return; }
  const doc = await dbSaveDocument(activeClient.id, { name:inp.value.trim(), format:'', status:'pending', addedBy:'client' }, true);
  if (doc) {
    await dbAddNote(doc.id, activeClient.id, 'Client', 'Added by client via portal');
    await dbLogActivity(activeClient.id, activeClient.name, `Client added document: "${inp.value.trim()}"`, 'Client', '');
  }
  inp.value = '';
  activeDocs = await dbGetDocuments(activeClient.id);
  renderClientPortal();
  toast('Document added');
  renderClientFeed();
}
async function renderClientFeed() {
  const el = document.getElementById('feed-scroll'); if (!el || !activeClient) return;
  const entries = await dbGetActivityLog(activeClient.id);
  if (!entries.length) { el.innerHTML = '<div class="feed-empty">No activity yet.</div>'; return; }
  el.innerHTML = entries.map(e => `
    <div class="feed-entry by-${e.by}">
      <div class="feed-who">${e.by}</div>
      <div class="feed-action">${e.action}</div>
      ${e.detail?`<div class="feed-detail">${e.detail}</div>`:''}
      <div class="feed-time">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${e.timestamp}
      </div>
    </div>`).join('');
}
