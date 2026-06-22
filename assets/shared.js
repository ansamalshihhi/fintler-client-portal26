// ═══════════════════════════════════════════════════════
// FINTLER PORTAL — SHARED DATA LAYER v4 (Supabase)
// ═══════════════════════════════════════════════════════

function fullTimestamp() {
  const now = new Date();
  const date = now.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  const time = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  return `${date} · ${time}`;
}

function nowStr() { return fullTimestamp(); }
function fmtAmt(n) {
  if (typeof n !== 'number') return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
}
function genId() { return Date.now() + Math.floor(Math.random() * 9999); }

function toast(msg) {
  const el = document.getElementById('toast'); if (!el) return;
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

async function hashPassword(pw) {
  const enc = new TextEncoder().encode(pw + '_fintler_salt_2025');
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}
async function verifyPassword(pw, hash) { return await hashPassword(pw) === hash; }
function slugify(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }

const DOC_SUGG = {
  'Bank statement': [
    {name:'Bank statement – Month 1',format:'Scanned PDF'},
    {name:'Bank statement – Month 2',format:'Scanned PDF'},
    {name:'Bank statement – Month 3',format:'Scanned PDF'},
  ],
  'VAT return': [
    {name:'Sales invoices (full period)',format:'Excel / CSV'},
    {name:'Purchase invoices (full period)',format:'Excel / CSV'},
    {name:'Previous VAT return copy',format:'Scanned PDF'},
    {name:'VAT registration certificate',format:'Scanned PDF'},
  ],
  'Payroll record': [
    {name:'Payroll summary sheet',format:'Excel / CSV'},
    {name:'Employee list with salaries',format:'Excel / CSV'},
    {name:'PASI / social insurance confirmation',format:'Scanned PDF'},
  ],
  'Sales invoices': [
    {name:'Sales invoice register',format:'Excel / CSV'},
    {name:'Customer statements',format:'Scanned PDF'},
    {name:'Credit notes (if any)',format:'Scanned PDF'},
  ],
  'Purchase invoices': [
    {name:'Supplier invoices',format:'Scanned PDF'},
    {name:'Payment receipts',format:'Scanned PDF'},
    {name:'Petty cash vouchers',format:'Scanned PDF'},
  ],
  'Trial balance': [
    {name:'Opening trial balance',format:'Excel / CSV'},
    {name:'Closing trial balance',format:'Excel / CSV'},
    {name:'Supporting schedules',format:'Excel / CSV'},
  ],
  'Financial statements': [
    {name:'Signed financial statements',format:'Scanned PDF'},
    {name:'Board approval letter',format:'Scanned PDF'},
    {name:'Prior year comparatives',format:'Excel / CSV'},
  ],
};

// ── Supabase DB helpers ────────────────────────────────

async function dbGetClients() {
  const { data, error } = await db.from('clients').select('*').order('created_at', { ascending:false });
  if (error) { console.error('getClients:', error); return []; }
  return data || [];
}

async function dbSaveClient(c, isNew) {
  const payload = {
    name: c.name, email: c.email||'', period: c.period||'',
    doc_type: c.docType||c.doc_type||'', deadline: c.deadline||null,
    slug: c.slug, password_hash: c.passwordHash||c.password_hash,
    password_plain: c.passwordPlain||c.password_plain,
    analysis: c.analysis||null,
  };
  if (isNew) {
    const { data, error } = await db.from('clients').insert(payload).select().single();
    if (error) { console.error('insert client:', error); return null; }
    return data;
  } else {
    const { data, error } = await db.from('clients').update(payload).eq('id', c.id).select().single();
    if (error) { console.error('update client:', error); return null; }
    return data;
  }
}

async function dbDeleteClient(id) {
  const { error } = await db.from('clients').delete().eq('id', id);
  return !error;
}

async function dbGetDocuments(clientId) {
  const { data, error } = await db.from('documents').select('*, notes(*)').eq('client_id', clientId).order('created_at');
  if (error) { console.error('getDocs:', error); return []; }
  return (data||[]).map(d => ({
    id: d.id, name: d.name, format: d.format||'', status: d.status||'pending',
    addedBy: d.added_by||'fintler', edited: d.edited||false,
    fileUrl: d.file_url||null, fileName: d.file_name||null,
    notes: (d.notes||[]).map(n => ({
      id:n.id, author:n.author, text:n.text,
      time: new Date(n.created_at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
    }))
  }));
}

async function dbSaveDocument(clientId, doc, isNew) {
  const payload = {
    client_id: clientId, name: doc.name, format: doc.format||'',
    status: doc.status||'pending', added_by: doc.addedBy||'fintler',
    edited: doc.edited||false, file_url: doc.fileUrl||null, file_name: doc.fileName||null,
  };
  if (isNew) {
    const { data, error } = await db.from('documents').insert(payload).select().single();
    if (error) { console.error('insert doc:', error); return null; }
    return data;
  } else {
    const { data, error } = await db.from('documents').update(payload).eq('id', doc.id).select().single();
    if (error) { console.error('update doc:', error); return null; }
    return data;
  }
}

async function dbDeleteDocument(docId) {
  const { error } = await db.from('documents').delete().eq('id', docId);
  return !error;
}

async function dbAddNote(docId, clientId, author, text) {
  const { data, error } = await db.from('notes').insert({ document_id:docId, client_id:clientId, author, text }).select().single();
  if (error) { console.error('add note:', error); return null; }
  return data;
}

async function dbGetActivityLog(clientId) {
  const { data, error } = await db.from('activity_log').select('*').eq('client_id', clientId).order('created_at', { ascending:false }).limit(100);
  if (error) return [];
  return (data||[]).map(e => ({
    ...e,
    timestamp: new Date(e.created_at).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})
  }));
}

async function dbGetAllActivity() {
  const { data, error } = await db.from('activity_log').select('*').order('created_at', { ascending:false }).limit(200);
  if (error) return [];
  return (data||[]).map(e => ({
    ...e,
    timestamp: new Date(e.created_at).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})
  }));
}

async function dbLogActivity(clientId, clientName, action, by, detail) {
  await db.from('activity_log').insert({ client_id:clientId, client_name:clientName, action, by, detail:detail||'' });
}

async function dbGetRemarks(clientId) {
  const { data, error } = await db.from('internal_remarks').select('*').eq('client_id', clientId).order('created_at', { ascending:false });
  if (error) return [];
  return (data||[]).map(r => ({
    ...r,
    time: new Date(r.created_at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
  }));
}

async function dbAddRemark(clientId, text, isEdit) {
  await db.from('internal_remarks').insert({ client_id:clientId, text, is_edit:isEdit||false });
}

async function uploadFile(file, clientId, docId) {
  const ext = file.name.split('.').pop();
  const path = `${clientId}/${docId}_${Date.now()}.${ext}`;
  const { error } = await db.storage.from('documents').upload(path, file, { upsert:true });
  if (error) { console.error('upload:', error); return null; }
  const { data: urlData } = db.storage.from('documents').getPublicUrl(path);
  return { url: urlData.publicUrl, name: file.name };
}

async function seedDemoIfEmpty() {
  const existing = await dbGetClients();
  if (existing.length) return existing;
  const pwHash = await hashPassword('Qtech2025');
  const { data: client, error } = await db.from('clients').insert({
    name:'Qtech SPC', email:'finance@qtechspc.om', period:'Q1 2025',
    doc_type:'Bank statement', deadline: new Date(Date.now()+7*86400000).toISOString().slice(0,10),
    slug:'qtech-spc', password_hash:pwHash, password_plain:'Qtech2025',
  }).select().single();
  if (error || !client) return [];
  const docs = [
    {name:'Bank statement – January 2025',format:'Scanned PDF',status:'received',added_by:'fintler'},
    {name:'Bank statement – February 2025',format:'Scanned PDF',status:'review',added_by:'fintler'},
    {name:'Bank statement – March 2025',format:'Scanned PDF',status:'pending',added_by:'fintler'},
  ];
  for (const d of docs) {
    await db.from('documents').insert({...d, client_id:client.id});
  }
  await dbLogActivity(client.id, client.name, 'Demo engagement created', 'Admin', 'Qtech SPC');
  return await dbGetClients();
}

// ═══════════════════════════════════════════════════════
// NOTIFICATION BELL SYSTEM
// ═══════════════════════════════════════════════════════

async function dbGetNotifications(role) {
  const { data, error } = await db
    .from('notifications')
    .select('*')
    .or(`target_role.eq.${role},target_role.eq.all`)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) { console.error('getNotifications:', error); return []; }
  return data || [];
}

async function dbMarkNotificationsRead(role) {
  await db
    .from('notifications')
    .update({ read_by: role })
    .or(`target_role.eq.${role},target_role.eq.all`)
    .is('read_by', null);
}

async function dbPushNotification(type, title, detail, clientName, targetRole) {
  await db.from('notifications').insert({
    type,
    title,
    detail: detail || '',
    client_name: clientName || '',
    target_role: targetRole || 'all',
    read_by: null,
  });
}

let _notifRole = 'team';
let _notifOpen = false;

function initNotificationBell(role) {
  _notifRole = role;
  refreshNotifBadge();
  setInterval(refreshNotifBadge, 30000);
}

async function refreshNotifBadge() {
  const all = await dbGetNotifications(_notifRole);
  const unread = all.filter(n => n.read_by === null).length;
  const badge = document.getElementById('notif-badge');
  if (badge) {
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.style.display = unread > 0 ? 'flex' : 'none';
  }
}

async function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  _notifOpen = !_notifOpen;
  if (_notifOpen) {
    panel.classList.remove('notif-hidden');
    await renderNotifPanel();
    await dbMarkNotificationsRead(_notifRole);
    const badge = document.getElementById('notif-badge');
    if (badge) badge.style.display = 'none';
  } else {
    panel.classList.add('notif-hidden');
  }
}

async function renderNotifPanel() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  list.innerHTML = '<div class="notif-loading">Loading...</div>';
  const items = await dbGetNotifications(_notifRole);
  if (!items.length) {
    list.innerHTML = '<div class="notif-empty">You\'re all caught up ✓</div>';
    return;
  }
  list.innerHTML = items.map(n => {
    const icon = { file_upload:'📎', status_change:'🔄', new_client:'🆕', remark:'💬' }[n.type] || '🔔';
    const ago = timeAgo(new Date(n.created_at));
    const unread = n.read_by === null;
    return `<div class="notif-item${unread ? ' notif-unread' : ''}">
      <div class="notif-icon">${icon}</div>
      <div class="notif-body">
        <div class="notif-title">${n.title}</div>
        ${n.detail ? `<div class="notif-detail">${n.detail}</div>` : ''}
        ${n.client_name ? `<div class="notif-client">${n.client_name}</div>` : ''}
        <div class="notif-time">${ago}</div>
      </div>
    </div>`;
  }).join('');
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

document.addEventListener('click', function(e) {
  if (_notifOpen && !e.target.closest('#notif-bell-btn') && !e.target.closest('#notif-panel')) {
    const panel = document.getElementById('notif-panel');
    if (panel) panel.classList.add('notif-hidden');
    _notifOpen = false;
  }
});
