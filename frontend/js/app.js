const API_BASE = 'http://192.168.4.251:3000'; // if frontend served from same origin, keep ''.
function api(path, opts = {}) {
  return fetch(API_BASE + '/api' + path, opts).then(async r => {
    const txt = await r.text();
    try { return { ok: r.ok, json: JSON.parse(txt), status: r.status }; } catch(e) { return { ok: r.ok, text: txt, status: r.status }; }
  });
}

let loadedJob = null;
let selectedWorkOrderId = null;
let editingEntry = null;

let projectManagers = [];

const DEFAULT_GLOBALS = {
  topGap: '.125',
  bottomGap: '.6875',
  hingeGap: '.0625',
  strikeGap: '.125'
};

async function loadProjectManagers() {
  try {
    const res = await api('/project-managers');
    if (!res.ok) throw new Error(res.status);
    projectManagers = res.json.managers || [];
    const pmSelect = document.getElementById('pm');
    pmSelect.innerHTML = '<option value=""></option>';
    projectManagers.forEach(pm => {
      const name = pm.name || pm;
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      pmSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed to load project managers', err);
  }
}

loadProjectManagers();

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
  const pmSelect = document.getElementById('pm');
  const pmValue = data.job.pm || '';
  if (!Array.from(pmSelect.options).some(o => o.value === pmValue)) {
    const opt = document.createElement('option');
    opt.value = pmValue;
    opt.textContent = pmValue;
    pmSelect.appendChild(opt);
  }
  pmSelect.value = pmValue;
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
  editingEntry = null;
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
    if (selectedWorkOrderId === wo.id) {
      item.classList.add('active');
    } else if (selectedWorkOrderId !== null) {
      item.classList.add('inactive');
    }
    const left = document.createElement('div');
    left.innerHTML = `<strong>WO ${wo.work_order}</strong>`;
    const right = document.createElement('div');
    const openBtn = document.createElement('button'); openBtn.textContent = 'Open';
    openBtn.onclick = () => {
      selectedWorkOrderId = wo.id;
      renderWorkOrders(loadedJob.workOrders);
      renderEntries(wo.entries);
    };
    right.appendChild(openBtn);
    const editBtn = document.createElement('button'); editBtn.textContent = 'Edit';
    editBtn.onclick = async () => {
      const newWO = prompt('Edit work order', wo.work_order);
      if (!newWO) return;
      const r = await api(`/work-orders/${wo.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workOrder: newWO }) });
      if (!r.ok) return alert('Failed to update work order');
      const jobRes = await api('/jobs/' + document.getElementById('jobId').value);
      if (jobRes.ok) {
        loadedJob = jobRes.json;
        renderWorkOrders(loadedJob.workOrders);
        const w = loadedJob.workOrders.find(w => w.id === selectedWorkOrderId);
        if (w) renderEntries(w.entries); else renderEntries([]);
      }
    };
    right.appendChild(editBtn);
    const delBtn = document.createElement('button'); delBtn.textContent = 'Delete';
    delBtn.onclick = async () => {
      if (!confirm('Delete work order?')) return;
      const r = await api(`/work-orders/${wo.id}`, { method: 'DELETE' });
      if (!r.ok) return alert('Failed to delete work order');
      if (selectedWorkOrderId === wo.id) {
        selectedWorkOrderId = null;
        renderEntries([]);
      }
      const jobRes = await api('/jobs/' + document.getElementById('jobId').value);
      if (jobRes.ok) {
        loadedJob = jobRes.json;
        renderWorkOrders(loadedJob.workOrders);
      }
    };
    right.appendChild(delBtn);
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
    const label = en.data && en.data.tag ? en.data.tag : `Entry ${idx + 1}`;
    left.innerHTML = `<strong>${label} (${en.handing})</strong>`;
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
    const ee = document.createElement('button'); ee.textContent = 'Edit Entry'; ee.onclick = () => openEntryModal(en); right.appendChild(ee);
    const ev = document.createElement('button'); ev.textContent = 'Edit Entry Data'; ev.onclick = () => openModalForEdit('entry', en); right.appendChild(ev);
    const ep = document.createElement('button'); ep.textContent = 'Edit Parts'; ep.onclick = () => openPartsModal(en); right.appendChild(ep);
    const del = document.createElement('button'); del.textContent = 'Delete';
    del.onclick = async () => {
      if (!confirm('Delete entry?')) return;
      const r = await api(`/entries/${en.id}`, { method: 'DELETE' });
      if (!r.ok) return alert('Failed to delete entry');
      const jobId = document.getElementById('jobId').value;
      const jobRes = await api('/jobs/' + jobId);
      if (jobRes.ok) {
        loadedJob = jobRes.json;
        renderWorkOrders(loadedJob.workOrders);
        const wo = loadedJob.workOrders.find(w => w.id === selectedWorkOrderId);
        if (wo) renderEntries(wo.entries); else renderEntries([]);
      }
    };
    right.appendChild(del);
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

const addEntryModal = document.getElementById('addEntryModal');
const addEntryTag = document.getElementById('entryTagInput');
const addEntryHanding = document.getElementById('entryHandingInput');
const addEntryWidth = document.getElementById('entryWidthInput');
const addEntryHeight = document.getElementById('entryHeightInput');

function openEntryModal(entry = null) {
  editingEntry = entry;
  addEntryModal.querySelector('h3').textContent = entry ? 'Edit Entry' : 'Add Entry';
  if (entry) {
    addEntryTag.value = (entry.data && entry.data.tag) || '';
    addEntryHanding.value = entry.handing || 'LHR';
    addEntryWidth.value = (entry.data && entry.data.openingWidth) || "3'0\"";
    addEntryHeight.value = (entry.data && entry.data.openingHeight) || "7'0\"";
  } else {
    addEntryTag.value = '';
    addEntryHanding.value = 'LHR';
    addEntryWidth.value = "3'0\"";
    addEntryHeight.value = "7'0\"";
  }
  addEntryModal.style.display = 'flex';
}

document.getElementById('addEntry').addEventListener('click', () => {
  if (!selectedWorkOrderId) return alert('Select a work order first');
  openEntryModal();
});

document.getElementById('addEntryModalCancel').addEventListener('click', () => {
  addEntryModal.style.display = 'none';
  editingEntry = null;
});

document.getElementById('addEntryModalSave').addEventListener('click', async () => {
  if (!selectedWorkOrderId) return;
  const tag = addEntryTag.value.trim();
  const handing = addEntryHanding.value;
  const width = addEntryWidth.value.trim() || "3'0\"";
  const height = addEntryHeight.value.trim() || "7'0\"";
  let r;
  if (editingEntry) {
    r = await api(`/entries/${editingEntry.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handing, data: { tag, openingWidth: width, openingHeight: height } })
    });
  } else {
    r = await api(`/work-orders/${selectedWorkOrderId}/entries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handing, entryData: { tag, openingWidth: width, openingHeight: height }, frameData: {}, doorData: {} })
    });
  }
  if (!r.ok) return alert('Failed to save entry');
  addEntryModal.style.display = 'none';
  editingEntry = null;
  addEntryTag.value = '';
  addEntryHanding.value = 'LHR';
  addEntryWidth.value = "3'0\"";
  addEntryHeight.value = "7'0\"";
  const jobId = document.getElementById('jobId').value;
  const jobRes = await api('/jobs/' + jobId);
  if (jobRes.ok) {
    loadedJob = jobRes.json;
    renderWorkOrders(loadedJob.workOrders);
    const wo = loadedJob.workOrders.find(w => w.id === selectedWorkOrderId);
    if (wo) renderEntries(wo.entries);
  }
});

// Modal for selecting door/frame edits
const partsModal = document.getElementById('partsModal');
const partsContainer = document.getElementById('partsContainer');
document.getElementById('partsModalClose').addEventListener('click', () => {
  partsModal.style.display = 'none';
});

function openPartsModal(entry) {
  partsContainer.innerHTML = '';
  if (entry.frames && entry.frames[0]) {
    const ef = document.createElement('button');
    ef.textContent = 'Edit Frame';
    ef.onclick = () => { partsModal.style.display = 'none'; openModalForEdit('frame', entry.frames[0]); };
    partsContainer.appendChild(ef);
  }
  (entry.doors || []).forEach(d => {
    const ed = document.createElement('button');
    ed.textContent = `Edit Door ${d.leaf}`;
    ed.onclick = () => { partsModal.style.display = 'none'; openModalForEdit('door', d); };
    partsContainer.appendChild(ed);
  });
  partsModal.style.display = 'flex';
}

// Modal for editing entry/frame/door data
const modal = document.getElementById('modal');
const kvContainer = document.getElementById('kvContainer');
const modalTabs = document.getElementById('modalTabs');
const formulaTabBtn = document.getElementById('formulaTabBtn');
const globalTabBtn = document.getElementById('globalTabBtn');
const partsTabBtn = document.getElementById("partsTabBtn");
const formulaTab = document.getElementById('formulaTab');
const globalTab = document.getElementById('globalTab');
const partsTab = document.getElementById("partsTab");
const topGapInput = document.getElementById('topGapInput');
const bottomGapInput = document.getElementById('bottomGapInput');
const hingeGapInput = document.getElementById('hingeGapInput');
const strikeGapInput = document.getElementById('strikeGapInput');
const doorPartPreset = document.getElementById("doorPartPreset");
const doorPartsList = document.getElementById("doorPartsList");
const addDoorPartBtn = document.getElementById("addDoorPart");
const toggleHorizontalMidrail = document.getElementById("toggleHorizontalMidrail");
const toggleVerticalMidrail = document.getElementById("toggleVerticalMidrail");
let modalMode = null;
let doorPartTemplates = [];
const PART_TYPES = ["Top Rail","Bottom Rail","Hinge Stile","Lock Stile","Int Glass Stop","Ext Glass Stop","Horizontal Midrail","Vertical Midrail"];

function showModalTab(tab) {
  formulaTab.classList.toggle('active', tab === 'formula');
  globalTab.classList.toggle('active', tab === 'global');
  partsTab.classList.toggle('active', tab === 'parts');
  formulaTabBtn.classList.toggle('active', tab === 'formula');
  globalTabBtn.classList.toggle('active', tab === 'global');
  partsTabBtn.classList.toggle('active', tab === 'parts');
}

formulaTabBtn.addEventListener('click', () => showModalTab('formula'));
partsTabBtn.addEventListener('click', () => showModalTab('parts'));
globalTabBtn.addEventListener('click', () => showModalTab('global'));
async function openModalForEdit(kind, serverRec) {
  modalMode = { kind, serverRec };
  kvContainer.innerHTML = '';
  const data = serverRec.data || {};
  let entries = Object.entries(data);
  if (kind === 'entry') {
    const excluded = ['tag', 'openingWidth', 'openingHeight', 'topGap', 'bottomGap', 'hingeGap', 'strikeGap'];
    entries = entries.filter(([k]) => !excluded.includes(k));
    topGapInput.value = data.topGap !== undefined ? data.topGap : DEFAULT_GLOBALS.topGap;
    bottomGapInput.value = data.bottomGap !== undefined ? data.bottomGap : DEFAULT_GLOBALS.bottomGap;
    hingeGapInput.value = data.hingeGap !== undefined ? data.hingeGap : DEFAULT_GLOBALS.hingeGap;
    strikeGapInput.value = data.strikeGap !== undefined ? data.strikeGap : DEFAULT_GLOBALS.strikeGap;
    modalTabs.style.display = 'flex';
    formulaTabBtn.style.display = '';
    globalTabBtn.style.display = '';
    partsTabBtn.style.display = 'none';
    showModalTab('formula');
  } else if (kind === 'door') {
    const excluded = ['parts', 'partPreset'];
    entries = entries.filter(([k]) => !excluded.includes(k));
    modalTabs.style.display = 'flex';
    formulaTabBtn.style.display = '';
    globalTabBtn.style.display = 'none';
    partsTabBtn.style.display = '';
    await loadDoorPartTemplates();
    doorPartPreset.value = data.partPreset || '';
    doorPartsList.innerHTML = '';
    (data.parts || []).forEach(p => addPartRow(p));
    updateMidrailCheckboxes();
    showModalTab('formula');
  } else {
    modalTabs.style.display = 'none';
    showModalTab('formula');
  }
  entries.forEach(([k, v]) => addKVrow(k, v));
  document.getElementById('modalTitle').textContent = 'Edit ' + kind.charAt(0).toUpperCase() + kind.slice(1);
  modal.style.display = 'flex';
}

async function loadDoorPartTemplates() {
  if (doorPartTemplates.length) return;
  const r = await api('/door-part-templates');
  if (r.ok) {
    doorPartTemplates = r.json.templates || r.json || [];
    doorPartPreset.innerHTML = '<option value=""></option>';
    doorPartTemplates.forEach(t => {
      const opt = document.createElement('option');
      const val = t.id || t.name || t.label || '';
      opt.value = val;
      opt.textContent = t.name || t.label || t.id || val;
      opt.dataset.parts = JSON.stringify(t.parts || []);
      doorPartPreset.appendChild(opt);
    });
  }
}

function addPartRow(part = { type: 'Top Rail', Part_LZ: '', Part_LY: '' }) {
  const row = document.createElement('div');
  row.className = 'part-row';
  const sel = document.createElement('select');
  PART_TYPES.forEach(pt => {
    const opt = document.createElement('option');
    opt.value = pt;
    opt.textContent = pt;
    sel.appendChild(opt);
  });
  sel.value = part.type || 'Top Rail';
  const lz = document.createElement('input');
  lz.type = 'number';
  lz.step = 'any';
  lz.value = part.Part_LZ || '';
  const ly = document.createElement('input');
  ly.type = 'number';
  ly.step = 'any';
  ly.value = part.Part_LY || '';
  const rm = document.createElement('button');
  rm.textContent = '✖';
  rm.onclick = () => { row.remove(); updateMidrailCheckboxes(); };
  row.appendChild(sel);
  row.appendChild(lz);
  row.appendChild(ly);
  row.appendChild(rm);
  doorPartsList.appendChild(row);
  updateMidrailCheckboxes();
}

function updateMidrailCheckboxes() {
  const types = Array.from(doorPartsList.querySelectorAll('select')).map(s => s.value);
  toggleHorizontalMidrail.checked = types.includes('Horizontal Midrail');
  toggleVerticalMidrail.checked = types.includes('Vertical Midrail');
}

doorPartPreset.addEventListener('change', () => {
  const opt = doorPartPreset.options[doorPartPreset.selectedIndex];
  const parts = opt && opt.dataset.parts ? JSON.parse(opt.dataset.parts) : [];
  doorPartsList.innerHTML = '';
  parts.forEach(p => addPartRow(p));
  updateMidrailCheckboxes();
});

addDoorPartBtn.addEventListener('click', () => { addPartRow(); });

toggleHorizontalMidrail.addEventListener('change', () => {
  if (toggleHorizontalMidrail.checked) {
    addPartRow({ type: 'Horizontal Midrail' });
  } else {
    Array.from(doorPartsList.querySelectorAll('.part-row')).forEach(r => {
      if (r.querySelector('select').value === 'Horizontal Midrail') r.remove();
    });
  }
  updateMidrailCheckboxes();
});

toggleVerticalMidrail.addEventListener('change', () => {
  if (toggleVerticalMidrail.checked) {
    addPartRow({ type: 'Vertical Midrail' });
  } else {
    Array.from(doorPartsList.querySelectorAll('.part-row')).forEach(r => {
      if (r.querySelector('select').value === 'Vertical Midrail') r.remove();
    });
  }
  updateMidrailCheckboxes();
});

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
  let endpoint;
  let payload;
    if (modalMode.kind === 'frame') {
      endpoint = `/frames/${modalMode.serverRec.id}`;
      payload = { data: fields };
    } else if (modalMode.kind === 'door') {
      endpoint = `/doors/${modalMode.serverRec.id}`;
      fields.partPreset = doorPartPreset.value;
      const parts = [];
      doorPartsList.querySelectorAll('.part-row').forEach(row => {
        const sel = row.querySelector('select').value;
        const inputs = row.querySelectorAll('input');
        parts.push({ type: sel, Part_LZ: inputs[0].value, Part_LY: inputs[1].value });
      });
      fields.parts = parts;
      payload = { data: fields };
    } else if (modalMode.kind === 'entry') {
    endpoint = `/entries/${modalMode.serverRec.id}`;
    const original = modalMode.serverRec.data || {};
    const preservedKeys = ['tag', 'openingWidth', 'openingHeight', 'topGap', 'bottomGap', 'hingeGap', 'strikeGap'];
    const preserved = {};
    preservedKeys.forEach(k => {
      if (original[k] !== undefined) preserved[k] = original[k];
    });
    const data = { ...preserved };
    data.topGap = topGapInput.value || DEFAULT_GLOBALS.topGap;
    data.bottomGap = bottomGapInput.value || DEFAULT_GLOBALS.bottomGap;
    data.hingeGap = hingeGapInput.value || DEFAULT_GLOBALS.hingeGap;
    data.strikeGap = strikeGapInput.value || DEFAULT_GLOBALS.strikeGap;
    Object.keys(fields).forEach(k => { data[k] = fields[k]; });
    payload = { handing: modalMode.serverRec.handing, data };
  }
  const r = await api(endpoint, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
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
  const entries = [];
  (data.workOrders || []).forEach(wo => {
    (wo.entries || []).forEach(en => {
      entries.push(en);
      (en.frames || []).forEach(fr => frames.push({ frame: fr, entry: en.data || {} }));
      (en.doors || []).forEach(dr => doors.push({ door: dr, entry: en.data || {} }));
    });
  });
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 36;
  const startY = 48;
  const usableW = 612 - margin * 2;
  const lineH = 14;
  function writeKeyVals(obj, title, startYPos = startY) {
    doc.setFontSize(16);
    doc.text(title, margin, startYPos);
    doc.setFontSize(12);
    let y = startYPos + 26;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      doc.text('(no data)', margin, y);
      return y + lineH;
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
    return y;
  }
  const jobInfo = {
    'Job Number': job.job_number || '',
    'Job Name': job.job_name || '',
    'PM': job.pm || ''
  };
  let y = writeKeyVals(jobInfo, 'Job Information', startY);
  const entrySummary = {};
  entries.forEach((en, idx) => {
    const label = en.data && en.data.tag ? en.data.tag : `Entry ${idx + 1}`;
    entrySummary[label] = en.handing || '';
  });
  y += 20;
  writeKeyVals(entrySummary, 'Entries', y);
  const imgW = 200; const imgH = 150; const imgX = (612 - imgW) / 2;
  for (let i = 0; i < frames.length; i++) {
    doc.addPage();
    doc.rect(imgX, startY, imgW, imgH);
    doc.setFontSize(12);
    doc.text('Frame Image Placeholder', 306, startY + imgH / 2, { align: 'center', baseline: 'middle' });
    let y2 = startY + imgH + 40;
    y2 = writeKeyVals(frames[i].entry, 'Entry', y2);
    y2 += 20;
    writeKeyVals(frames[i].frame.data, `Frame ${i + 1}`, y2);
  }
  for (let i = 0; i < doors.length; i++) {
    doc.addPage();
    doc.rect(imgX, startY, imgW, imgH);
    doc.setFontSize(12);
    doc.text('Door Image Placeholder', 306, startY + imgH / 2, { align: 'center', baseline: 'middle' });
    let y2 = startY + imgH + 40;
    y2 = writeKeyVals(doors[i].entry, 'Entry', y2);
    y2 += 20;
    const doorLabel = doors[i].door.leaf ? `Door ${doors[i].door.leaf}` : `Door ${i + 1}`;
    writeKeyVals(doors[i].door.data, doorLabel, y2);
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
    document.body
  }
  darkBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('darkMode', document.body.classList.contains('dark') ? '1' : '0');
  });
}