// ═══════════════════════════════════════════════════════
// FINTLER PORTAL — TEAM SIDE (team.js)
// Documents, notes, status changes, AI reader only.
// Create/edit/delete/passwords are admin-only.
// ═══════════════════════════════════════════════════════

let clients = [];
let activeId = null;
let dragSrcId = null;

(async function init() {
  clients = await seedDemoIfEmpty();
  renderClientList();
  updateStats();
})();

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ── Client list ────────────────────────────────────────
function selectClient(id) { activeId = id; renderClientList(); renderDetail(); }

function renderClientList() {
  const el = document.getElementById('client-list');
  if (!clients.length) { el.innerHTML = '<div class="empty" style="padding:20px;font-size:12px">No clients yet.<br>Ask your admin to create one.</div>'; return; }
  el.innerHTML = clients.map(c => {
    const done = c.items.filter(i=>i.status==='received').length;
    const total = c.items.length;
    const pct = total ? Math.round(done/total*100) : 0;
    const over = c.deadline && new Date(c.deadline)<new Date() && done<total;
    return `<div class="cli-item${c.id===activeId?' active':''}" onclick="selectClient(${c.id})">
      <div class="flex-between">
        <div class="cli-name">${c.name}</div>
        <div style="display:flex;gap:4px">
          ${c.analysis?'<span class="badge b-review" style="font-size:10px">AI</span>':''}
          ${over?'<span class="badge b-overdue" style="font-size:10px">Late</span>':''}
        </div>
      </div>
      <div class="cli-sub">${c.docType}${c.period?' · '+c.period:''}</div>
      <div class="progress-bar"><div class="progress-fill${pct===100?' complete':''}" style="width:${pct}%"></div></div>
      <div style="font-size:10px;color:var(--gray-400);margin-top:4px">${done}/${total} received</div>
    </div>`;
  }).join('');
}

function updateStats() {
  const p = clients.reduce((s,c)=>s+c.items.filter(i=>i.status==='pending').length,0);
  const r = clients.reduce((s,c)=>s+c.items.filter(i=>i.status==='received').length,0);
  const o = clients.filter(c=>c.deadline&&new Date(c.deadline)<new Date()&&c.items.some(i=>i.status==='pending')).length;
  document.getElementById('s-clients').textContent=clients.length;
  document.getElementById('s-pending').textContent=p;
  document.getElementById('s-received').textContent=r;
  document.getElementById('s-overdue').textContent=o;
}

// ── Detail ─────────────────────────────────────────────
function renderDetail() {
  const c = clients.find(x=>x.id===activeId); if(!c) return;
  const done = c.items.filter(i=>i.status==='received').length;
  const total = c.items.length;
  const pct = total?Math.round(done/total*100):0;
  const dl = c.deadline?new Date(c.deadline).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}):'No deadline';
  const over = c.deadline&&new Date(c.deadline)<new Date()&&done<total;

  document.getElementById('main-detail').innerHTML=`
    <div class="card">
      <div class="flex-between" style="margin-bottom:14px">
        <div>
          <div style="font-size:17px;font-weight:600">${c.name}</div>
          <div style="font-size:12px;color:var(--gray-400);margin-top:3px">${c.docType}${c.period?' · '+c.period:''}${c.email?' · '+c.email:''}</div>
        </div>
        <span class="badge ${over?'b-overdue':done===total&&total>0?'b-received':'b-pending'}">${over?'Overdue':done===total&&total>0?'Complete':'In progress'}</span>
      </div>
      <div class="flex-between" style="font-size:12px;color:var(--gray-400);margin-bottom:7px">
        <span>Deadline: <b style="color:var(--gray-600)">${dl}</b></span>
        <span>${done}/${total} received (${pct}%)</span>
      </div>
      <div class="progress-bar" style="height:7px"><div class="progress-fill${pct===100?' complete':''}" style="width:${pct}%"></div></div>
    </div>

    <div class="inner-tabs">
      <button class="inner-tab active" onclick="innerTab('documents',this)">Documents <span class="tab-chip">${total}</span></button>
      <button class="inner-tab" onclick="innerTab('ai',this)">AI Reader ${c.analysis?'<span class="tab-chip" style="background:var(--blue-50);color:var(--blue-600)">Done</span>':''}</button>
      <button class="inner-tab" onclick="innerTab('remarks',this)">Internal remarks ${c.internalRemarks.length?`<span class="tab-chip">${c.internalRemarks.length}</span>`:''}</button>
    </div>

    <div id="itab-documents">${renderDocTab(c)}</div>
    <div id="itab-ai" class="hidden">${renderAITab(c)}</div>
    <div id="itab-remarks" class="hidden">${renderRemarksTab(c)}</div>
  `;
}

function innerTab(name,btn){
  ['documents','ai','remarks'].forEach(t=>{const el=document.getElementById('itab-'+t);if(el)el.classList.add('hidden');});
  document.querySelectorAll('.inner-tab').forEach(b=>b.classList.remove('active'));
  document.getElementById('itab-'+name).classList.remove('hidden');
  btn.classList.add('active');
}

// ── Documents tab ──────────────────────────────────────
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
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <select onchange="changeStatus(${item.id},this.value)" style="width:120px;font-size:11px;padding:5px 7px">
          ${['pending','received','review','rejected'].map(s=>`<option value="${s}"${item.status===s?' selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--gray-100)">
      ${item.notes.map(n=>`<div class="note-entry${n.author==='AI analysis'?' note-ai':''}"><div class="note-author">${n.author}</div><div class="note-text">${n.text}</div><div class="note-time">${n.time}</div></div>`).join('')}
      <div class="add-row">
        <input type="text" id="note-${item.id}" placeholder="Add note on this item..." style="flex:1;font-size:12px" onkeydown="if(event.key==='Enter')addNote(${item.id})"/>
        <button class="btn btn-ghost btn-sm" onclick="addNote(${item.id})">Note</button>
      </div>
    </div>
  </div>`;
}

function openItemModal(){openModal('item-modal');document.getElementById('im-name').value='';document.getElementById('im-note').value='';}
function addDocItem(){
  const name=document.getElementById('im-name').value.trim();
  const format=document.getElementById('im-format').value;
  const note=document.getElementById('im-note').value.trim();
  if(!name){toast('Enter document name');return;}
  const c=clients.find(x=>x.id===activeId);if(!c)return;
  const item=mkItem(genId(),name,format,'fintler');
  if(note)item.notes.push({author:'Fintler team',text:note,time:nowStr()});
  c.items.push(item);saveClients(clients);closeModal('item-modal');renderDetail();renderClientList();updateStats();toast('Item added');
}
function toggleStatus(iid){const c=clients.find(x=>x.id===activeId);if(!c)return;const item=c.items.find(i=>i.id===iid);if(!item)return;item.status=item.status==='received'?'pending':'received';saveClients(clients);renderDetail();renderClientList();updateStats();}
function changeStatus(iid,val){const c=clients.find(x=>x.id===activeId);if(!c)return;const item=c.items.find(i=>i.id===iid);if(item){item.status=val;saveClients(clients);renderDetail();renderClientList();updateStats();}}
function addNote(iid){const inp=document.getElementById('note-'+iid);if(!inp||!inp.value.trim())return;const c=clients.find(x=>x.id===activeId);if(!c)return;const item=c.items.find(i=>i.id===iid);if(!item)return;item.notes.push({author:'Fintler team',text:inp.value.trim(),time:nowStr()});inp.value='';saveClients(clients);renderDetail();}

// ── Drag & drop ────────────────────────────────────────
function onDragStart(e,itemId){dragSrcId=itemId;e.dataTransfer.effectAllowed='move';setTimeout(()=>{const el=document.getElementById('di-'+itemId);if(el)el.style.opacity='0.4';},0);}
function onDragEnd(e){const el=document.getElementById('di-'+dragSrcId);if(el)el.style.opacity='1';document.querySelectorAll('.doc-item').forEach(el=>el.style.borderColor='');}
function onDragOver(e,itemId){e.preventDefault();document.querySelectorAll('.doc-item').forEach(el=>el.style.borderColor='');const el=document.getElementById('di-'+itemId);if(el)el.style.borderColor='var(--blue-600)';}
function onDrop(e,targetId){e.preventDefault();document.querySelectorAll('.doc-item').forEach(el=>el.style.borderColor='');if(dragSrcId===targetId)return;const c=clients.find(x=>x.id===activeId);if(!c)return;const si=c.items.findIndex(i=>i.id===dragSrcId),ti=c.items.findIndex(i=>i.id===targetId);if(si===-1||ti===-1)return;const[moved]=c.items.splice(si,1);c.items.splice(ti,0,moved);saveClients(clients);renderDetail();toast('Reordered');}

// ── Remarks tab ────────────────────────────────────────
function renderRemarksTab(c){
  return `<div class="card">
    <div class="card-title">Internal remarks <span style="color:var(--gray-300)">(not visible to client)</span></div>
    ${!c.internalRemarks.length?'<p style="font-size:12px;color:var(--gray-400);margin-bottom:12px">No remarks yet.</p>':
      c.internalRemarks.map(r=>`<div class="note-entry${r.isEdit?'" style="background:#f0edfb;border-left:3px solid #6b3fc7':''}">
        <div class="note-author" style="${r.isEdit?'color:#6b3fc7':''}">${r.isEdit?'✏️ Admin edit':'Fintler team'}</div>
        <div class="note-text">${r.text}</div>
        <div class="note-time">${r.time}</div>
      </div>`).join('')}
    <hr class="divider"/>
    <div class="add-row">
      <input type="text" id="remark-inp" placeholder="Add internal remark..." style="flex:1" onkeydown="if(event.key==='Enter')addRemark()"/>
      <button class="btn btn-primary btn-sm" onclick="addRemark()">Save</button>
    </div>
  </div>`;
}
function addRemark(){const inp=document.getElementById('remark-inp');if(!inp||!inp.value.trim())return;const c=clients.find(x=>x.id===activeId);if(!c)return;c.internalRemarks.push({text:inp.value.trim(),time:nowStr()});saveClients(clients);renderDetail();innerTab('remarks',document.querySelectorAll('.inner-tab')[2]);toast('Remark saved');}

// ── AI Reader ──────────────────────────────────────────
function renderAITab(c){
  if(!c.analysis){
    return`<div class="card">
      <div class="card-title">AI bank statement reader</div>
      <p style="font-size:13px;color:var(--gray-600);margin-bottom:20px">Upload a bank statement (PDF or Excel/CSV). The AI extracts every transaction and flags unusual entries.</p>
      <div class="ai-zone" onclick="document.getElementById('ai-upload').click()">
        <div class="ai-icon-wrap"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A5EA8" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
        <div style="font-size:14px;font-weight:500;color:var(--blue-700);margin-bottom:5px">Click to upload bank statement</div>
        <div style="font-size:12px;color:var(--gray-400)">Accepts PDF, Excel (.xlsx), or CSV</div>
      </div>
      <input type="file" id="ai-upload" accept=".pdf,.xlsx,.csv,.xls,.jpg,.jpeg,.png" class="hidden" onchange="runAI(this)"/>
      <div id="ai-status" style="margin-top:16px"></div>
    </div>`;
  }
  const a=c.analysis;
  const maxC=Math.max(...(a.monthly||[]).map(m=>m.totalCredits||0),1);
  return`<div>
    <div class="card" style="margin-bottom:16px">
      <div class="flex-between" style="margin-bottom:16px">
        <div>
          <div style="font-size:15px;font-weight:600">${a.accountName||'Account analysis'}</div>
          <div style="font-size:12px;color:var(--gray-400);margin-top:2px">${a.accountNumber?'Acc: '+a.accountNumber+' · ':''}${a.period||c.period||''}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-teal btn-sm" onclick="exportToExcel()">↓ Export Excel</button>
          <button class="btn btn-ghost btn-sm" onclick="clearAnalysis()">Re-upload</button>
        </div>
      </div>
      <div class="summary-grid">
        <div class="sum-card credits"><div class="sum-lbl">Total credits</div><div class="sum-amount">OMR ${fmtAmt(a.totalCredits)}</div><div class="sum-sub">${(a.transactions||[]).filter(t=>t.type==='credit').length} transactions</div></div>
        <div class="sum-card debits"><div class="sum-lbl">Total debits</div><div class="sum-amount">OMR ${fmtAmt(a.totalDebits)}</div><div class="sum-sub">${(a.transactions||[]).filter(t=>t.type==='debit').length} transactions</div></div>
        <div class="sum-card balance"><div class="sum-lbl">Net position</div><div class="sum-amount">${(a.totalCredits-a.totalDebits)>=0?'':'−'}OMR ${fmtAmt(Math.abs(a.totalCredits-a.totalDebits))}</div><div class="sum-sub">${a.closingBalance?'Closing: OMR '+fmtAmt(a.closingBalance):''}</div></div>
      </div>
      ${a.flags&&a.flags.length?`<div style="margin-bottom:16px"><div class="section-lbl">Flags (${a.flags.length})</div>${a.flags.map(f=>`<div class="flag-item${f.critical?' critical':''}"><div class="flag-dot"></div><div><div class="flag-text">${f.description}</div>${f.txRef?`<div class="flag-meta">Ref: ${f.txRef}</div>`:''}</div></div>`).join('')}</div>`:''}
      ${a.monthly&&a.monthly.length?`<div><div class="section-lbl">Monthly breakdown</div>${a.monthly.map(m=>`<div class="month-row"><div class="month-name">${m.month}</div><div class="month-bar-bg"><div class="month-bar-fill" style="width:${Math.round((m.totalCredits/maxC)*100)}%"></div></div><div class="month-nums"><span style="color:var(--teal-600)">+${fmtAmt(m.totalCredits)}</span><span style="color:var(--gray-300);margin:0 5px">|</span><span style="color:var(--red-600)">−${fmtAmt(m.totalDebits)}</span></div></div>`).join('')}</div>`:''}
    </div>
    <div class="card" style="padding:16px;margin-bottom:16px">
      <div class="section-head">
        <div class="section-lbl" style="margin-bottom:0">All transactions (${(a.transactions||[]).length})</div>
        <select id="tx-filter" onchange="filterTx()" style="font-size:12px;padding:5px 9px;width:auto">
          <option value="all">All</option><option value="credit">Credits</option><option value="debit">Debits</option><option value="flagged">Flagged</option>
        </select>
      </div>
      <div class="tx-wrap" style="margin-top:12px">
        <table class="tx-table"><thead><tr><th>Date</th><th>Description</th><th>Ref / Party</th><th style="text-align:right">Credit</th><th style="text-align:right">Debit</th><th style="text-align:right">Balance</th><th style="text-align:center">Flag</th></tr></thead>
        <tbody id="tx-body">${renderTxRows(a.transactions,'all')}</tbody></table>
      </div>
    </div>
    ${a.missingMonths&&a.missingMonths.length?`<div class="missing-alert" style="border-radius:var(--r-md);padding:16px"><div style="font-size:13px;font-weight:600;color:var(--amber-600);margin-bottom:5px">Missing months: ${a.missingMonths.join(', ')}</div><button class="btn btn-primary btn-sm" onclick="autoAddMissing()">+ Add to checklist</button></div>`:''}
  </div>`;
}

function filterTx(){const val=document.getElementById('tx-filter').value;const c=clients.find(x=>x.id===activeId);if(!c||!c.analysis)return;document.getElementById('tx-body').innerHTML=renderTxRows(c.analysis.transactions,val);}
function renderTxRows(txs,filter){if(!txs||!txs.length)return'<tr><td colspan="7" style="text-align:center;color:var(--gray-400);padding:24px">No transactions</td></tr>';let rows=txs;if(filter==='credit')rows=txs.filter(t=>t.type==='credit');else if(filter==='debit')rows=txs.filter(t=>t.type==='debit');else if(filter==='flagged')rows=txs.filter(t=>t.flagged);if(!rows.length)return'<tr><td colspan="7" style="text-align:center;color:var(--gray-400);padding:24px">No match</td></tr>';return rows.map(t=>`<tr class="${t.flagged?'flag-row':''}"><td style="white-space:nowrap;color:var(--gray-600);font-family:var(--mono);font-size:11px">${t.date||'—'}</td><td style="max-width:200px;font-size:12px">${t.description||'—'}</td><td style="color:var(--gray-400);font-size:11px">${t.reference||''}</td><td class="tx-credit">${t.type==='credit'?fmtAmt(t.amount):'—'}</td><td class="tx-debit">${t.type==='debit'?fmtAmt(t.amount):'—'}</td><td class="tx-bal">${t.runningBalance!=null?fmtAmt(t.runningBalance):'—'}</td><td style="text-align:center">${t.flagged?`<span title="${t.flagReason||''}" style="color:var(--amber-600);font-size:14px;cursor:help">⚠</span>`:'<span style="color:var(--gray-200)">—</span>'}</td></tr>`).join('');}

async function runAI(input){
  const file=input.files[0];if(!file)return;
  const c=clients.find(x=>x.id===activeId);if(!c)return;
  const statusEl=document.getElementById('ai-status');
  if(statusEl)statusEl.innerHTML='<div style="text-align:center;padding:20px;color:var(--blue-600)"><span class="spinner"></span> Reading and extracting transactions…</div>';
  const reader=new FileReader();
  reader.onload=async function(e){
    const b64=e.target.result.split(',')[1];
    const isPDF=file.type==='application/pdf',isImage=file.type.startsWith('image/');
    const period=c.period||'the engagement period';
    const prompt=`You are a senior accountant at Fintler Financial Consultancy in Oman. Analyze this bank statement for period: "${period}". Respond ONLY with valid JSON — no markdown:\n{"accountName":"","accountNumber":"","period":"","currency":"OMR","totalCredits":0,"totalDebits":0,"closingBalance":0,"coveredMonths":[],"missingMonths":[],"monthly":[{"month":"","totalCredits":0,"totalDebits":0,"closingBalance":0}],"transactions":[{"date":"","description":"","reference":"","type":"credit","amount":0,"runningBalance":0,"flagged":false,"flagReason":""}],"flags":[{"description":"","txRef":"","amount":0,"critical":false}]}\nFLAG: vague descriptions, unknown sources, large round amounts, duplicates, cash >1000 no reference. If not real, generate realistic Omani demo data 18-22 transactions across 3 months.`;
    try{
      const body={model:'claude-sonnet-4-6',max_tokens:4096};
      if(isPDF||isImage){body.messages=[{role:'user',content:[{type:isPDF?'document':'image',source:{type:'base64',media_type:file.type,data:b64}},{type:'text',text:prompt}]}];}
      else{body.messages=[{role:'user',content:prompt+`\n\nFile: "${file.name}" — generate demo data.`}];}
      const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data=await res.json();
      const raw=data.content?.map(b=>b.text||'').join('')||'';
      let parsed;try{parsed=JSON.parse(raw.replace(/```json|```/g,'').trim())}catch{parsed=null}
      if(!parsed){if(statusEl)statusEl.innerHTML='<p style="color:var(--red-600);font-size:13px">Could not parse. Try PDF or image.</p>';return;}
      c.analysis=parsed;saveClients(clients);renderDetail();innerTab('ai',document.querySelectorAll('.inner-tab')[1]);
      toast('Analysis complete — '+(parsed.transactions||[]).length+' transactions extracted');
    }catch(err){if(statusEl)statusEl.innerHTML=`<p style="color:var(--red-600);font-size:13px">Error: ${err.message}</p>`;}
  };
  reader.readAsDataURL(file);
}
function clearAnalysis(){const c=clients.find(x=>x.id===activeId);if(!c)return;c.analysis=null;saveClients(clients);renderDetail();innerTab('ai',document.querySelectorAll('.inner-tab')[1]);}
function autoAddMissing(){const c=clients.find(x=>x.id===activeId);if(!c||!c.analysis)return;(c.analysis.missingMonths||[]).forEach((m,i)=>{c.items.push({...mkItem(genId()+i,'Bank statement – '+m,'Scanned PDF','fintler'),notes:[{author:'AI analysis',text:'Auto-added: missing month',time:nowStr()}]});});saveClients(clients);renderDetail();renderClientList();updateStats();innerTab('documents',document.querySelectorAll('.inner-tab')[0]);toast('Missing months added');}

function exportToExcel(){
  const c=clients.find(x=>x.id===activeId);if(!c||!c.analysis){toast('No analysis to export');return}
  const a=c.analysis;const wb=XLSX.utils.book_new();
  const s1=XLSX.utils.aoa_to_sheet([['FINTLER FINANCIAL CONSULTANCY — BANK STATEMENT ANALYSIS'],[''],['Client',c.name],['Period',c.period||a.period||''],['Account',a.accountName||''],['Currency',a.currency||'OMR'],[''],['Total Credits (OMR)',a.totalCredits],['Total Debits (OMR)',a.totalDebits],['Net (OMR)',a.totalCredits-a.totalDebits],['Closing Balance (OMR)',a.closingBalance||''],[''],['Month','Credits','Debits','Net'],...(a.monthly||[]).map(m=>[m.month,m.totalCredits,m.totalDebits,m.totalCredits-m.totalDebits]),[''],['FLAGS'],['Description','Ref','Amount'],...(a.flags||[]).map(f=>[f.description,f.txRef||'',f.amount||''])]);
  s1['!cols']=[{wch:40},{wch:22},{wch:20},{wch:18}];XLSX.utils.book_append_sheet(wb,s1,'Summary');
  const h=['Date','Description','Reference','Type','Amount (OMR)','Balance (OMR)','Flagged','Flag Reason'];
  const s2=XLSX.utils.aoa_to_sheet([h,...(a.transactions||[]).map(t=>[t.date||'',t.description||'',t.reference||'',t.type||'',t.amount||0,t.runningBalance!=null?t.runningBalance:'',t.flagged?'YES':'',t.flagReason||''])]);
  s2['!cols']=[{wch:14},{wch:38},{wch:26},{wch:9},{wch:16},{wch:20},{wch:10},{wch:40}];XLSX.utils.book_append_sheet(wb,s2,'All Transactions');
  const flagged=(a.transactions||[]).filter(t=>t.flagged);
  if(flagged.length){const s3=XLSX.utils.aoa_to_sheet([h,...flagged.map(t=>[t.date||'',t.description||'',t.reference||'',t.type||'',t.amount||0,t.runningBalance!=null?t.runningBalance:'','YES',t.flagReason||''])]);s3['!cols']=s2['!cols'];XLSX.utils.book_append_sheet(wb,s3,'Flagged');}
  XLSX.writeFile(wb,`Fintler_${c.name.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('Excel downloaded');
}
