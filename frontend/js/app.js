const API_BASE = ''; // if frontend served from same origin, keep ''. If server on different origin, put e.g. 'http://localhost:4000'
function api(path, opts = {}) {
  return fetch(API_BASE + '/api' + path, opts).then(async r => {
    const txt = await r.text();
    try { return { ok: r.ok, json: JSON.parse(txt), status: r.status }; } catch(e) { return { ok: r.ok, text: txt, status: r.status }; }
  });
}

/* UI helpers */
let loadedJob = null;

async function refreshJobList(filter='') {
  const { json } = await api('/jobs');
  const sel = document.getElementById('jobsSelect');
  sel.innerHTML = '';
  json.jobs.filter(j => {
    const txt = `${j.job_number} ${j.job_name || ''}`.toLowerCase();
    return !filter || txt.includes(filter.toLowerCase());
  }).forEach(j => {
    const opt = document.createElement('option');
    opt.value = j.job_number;
    opt.textContent = `${j.job_number} — ${j.job_name || ''}`;
    sel.appendChild(opt);
  });
}

document.getElementById('loadJobs').addEventListener('click', ()=> refreshJobList(document.getElementById('filterJobs').value));
document.getElementById('filterJobs').addEventListener('input', (e)=> refreshJobList(e.target.value));

document.getElementById('saveJob').addEventListener('click', async ()=>{
  const jobNumber = document.getElementById('jobNumber').value.trim();
  if (!jobNumber) return alert('Job Number required');
  const payload = {
    jobNumber,
    jobName: document.getElementById('jobName').value,
    pm: document.getElementById('pm').value,
    workOrder: document.getElementById('workOrder').value
  };
  const res = await api('/jobs', { method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) });
  if (!res.ok) return alert('Save failed');
  loadedJob = { job: res.json.job }; // minimal
  alert('Saved');
  refreshJobList();
});

/* load selected job */
document.getElementById('loadSelected').addEventListener('click', async ()=>{
  const sel = document.getElementById('jobsSelect');
  if (!sel.value) return alert('Select job');
  const r = await api('/jobs/' + encodeURIComponent(sel.value));
  if (!r.ok) return alert('Failed to load job');
  const data = r.json;
  loadedJob = data;
  // populate form
  document.getElementById('jobNumber').value = data.job.job_number || '';
  document.getElementById('jobName').value = data.job.job_name || '';
  document.getElementById('pm').value = data.job.pm || '';
  document.getElementById('workOrder').value = data.job.work_order || '';
  renderFrames(data.frames);
  renderDoors(data.doors);
});

/* delete selected job */
document.getElementById('deleteSelected').addEventListener('click', async ()=>{
  const sel = document.getElementById('jobsSelect');
  if (!sel.value) return alert('Select job');
  if (!confirm('Delete job ' + sel.value + '?')) return;
  const r = await api('/jobs/' + encodeURIComponent(sel.value), { method:'DELETE' });
  if (!r.ok) return alert('Delete failed');
  alert('Deleted');
  refreshJobList();
  clearLoaded();
});

function clearLoaded() {
  loadedJob = null;
  document.getElementById('framesList').innerHTML = '';
  document.getElementById('doorsList').innerHTML = '';
  document.getElementById('jobNumber').value = '';
  document.getElementById('jobName').value = '';
  document.getElementById('pm').value = '';
  document.getElementById('workOrder').value = '';
}

/* render lists */
function renderFrames(frames = []) {
  const el = document.getElementById('framesList');
  el.innerHTML = '';
  (frames || []).forEach((f, idx) => {
    const item = document.createElement('div');
    item.className = 'item';
    const left = document.createElement('div');
    left.innerHTML = `<strong>Frame ${idx+1}</strong><div class="muted">${Object.entries(f.data || f).slice(0,2).map(kv=>kv.join(': ')).join(' — ')}</div>`;
    const right = document.createElement('div');
    const edit = document.createElement('button'); edit.textContent='Edit'; edit.onclick = ()=> openModalForEdit('frame', f, idx);
    const del = document.createElement('button'); del.textContent='Delete'; del.onclick = ()=> deleteFrame(f);
    right.appendChild(edit); right.appendChild(del);
    item.appendChild(left); item.appendChild(right);
    el.appendChild(item);
  });
}
function renderDoors(doors = []) {
  const el = document.getElementById('doorsList');
  el.innerHTML = '';
  (doors || []).forEach((d, idx) => {
    const item = document.createElement('div');
    item.className = 'item';
    const left = document.createElement('div');
    left.innerHTML = `<strong>Door ${idx+1}</strong><div class="muted">${Object.entries(d.data || d).slice(0,2).map(kv=>kv.join(': ')).join(' — ')}</div>`;
    const right = document.createElement('div');
    const edit = document.createElement('button'); edit.textContent='Edit'; edit.onclick = ()=> openModalForEdit('door', d, idx);
    const del = document.createElement('button'); del.textContent='Delete'; del.onclick = ()=> deleteDoor(d);
    right.appendChild(edit); right.appendChild(del);
    item.appendChild(left); item.appendChild(right);
    el.appendChild(item);
  });
}

/* delete individual frame/door via server delete not implemented in server code above,
   so easiest approach: re-load job from server after deleting on server (you can add delete endpoints later).
   For now, we will warn and instruct user to use SQL or add endpoints. */
async function deleteFrame(frameRec) {
  if (!confirm('Delete this frame?')) return;
  const r = await api('/frames/' + frameRec.id, { method: 'DELETE' });
  if (!r.ok) return alert('Delete failed');
  const jobNumber = document.getElementById('jobNumber').value.trim();
  if (jobNumber) {
    const jobRes = await api('/jobs/' + encodeURIComponent(jobNumber));
    if (jobRes.ok) {
      loadedJob = jobRes.json;
      renderFrames(loadedJob.frames);
    }
  }
}
async function deleteDoor(doorRec) {
  if (!confirm('Delete this door?')) return;
  const r = await api('/doors/' + doorRec.id, { method: 'DELETE' });
  if (!r.ok) return alert('Delete failed');
  const jobNumber = document.getElementById('jobNumber').value.trim();
  if (jobNumber) {
    const jobRes = await api('/jobs/' + encodeURIComponent(jobNumber));
    if (jobRes.ok) {
      loadedJob = jobRes.json;
      renderDoors(loadedJob.doors);
    }
  }
}

/* Modal to add/edit custom KV object */
const modal = document.getElementById('modal');
const kvContainer = document.getElementById('kvContainer');
let modalMode = null; // { kind: 'frame'|'door', data: {...}, record: serverRecord if editing }
function openModal(kind) {
  modalMode = { kind, data: {} };
  kvContainer.innerHTML = '';
  document.getElementById('modalTitle').textContent = 'Add ' + kind;
  addKVrow('Location','');
  addKVrow('Notes','');
  modal.style.display = 'flex';
}
function openModalForEdit(kind, serverRec, idx) {
  modalMode = { kind, serverRec };
  kvContainer.innerHTML = '';
  const data = serverRec.data || serverRec;
  document.getElementById('modalTitle').textContent = 'Edit ' + kind;
  Object.entries(data).forEach(([k,v]) => addKVrow(k, v));
  modal.style.display = 'flex';
}
function addKVrow(k='', v='') {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '8px';
  row.style.marginTop = '6px';
  const kInput = document.createElement('input'); kInput.placeholder = 'Field name'; kInput.value = k;
  const vInput = document.createElement('input'); vInput.placeholder='Value'; vInput.value = v;
  const rm = document.createElement('button'); rm.textContent='✖'; rm.onclick = ()=> row.remove();
  row.appendChild(kInput); row.appendChild(vInput); row.appendChild(rm);
  kvContainer.appendChild(row);
}
document.getElementById('addKVbtn').addEventListener('click', ()=> addKVrow());
document.getElementById('modalCancel').addEventListener('click', ()=> { modal.style.display='none'; modalMode=null; });

/* save modal -> POST to server for single insert */
document.getElementById('modalSave').addEventListener('click', async ()=>{
  if (!modalMode) return;
  const kind = modalMode.kind;
  const jobNumber = document.getElementById('jobNumber').value.trim();
  if (!jobNumber) return alert('Job number required before adding items.');
  const fields = {};
  kvContainer.querySelectorAll('div').forEach(row => {
    const inputs = row.querySelectorAll('input');
    if (inputs[0].value.trim()) fields[inputs[0].value.trim()] = inputs[1].value;
  });

  const endpoint = `/${kind === 'frame' ? 'jobs/'+encodeURIComponent(jobNumber)+'/frames' : 'jobs/'+encodeURIComponent(jobNumber)+'/doors'}`;
  const r = await api(endpoint, { method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ data: fields }) });
  if (!r.ok) return alert('Failed to save');
  modal.style.display='none';
  // reload job to refresh lists
  const jobRes = await api('/jobs/' + encodeURIComponent(jobNumber));
  if (jobRes.ok) {
    loadedJob = jobRes.json;
    renderFrames(loadedJob.frames);
    renderDoors(loadedJob.doors);
  }
});

/* add frame/door buttons */
document.getElementById('addFrame').addEventListener('click', ()=> openModal('frame'));
document.getElementById('addDoor').addEventListener('click', ()=> openModal('door'));

/* CSV import buttons - upload file to server */
document.getElementById('importFramesBtn').addEventListener('click', async ()=>{
  const fileInput = document.getElementById('framesCsv');
  const file = fileInput.files[0];
  const jobNumber = document.getElementById('jobNumber').value.trim();
  if (!file) return alert('Select a CSV file');
  if (!jobNumber) return alert('Enter or select job number to import into.');
  const fd = new FormData();
  fd.append('file', file);
  const resp = await fetch(API_BASE + '/api/jobs/' + encodeURIComponent(jobNumber) + '/import-frames', { method:'POST', body: fd });
  const txt = await resp.text();
  if (!resp.ok) return alert('Import failed: ' + txt);
  alert('Frames imported');
  // refresh loaded job
  const jobRes = await api('/jobs/' + encodeURIComponent(jobNumber));
  if (jobRes.ok) {
    loadedJob = jobRes.json;
    renderFrames(loadedJob.frames);
  }
});

document.getElementById('importDoorsBtn').addEventListener('click', async ()=>{
  const fileInput = document.getElementById('doorsCsv');
  const file = fileInput.files[0];
  const jobNumber = document.getElementById('jobNumber').value.trim();
  if (!file) return alert('Select a CSV file');
  if (!jobNumber) return alert('Enter or select job number to import into.');
  const fd = new FormData();
  fd.append('file', file);
  const resp = await fetch(API_BASE + '/api/jobs/' + encodeURIComponent(jobNumber) + '/import-doors', { method:'POST', body: fd });
  const txt = await resp.text();
  if (!resp.ok) return alert('Import failed: ' + txt);
  alert('Doors imported');
  // refresh loaded job
  const jobRes = await api('/jobs/' + encodeURIComponent(jobNumber));
  if (jobRes.ok) {
    loadedJob = jobRes.json;
    renderDoors(loadedJob.doors);
  }
});

/* Export PDF: fetch job details then generate PDF using jsPDF
   Page 1: Job info
   Then one page per frame
   Then one page per door
*/
async function exportJobToPDF(jobNumber) {
  const r = await api('/jobs/' + encodeURIComponent(jobNumber));
  if (!r.ok) return alert('Failed to fetch job');
  const data = r.json;
  const job = data.job;
  const frames = data.frames || [];
  const doors = data.doors || [];

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:'pt', format:'letter'});
  const margin = 36;
  const startY = 48;
  const usableW = 612 - margin*2;
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

  // Page 1 job info
  const jobInfo = {
    'Job Number': job.job_number || '',
    'Job Name': job.job_name || '',
    'PM': job.pm || '',
    'Work Order #': job.work_order || ''
  };
  writeKeyVals(jobInfo, 'Job Information');

  // one page per frame
  for (let i=0;i<frames.length;i++) {
    doc.addPage();
    writeKeyVals(frames[i].data, `Frame ${i+1}`);
  }

  // one page per door
  for (let i=0;i<doors.length;i++) {
    doc.addPage();
    writeKeyVals(doors[i].data, `Door ${i+1}`);
  }

  const filename = `Job_${job.job_number || 'no-number'}.pdf`;
  doc.save(filename);
}

document.getElementById('exportPdfSelected').addEventListener('click', async ()=>{
  const sel = document.getElementById('jobsSelect');
  if (!sel.value) return alert('Select a job first');
  exportJobToPDF(sel.value);
});

/* Download all jobs raw JSON (convenience) */
document.getElementById('exportJsonDownload').addEventListener('click', async ()=>{
  const r = await api('/jobs');
  if (!r.ok) return alert('Failed');
  const json = r.json;
  // For simplicity fetch each job details
  const promises = json.jobs.map(j => api('/jobs/' + encodeURIComponent(j.job_number)));
  const results = await Promise.all(promises);
  const aggregated = {};
  results.forEach(res => {
    if (res.ok && res.json && res.json.job) {
      aggregated[res.json.job.job_number] = res.json;
    }
  });
  const blob = new Blob([JSON.stringify(aggregated, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'jobs_all.json'; a.click();
  URL.revokeObjectURL(url);
});

/* init */
refreshJobList();
