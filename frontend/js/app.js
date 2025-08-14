const API_BASE = 'http://192.168.4.251:3000'; // if frontend served from same origin, keep ''.
function api(path, opts = {}) {
  return fetch(API_BASE + '/api' + path, opts).then(async r => {
    const txt = await r.text();
    try { return { ok: r.ok, json: JSON.parse(txt), status: r.status }; } catch(e) { return { ok: r.ok, text: txt, status: r.status }; }
  });
}

let loadedJob = null;
let selectedWorkOrderId = null;

async function refreshJobList(filter = '', includeArchived = false) {
  const { json } = await api('/jobs?includeArchived=' + includeArchived);
  const sel = document.getElementById('jobsSelect');
  sel.innerHTML = '';
  json.jobs.filter(j => {
    const txt = `${j.job_number} ${j.job_name || ''}`.toLowerCase();
    return !filter || txt.includes(filter.toLowerCase());
  }).forEach(j => {
    const opt = document.createElement('option');
    opt.value = j.id;
    opt.textContent = `${j.job_number} — ${j.job_name || ''}${j.archived ? ' (archived)' : ''}`;
    sel.appendChild(opt);
  });
}

const viewArchivedEl = document.getElementById('viewArchived');
document.getElementById('loadJobs').addEventListener('click', () => refreshJobList(document.getElementById('filterJobs').value, viewArchivedEl.checked));
document.getElementById('filterJobs').addEventListener('input', (e) => refreshJobList(e.target.value, viewArchivedEl.checked));
viewArchivedEl.addEventListener('change', () => refreshJobList(document.getElementById('filterJobs').value, viewArchivedEl.checked));

document.getElementById('saveJob').addEventListener('click', async () => {
  const jobNumber = document.getElementById('jobNumber').value.trim();
  if (!jobNumber) return alert('Job Number required');
  const payload = {
    jobNumber,
    jobName: document.getElementById('jobName').value,
    pm: document.getElementById('pm').value,
    archived: document.getElementById('archived').checked
  };
  const res = await api('/jobs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) return alert('Save failed');
  loadedJob = { job: res.json.job, workOrders: [] };
  document.getElementById('jobId').value = res.json.job.id;
  alert('Saved');
  refreshJobList(document.getElementById('filterJobs').value, viewArchivedEl.checked);
});

document.getElementById('loadSelected').addEventListener('click', async () => {
  const sel = document.getElementById('jobsSelect');
  if (!sel.value) return alert('Select job');
  const r = await api('/jobs/' + encodeURIComponent(sel.value));
  if (!r.ok) return alert('Failed to load job');
  const data = r.json;
  loadedJob = data;
  selectedWorkOrderId = null;
  document.getElementById('jobId').value = data.job.id;
  document.getElementById('jobNumber').value = data.job.job_number || '';
  document.getElementById('jobName').value = data.job.job_name || '';
  document.getElementById('pm').value = data.job.pm || '';
  document.getElementById('archived').checked = !!data.job.archived;
  renderWorkOrders(data.workOrders);
  renderEntries([]);
});

document.getElementById('deleteSelected').addEventListener('click', async () => {
  const sel = document.getElementById('jobsSelect');
  if (!sel.value) return alert('Select job');
  if (!confirm('Delete job ' + sel.value + '?')) return;
  const r = await api('/jobs/' + encodeURIComponent(sel.value), { method: 'DELETE' });
  if (!r.ok) return alert('Delete failed');
  alert('Deleted');
  refreshJobList(document.getElementById('filterJobs').value, viewArchivedEl.checked);
  clearLoaded();
});

function clearLoaded() {
  loadedJob = null;
  selectedWorkOrderId = null;
  document.getElementById('workOrdersList').innerHTML = '';
  document.getElementById('entriesList').innerHTML = '';
  document.getElementById('jobNumber').value = '';
  document.getElementById('jobName').value = '';
  document.getElementById('pm').value = '';
  document.getElementById('jobId').value = '';
  document.getElementById('archived').checked = false;
}

function renderWorkOrders(workOrders = []) {
  const el = document.getElementById('workOrdersList');
  el.innerHTML = '';
  (workOrders || []).forEach(wo => {
    const item = document.createElement('div');
    item.className = 'item';
    const left = document.createElement('div');
    left.innerHTML = `<strong>WO ${wo.work_order}</strong>`;
    const right = document.createElement('div');
    const btn = document.createElement('button'); btn.textContent = 'Open';
    btn.onclick = () => { selectedWorkOrderId = wo.id; renderEntries(wo.entries); };
    right.appendChild(btn);
    item.appendChild(left); item.appendChild(right);
    el.appendChild(item);
  });
}

function renderEntries(entries = []) {
  const el = document.getElementById('entriesList');
  el.innerHTML = '';
  (entries || []).forEach((en, idx) => {
    const item = document.createElement('div');
    item.className = 'item';
    const left = document.createElement('div');
    left.innerHTML = `<strong>Entry ${idx + 1} (${en.handing})</strong>`;
    const details = document.createElement('div');
    details.className = 'muted';
    const frameInfo = en.frames && en.frames[0] ? Object.entries(en.frames[0].data || {}).slice(0,2).map(kv => kv.join(': ')).join(' — ') : '';
    let doorInfo = '';
    (en.doors || []).forEach(d => {
      doorInfo += `Door ${d.leaf}: ${Object.entries(d.data || {}).slice(0,2).map(kv => kv.join(': ')).join(' — ')}<br/>`;
    });
    details.innerHTML = `<div>Frame: ${frameInfo || '(no data)'}</div><div>${doorInfo}</div>`;
    left.appendChild(details);
    const right = document.createElement('div');
    if (en.frames && en.frames[0]) {
      const ef = document.createElement('button'); ef.textContent = 'Edit Frame'; ef.onclick = () => openModalForEdit('frame', en.frames[0]); right.appendChild(ef);
    }
    (en.doors || []).forEach(d => {
      const ed = document.createElement('button'); ed.textContent = `Edit Door ${d.leaf}`; ed.onclick = () => openModalForEdit('door', d); right.appendChild(ed);
    });
    item.appendChild(left); item.appendChild(right);
    el.appendChild(item);
  });
}

document.getElementById('addWorkOrder').addEventListener('click', async () => {
  const jobId = document.getElementById('jobId').value;
  const wo = document.getElementById('newWorkOrder').value.trim();
  if (!jobId || !wo) return alert('Job and work order required');
  const r = await api(`/jobs/${jobId}/work-orders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workOrder: wo }) });
  if (!r.ok) return alert('Failed to add work order');
  document.getElementById('newWorkOrder').value = '';
  const jobRes = await api('/jobs/' + jobId);
  if (jobRes.ok) {
    loadedJob = jobRes.json;
    renderWorkOrders(loadedJob.workOrders);
  }
});

document.getElementById('addEntry').addEventListener('click', async () => {
  if (!selectedWorkOrderId) return alert('Select a work order first');
  const handing = prompt('Handing (e.g. LHR, RHR, LHRA, RHRA):');
  if (!handing) return;
  const r = await api(`/work-orders/${selectedWorkOrderId}/entries`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ handing, entryData: {}, frameData: {}, doorData: {} }) });
  if (!r.ok) return alert('Failed to add entry');
  const jobId = document.getElementById('jobId').value;
  const jobRes = await api('/jobs/' + jobId);
  if (jobRes.ok) {
    loadedJob = jobRes.json;
    renderWorkOrders(loadedJob.workOrders);
    const wo = loadedJob.workOrders.find(w => w.id === selectedWorkOrderId);
    if (wo) renderEntries(wo.entries);
  }
});

// Modal for editing frame/door data
const modal = document.getElementById('modal');
const kvContainer = document.getElementById('kvContainer');
let modalMode = null;
function openModalForEdit(kind, serverRec) {
  modalMode = { kind, serverRec };
  kvContainer.innerHTML = '';
  const data = serverRec.data || {};
  Object.entries(data).forEach(([k, v]) => addKVrow(k, v));
  document.getElementById('modalTitle').textContent = 'Edit ' + kind;
  modal.style.display = 'flex';
}
function addKVrow(k = '', v = '') {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '8px';
  row.style.marginTop = '6px';
  const kInput = document.createElement('input'); kInput.placeholder = 'Field name'; kInput.value = k;
  const vInput = document.createElement('input'); vInput.placeholder = 'Value'; vInput.value = v;
  const rm = document.createElement('button'); rm.textContent = '✖'; rm.onclick = () => row.remove();
  row.appendChild(kInput); row.appendChild(vInput); row.appendChild(rm);
  kvContainer.appendChild(row);
}
document.getElementById('addKVbtn').addEventListener('click', () => addKVrow());
document.getElementById('modalCancel').addEventListener('click', () => { modal.style.display = 'none'; modalMode = null; });

document.getElementById('modalSave').addEventListener('click', async () => {
  if (!modalMode) return;
  const fields = {};
  kvContainer.querySelectorAll('div').forEach(row => {
    const inputs = row.querySelectorAll('input');
    if (inputs[0].value.trim()) fields[inputs[0].value.trim()] = inputs[1].value;
  });
  const endpoint = `/${modalMode.kind === 'frame' ? 'frames/' + modalMode.serverRec.id : 'doors/' + modalMode.serverRec.id}`;
  const r = await api(endpoint, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: fields }) });
  if (!r.ok) return alert('Failed to save');
  modal.style.display = 'none'; modalMode = null;
  const jobId = document.getElementById('jobId').value;
  if (jobId) {
    const jobRes = await api('/jobs/' + jobId);
    if (jobRes.ok) {
      loadedJob = jobRes.json;
      renderWorkOrders(loadedJob.workOrders);
      if (selectedWorkOrderId) {
        const wo = loadedJob.workOrders.find(w => w.id === selectedWorkOrderId);
        if (wo) renderEntries(wo.entries);
      }
    }
  }
});

async function exportJobToPDF(jobId) {
  const r = await api('/jobs/' + jobId);
  if (!r.ok) return alert('Failed to fetch job');
  const data = r.json;
  const job = data.job;
  const frames = [];
  const doors = [];
  (data.workOrders || []).forEach(wo => {
    (wo.entries || []).forEach(en => {
      frames.push(...(en.frames || []));
      doors.push(...(en.doors || []));
    });
  });
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 36;
  const startY = 48;
  const usableW = 612 - margin * 2;
  const lineH = 14;
  function writeKeyVals(obj, title) {
    doc.setFontSize(16);
    doc.text(title, margin, startY);
    doc.setFontSize(12);
    let y = startY + 26;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      doc.text('(no data)', margin, y);
      return;
    }
    for (const key of keys) {
      const label = `${key}: `;
      const value = obj[key] === null || obj[key] === undefined ? '' : String(obj[key]);
      const labelW = doc.getTextWidth(label);
      const split = doc.splitTextToSize(value, usableW - labelW - 6);
      doc.text(label, margin, y);
      doc.text(split, margin + labelW + 6, y);
      y += split.length * lineH + 6;
      if (y > 720) { doc.addPage(); y = startY; }
    }
  }
  const jobInfo = {
    'Job Number': job.job_number || '',
    'Job Name': job.job_name || '',
    'PM': job.pm || ''
  };
  writeKeyVals(jobInfo, 'Job Information');
  for (let i = 0; i < frames.length; i++) {
    doc.addPage();
    writeKeyVals(frames[i].data, `Frame ${i + 1}`);
  }
  for (let i = 0; i < doors.length; i++) {
    doc.addPage();
    writeKeyVals(doors[i].data, `Door ${i + 1}`);
  }
  const filename = `Job_${job.job_number || 'no-number'}.pdf`;
  doc.save(filename);
}

document.getElementById('exportPdfSelected').addEventListener('click', async () => {
  const sel = document.getElementById('jobsSelect');
  if (!sel.value) return alert('Select a job first');
  exportJobToPDF(sel.value);
});

document.getElementById('exportJsonDownload').addEventListener('click', async () => {
  const r = await api('/jobs?includeArchived=true');
  if (!r.ok) return alert('Failed');
  const json = r.json;
  const promises = json.jobs.map(j => api('/jobs/' + j.id));
  const results = await Promise.all(promises);
  const aggregated = {};
  results.forEach(res => { if (res.ok && res.json && res.json.job) aggregated[res.json.job.id] = res.json; });
  const blob = new Blob([JSON.stringify(aggregated, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'jobs_all.json'; a.click();
  URL.revokeObjectURL(url);
});

refreshJobList('', viewArchivedEl.checked);

const darkBtn = document.getElementById('toggleDarkMode');
if (darkBtn) {
  if (localStorage.getItem('darkMode') === '1') {
    document.body.classList.add('dark');
  }
  darkBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('darkMode', document.body.classList.contains('dark') ? '1' : '0');
  });
}
