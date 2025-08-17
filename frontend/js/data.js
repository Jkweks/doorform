const API_ORIGIN = window.APP_CONFIG?.apiBase || window.location.origin;
const API_BASE = API_ORIGIN === window.location.origin ? '' : API_ORIGIN; // same base as main app
function api(path, opts = {}) {
  return fetch(API_BASE + '/api' + path, opts).then(async r => {
    const txt = await r.text();
    try { return { ok: r.ok, json: JSON.parse(txt), status: r.status }; } catch(e) { return { ok: r.ok, text: txt, status: r.status }; }
  });
}

let partsCache = [];
const topRailSelect = document.getElementById('newTopRail');
const bottomRailSelect = document.getElementById('newBottomRail');
const hingeRailSelect = document.getElementById('newHingeRail');
const lockRailSelect = document.getElementById('newLockRail');
const partsSelect = document.getElementById('partsSelect');
const partModal = document.getElementById('partModal');
const partModalClose = document.getElementById('closePartModal');

// Tabs for maintenance sections
for (const btn of document.querySelectorAll('#dataTabs button')) {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#dataTabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
}


function populateRailSelect(selectEl, current) {
  const parts = partsCache || [];
  selectEl.innerHTML = '<option value=""></option>';
  parts.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.part_type;
    opt.textContent = p.part_type;
    selectEl.appendChild(opt);
  });
  if (current) selectEl.value = current;
}
async function loadProjectManagers() {
  const res = await api('/project-managers');
  if (res.ok) renderProjectManagers(res.json.managers || []);
}
function renderProjectManagers(managers) {
  const list = document.getElementById('pmList');
  list.innerHTML = '';
  (managers || []).forEach(pm => {
    const item = document.createElement('div');
    item.className = 'item';
    const left = document.createElement('div');
    left.textContent = pm.name;
    const right = document.createElement('div');
    const edit = document.createElement('button');
    edit.textContent = 'Edit';
    edit.onclick = () => {
      const name = prompt('Project manager name', pm.name);
      if (!name) return;
      api(`/project-managers/${pm.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) }).then(loadProjectManagers);
    };
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.onclick = () => {
      if (!confirm('Delete ' + pm.name + '?')) return;
      api(`/project-managers/${pm.id}`, { method: 'DELETE' }).then(loadProjectManagers);
    };
    right.appendChild(edit); right.appendChild(del);
    item.appendChild(left); item.appendChild(right);
    list.appendChild(item);
  });
}
document.getElementById('addPm').onclick = async () => {
  const name = document.getElementById('newPmName').value.trim();
  if (!name) return;
  await api('/project-managers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
  document.getElementById('newPmName').value = '';
  loadProjectManagers();
};
async function loadTemplates() {
  const res = await api('/door-part-templates');
  if (res.ok) renderTemplates(res.json.templates || []);
}
function renderTemplates(templates) {
  const list = document.getElementById('templateList');
  list.innerHTML = '';
  (templates || []).forEach(t => {
    const item = document.createElement('div');
    item.className = 'item';
    const left = document.createElement('div');
    const partsDesc = Object.entries(t.parts || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
    left.innerHTML = `<strong>${t.name}</strong>${partsDesc ? ' — ' + partsDesc : ''}`;
    const right = document.createElement('div');
    const edit = document.createElement('button');
    edit.textContent = 'Edit';
    edit.onclick = () => {
      const name = prompt('Template name', t.name);
      if (name === null) return;
      const partsStr = prompt('Parts JSON', JSON.stringify(t.parts));
      if (partsStr === null) return;
      let parts;
      try { parts = JSON.parse(partsStr); } catch (e) { return alert('Invalid JSON'); }
      api(`/door-part-templates/${t.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, parts }) }).then(loadTemplates);
    };
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.onclick = () => {
      if (!confirm('Delete template ' + t.name + '?')) return;
      api(`/door-part-templates/${t.id}`, { method: 'DELETE' }).then(loadTemplates);
    };
    right.appendChild(edit); right.appendChild(del);
    item.appendChild(left); item.appendChild(right);
    list.appendChild(item);
  });
}
document.getElementById('addTemplate').onclick = async () => {
  const name = document.getElementById('newTemplateName').value.trim();
  if (!name) return;
  const parts = {};
  if (topRailSelect.value) parts.topRail = topRailSelect.value;
  if (bottomRailSelect.value) parts.bottomRail = bottomRailSelect.value;
  if (hingeRailSelect.value) parts.hingeRail = hingeRailSelect.value;
  if (lockRailSelect.value) parts.lockRail = lockRailSelect.value;
  await api('/door-part-templates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, parts }) });
  document.getElementById('newTemplateName').value = '';
  topRailSelect.value = '';
  bottomRailSelect.value = '';
  hingeRailSelect.value = '';
  lockRailSelect.value = '';
  loadTemplates();
};

loadProjectManagers();
loadTemplates();
loadParts();

async function loadParts() {
  const res = await api('/parts');
  if (res.ok) {
    partsCache = res.json.parts || [];
    renderParts(partsCache);
    populateRailSelect(topRailSelect);
    populateRailSelect(bottomRailSelect);
    populateRailSelect(hingeRailSelect);
    populateRailSelect(lockRailSelect);
  }
}

function renderParts(parts) {
  partsSelect.innerHTML = '';
  (parts || []).forEach(p => {
    const opt = document.createElement('option');
    const dims = (p.part_lz || p.part_ly) ? ` (${p.part_lz || ''}x${p.part_ly || ''})` : '';
    opt.value = p.id;
    opt.textContent = `${p.part_type}${dims}`;
    partsSelect.appendChild(opt);
  });
}



function openPartModal(part) {
  document.getElementById('partId').value = part?.id || '';
  document.getElementById('partTypeInput').value = part?.part_type || '';
  document.getElementById('partLzInput').value = part?.part_lz || '';
  document.getElementById('partLyInput').value = part?.part_ly || '';
  document.getElementById('partDataInput').value = part?.data ? JSON.stringify(part.data) : '';
  partModal.style.display = 'flex';
}

partModalClose.onclick = () => { partModal.style.display = 'none'; };

document.getElementById('addPart').onclick = () => openPartModal();

document.getElementById('editPart').onclick = () => {
  const selId = partsSelect.value;
  if (!selId) return alert('Select part');
  const part = partsCache.find(p => String(p.id) === String(selId));
  openPartModal(part);
};

document.getElementById('deletePart').onclick = async () => {
  const selId = partsSelect.value;
  if (!selId) return alert('Select part');
  if (!confirm('Delete part?')) return;
  await api(`/parts/${selId}`, { method: 'DELETE' });
  loadParts();
};

document.getElementById('savePart').onclick = async () => {
  const id = document.getElementById('partId').value;
  const partType = document.getElementById('partTypeInput').value.trim();
  if (!partType) return alert('Part type required');
  const lzVal = document.getElementById('partLzInput').value;
  const lyVal = document.getElementById('partLyInput').value;
  const partLz = lzVal ? parseFloat(lzVal) : null;
  const partLy = lyVal ? parseFloat(lyVal) : null;
  const dataTxt = document.getElementById('partDataInput').value.trim();
  let data = null;
  if (dataTxt) {
    try { data = JSON.parse(dataTxt); } catch (e) { return alert('Invalid JSON'); }
  }
  const payload = { partType, partLz, partLy, data };
  const res = id
    ? await api(`/parts/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    : await api('/parts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) return alert('Save failed');
  partModal.style.display = 'none';
  loadParts();
};
