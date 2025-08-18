const API_ORIGIN = window.APP_CONFIG?.apiBase || window.location.origin;
const API_BASE = API_ORIGIN === window.location.origin ? '' : API_ORIGIN; // use relative paths when same origin
function api(path, opts = {}) {
  return fetch(API_BASE + '/api' + path, opts).then(async r => {
    const txt = await r.text();
    try { return { ok: r.ok, json: JSON.parse(txt), status: r.status }; } catch(e) { return { ok: r.ok, text: txt, status: r.status }; }
  });
}

let loadedJob = null;
let selectedWorkOrderId = null;
let editingEntry = null;

const jobModal = document.getElementById('jobModal');
const jobsTabBtn = document.getElementById('jobsTabBtn');
const workOrdersTabBtn = document.getElementById('workOrdersTabBtn');
const entriesTabBtn = document.getElementById('entriesTabBtn');
const jobsTab = document.getElementById('jobsTab');
const workOrdersTab = document.getElementById('workOrdersTab');
const entriesTab = document.getElementById('entriesTab');
const addEntryBtn = document.getElementById('addEntry');

function updateEntryButton() {
  addEntryBtn.disabled = !selectedWorkOrderId;
}

function showMainTab(tab) {
  jobsTab.style.display = tab === 'jobs' ? 'block' : 'none';
  workOrdersTab.style.display = tab === 'workorders' ? 'block' : 'none';
  entriesTab.style.display = tab === 'entries' ? 'block' : 'none';
  jobsTabBtn.classList.toggle('active', tab === 'jobs');
  workOrdersTabBtn.classList.toggle('active', tab === 'workorders');
  entriesTabBtn.classList.toggle('active', tab === 'entries');
}

jobsTabBtn.addEventListener('click', () => showMainTab('jobs'));
workOrdersTabBtn.addEventListener('click', () => showMainTab('workorders'));
entriesTabBtn.addEventListener('click', () => showMainTab('entries'));
showMainTab('jobs');
updateEntryButton();

function openJobModal() {
  jobModal.style.display = 'flex';
}

document.getElementById('jobModalClose').addEventListener('click', () => {
  jobModal.style.display = 'none';
});

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

const jobsSelectEl = document.getElementById('jobsSelect');
jobsSelectEl.addEventListener('change', async () => {
  const jobId = jobsSelectEl.value;
  if (jobId) {
    selectedWorkOrderId = null;
    await loadJob(jobId);
  } else {
    clearLoaded();
  }
});

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
  jobModal.style.display = 'none';
});

document.getElementById('addJob').addEventListener('click', () => {
  clearLoaded();
  openJobModal();
});

document.getElementById('editSelected').addEventListener('click', async () => {
  const sel = document.getElementById('jobsSelect');
  if (!sel.value) return alert('Select job');
  selectedWorkOrderId = null;
  const data = await loadJob(sel.value);
  if (data) openJobModal();
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
  updateEntryButton();
  editingEntry = null;
  document.getElementById('workOrdersList').innerHTML = '';
  document.getElementById('entriesList').innerHTML = '';
  document.getElementById('jobNumber').value = '';
  document.getElementById('jobName').value = '';
  document.getElementById('pm').value = '';
  document.getElementById('jobId').value = '';
  document.getElementById('archived').checked = false;
}

async function loadJob(id) {
  const r = await api('/jobs/' + encodeURIComponent(id));
  if (!r.ok) { alert('Failed to load job'); return null; }
  const data = r.json;
  loadedJob = data;
  const pmSelect = document.getElementById('pm');
  const pmValue = data.job.pm || '';
  if (!Array.from(pmSelect.options).some(o => o.value === pmValue)) {
    const opt = document.createElement('option');
    opt.value = pmValue;
    opt.textContent = pmValue;
    pmSelect.appendChild(opt);
  }
  document.getElementById('jobId').value = data.job.id;
  document.getElementById('jobNumber').value = data.job.job_number || '';
  document.getElementById('jobName').value = data.job.job_name || '';
  pmSelect.value = pmValue;
  document.getElementById('archived').checked = !!data.job.archived;
  if (!(data.workOrders || []).some(w => w.id === selectedWorkOrderId)) {
    selectedWorkOrderId = null;
  }
  renderWorkOrders(data.workOrders);
  if (selectedWorkOrderId) {
    const wo = data.workOrders.find(w => w.id === selectedWorkOrderId);
    renderEntries(wo ? wo.entries : []);
  } else {
    renderEntries([]);
  }
  updateEntryButton();
  return data;
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
      showMainTab('entries');
      updateEntryButton();
    };
    right.appendChild(openBtn);
    const editBtn = document.createElement('button'); editBtn.textContent = 'Edit';
    editBtn.onclick = async () => {
      const newWO = prompt('Edit work order', wo.work_order);
      if (!newWO) return;
      const r = await api(`/work-orders/${wo.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workOrder: newWO }) });
      if (!r.ok) return alert('Failed to update work order');
      await loadJob(document.getElementById('jobId').value);
    };
    right.appendChild(editBtn);
    const delBtn = document.createElement('button'); delBtn.textContent = 'Delete';
    delBtn.onclick = async () => {
      if (!confirm('Delete work order?')) return;
      const r = await api(`/work-orders/${wo.id}`, { method: 'DELETE' });
      if (!r.ok) return alert('Failed to delete work order');
      if (selectedWorkOrderId === wo.id) {
        selectedWorkOrderId = null;
      }
      await loadJob(document.getElementById('jobId').value);
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
      await loadJob(document.getElementById('jobId').value);
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
  await loadJob(jobId);
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

addEntryBtn.addEventListener('click', () => {
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
  await loadJob(jobId);
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
const topRailSelect = document.getElementById('topRailSelect');
const bottomRailSelect = document.getElementById('bottomRailSelect');
const hingeRailSelect = document.getElementById('hingeRailSelect');
const lockRailSelect = document.getElementById('lockRailSelect');
const hardwareTabBtn = document.getElementById('hardwareTabBtn');
const hardwareTab = document.getElementById('hardwareTab');
const hingingSelect = document.getElementById('hingingSelect');
const hingeSizeSelect = document.getElementById('hingeSizeSelect');
const hingeQtySelect = document.getElementById('hingeQtySelect');
const hingeDetails = document.getElementById('hingeDetails');
let modalMode = null;
let doorPartPresetsLoaded = false;
let partsCache = null;

function showModalTab(tab) {
  formulaTab.classList.toggle('active', tab === 'formula');
  globalTab.classList.toggle('active', tab === 'global');
  partsTab.classList.toggle('active', tab === 'parts');
  hardwareTab.classList.toggle('active', tab === 'hardware');
  formulaTabBtn.classList.toggle('active', tab === 'formula');
  globalTabBtn.classList.toggle('active', tab === 'global');
  partsTabBtn.classList.toggle('active', tab === 'parts');
  hardwareTabBtn.classList.toggle('active', tab === 'hardware');
}

formulaTabBtn.addEventListener('click', () => showModalTab('formula'));
partsTabBtn.addEventListener('click', () => showModalTab('parts'));
globalTabBtn.addEventListener('click', () => showModalTab('global'));
hardwareTabBtn.addEventListener('click', () => showModalTab('hardware'));

hingingSelect.addEventListener('change', () => {
  hingeDetails.style.display = hingingSelect.value === 'butt' ? '' : 'none';
});

function loadDoorPartPresets() {
  if (doorPartPresetsLoaded) return;
  doorPartPreset.innerHTML = '<option value=""></option>';
  (DOOR_PART_PRESETS || []).forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    doorPartPreset.appendChild(opt);
  });
  doorPartPresetsLoaded = true;
}

doorPartPreset.addEventListener('change', () => {
  const preset = (DOOR_PART_PRESETS || []).find(p => p.id === doorPartPreset.value);
  if (preset) {
    topRailSelect.value = preset.topRail || '';
    bottomRailSelect.value = preset.bottomRail || '';
    hingeRailSelect.value = preset.hingeRail || '';
    lockRailSelect.value = preset.lockRail || '';
  }
});

async function loadPartsCache() {
  if (partsCache) return partsCache;
  const res = await api('/parts');
  partsCache = res.ok
    ? (res.json.parts || []).map(p => ({
        ...p,
        number: p.part_type,
        usages: p.data?.uses || [],
        requires: p.data?.requires || []
      }))
    : [];
  return partsCache;
}

function populateRailSelect(selectEl, usage, current) {
  const parts = (partsCache || []).filter(p => (p.usages || []).includes(usage));
  selectEl.innerHTML = '<option value=""></option>';
  parts.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.number;
    opt.textContent = p.number;
    selectEl.appendChild(opt);
  });
  selectEl.value = current || '';
}

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
    hardwareTabBtn.style.display = '';
    hingingSelect.value = data.hinging || '';
    hingeSizeSelect.value = data.hingeSize || '4.5x4.5';
    hingeQtySelect.value = data.hingeQty || '3';
    hingeDetails.style.display = hingingSelect.value === 'butt' ? '' : 'none';
    showModalTab('formula');
  } else if (kind === 'door') {
    const excluded = ['parts', 'partPreset', 'topRail', 'bottomRail', 'hingeRail', 'lockRail', 'requiredParts'];
    entries = entries.filter(([k]) => !excluded.includes(k));
    modalTabs.style.display = 'flex';
    formulaTabBtn.style.display = '';
    globalTabBtn.style.display = 'none';
    partsTabBtn.style.display = '';
    hardwareTabBtn.style.display = 'none';
    loadDoorPartPresets();
    await loadPartsCache();
    doorPartPreset.value = data.partPreset || '';
    populateRailSelect(topRailSelect, 'topRail', data.topRail);
    populateRailSelect(bottomRailSelect, 'bottomRail', data.bottomRail);
    populateRailSelect(hingeRailSelect, 'hingeRail', data.hingeRail);
    populateRailSelect(lockRailSelect, 'lockRail', data.lockRail);
    showModalTab('formula');
  } else {
    modalTabs.style.display = 'none';
    hardwareTabBtn.style.display = 'none';
    showModalTab('formula');
  }
  entries.forEach(([k, v]) => addKVrow(k, v));
  document.getElementById('modalTitle').textContent = 'Edit ' + kind.charAt(0).toUpperCase() + kind.slice(1);
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
  let endpoint;
  let payload;
    if (modalMode.kind === 'frame') {
      endpoint = `/frames/${modalMode.serverRec.id}`;
      payload = { data: fields };
    } else if (modalMode.kind === 'door') {
      endpoint = `/doors/${modalMode.serverRec.id}`;
      fields.partPreset = doorPartPreset.value;
      fields.topRail = topRailSelect.value;
      fields.bottomRail = bottomRailSelect.value;
      fields.hingeRail = hingeRailSelect.value;
      fields.lockRail = lockRailSelect.value;
      const required = [];
      [topRailSelect, bottomRailSelect, hingeRailSelect, lockRailSelect].forEach(sel => {
        const part = (partsCache || []).find(p => p.number === sel.value);
        if (part && Array.isArray(part.requires)) required.push(...part.requires);
      });
      if (required.length) fields.requiredParts = required;
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
    data.hinging = hingingSelect.value;
    if (hingingSelect.value === 'butt') {
      data.hingeSize = hingeSizeSelect.value;
      data.hingeQty = hingeQtySelect.value;
    }
    Object.keys(fields).forEach(k => { data[k] = fields[k]; });
    payload = { handing: modalMode.serverRec.handing, data };
  }
  const r = await api(endpoint, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  if (!r.ok) return alert('Failed to save');

  if (modalMode.kind === 'entry' && hingingSelect.value === 'butt') {
    const qty = parseInt(hingeQtySelect.value, 10) || 0;
    const locs = ['3.125', '12.789', '25.987', '39.567'];
    const hingeVars = {};
    for (let i = 0; i < qty && i < locs.length; i++) {
      hingeVars[`h${i + 1}`] = locs[i];
    }
    const frameUpdates = (modalMode.serverRec.frames || []).map(fr => {
      const data = { ...(fr.data || {}), ...hingeVars };
      return api(`/frames/${fr.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data }) });
    });
    const doorUpdates = (modalMode.serverRec.doors || []).map(dr => {
      const data = { ...(dr.data || {}), ...hingeVars };
      return api(`/doors/${dr.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data }) });
    });
    await Promise.all([...frameUpdates, ...doorUpdates]);
  }

  modal.style.display = 'none'; modalMode = null;
  const jobId = document.getElementById('jobId').value;
  if (jobId) await loadJob(jobId);
});

async function exportJobToPDF(jobId, workOrderId, printType = 'review') {
  const r = await api('/jobs/' + jobId);
  if (!r.ok) return alert('Failed to fetch job');
  const data = r.json;
  let workOrders = data.workOrders || [];
  let currentWO = null;
  if (workOrderId) {
    currentWO = workOrders.find(w => w.id === workOrderId);
    if (!currentWO) return alert('Work order not found');
    workOrders = [currentWO];
  }
  const job = data.job;
  const frames = [];
  const doors = [];
  const entries = [];
  workOrders.forEach(wo => {
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
  if (currentWO) jobInfo['Work Order'] = currentWO.work_order || '';
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
  const tagText = `${printType === 'production' ? 'Production' : 'Review'} - ${new Date().toLocaleString()}`;
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.text(tagText, margin, 792 - 20);
  }
  const filename = currentWO
    ? `Job_${job.job_number || 'no-number'}_WO_${currentWO.work_order || 'unknown'}.pdf`
    : `Job_${job.job_number || 'no-number'}.pdf`;
  if (printType === 'production') {
    const blob = doc.output('blob');
    fetch(API_BASE + `/api/work-orders/${workOrderId}/pdf`, {
      method: 'POST',
      headers: { 'content-type': 'application/pdf', 'x-print-tag': 'production' },
      body: blob
    }).catch(err => console.error('Failed to save production PDF', err));
  }
  doc.save(filename);
}

document.getElementById('exportPdfWorkOrder').addEventListener('click', () => {
  if (!loadedJob || !loadedJob.job) return alert('No job loaded');
  if (!selectedWorkOrderId) return alert('Select a work order first');
  const isProduction = confirm('Is this a production print? Click OK for Production, Cancel for Review.');
  exportJobToPDF(loadedJob.job.id, selectedWorkOrderId, isProduction ? 'production' : 'review');
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
