const API_BASE = 'http://192.168.4.251:3000'; // same base as main app
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

// Tabs for maintenance sections
for (const btn of document.querySelectorAll('#dataTabs button')) {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#dataTabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
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
    populateRailSelect(topRailSelect, 'topRail');
    populateRailSelect(bottomRailSelect, 'bottomRail');
    populateRailSelect(hingeRailSelect, 'hingeRail');
    populateRailSelect(lockRailSelect, 'lockRail');
  }
}

function renderParts(parts) {
  const list = document.getElementById('partList');
  list.innerHTML = '';
  (parts || []).forEach(p => {
    const item = document.createElement('div');
    item.className = 'item';
    const left = document.createElement('div');
    const usages = (p.usages || []).join(', ');
    const dims = (p.lx || p.ly) ? ` (${p.lx || ''}x${p.ly || ''})` : '';
    const desc = p.description ? ` — ${p.description}` : '';
    const req = (p.requires && p.requires.length) ? ` (requires ${p.requires.join(', ')})` : '';
    left.innerHTML = `<strong>${p.number}</strong>${desc} — ${usages}${dims}${req}`;
    const right = document.createElement('div');
    const edit = document.createElement('button');
    edit.textContent = 'Edit';
    edit.onclick = () => {
      const number = prompt('Part number', p.number);
      if (number === null) return;
      const description = prompt('Description', p.description || '');
      if (description === null) return;
      const lx = prompt('LX', p.lx || '');
      if (lx === null) return;
      const ly = prompt('LY', p.ly || '');
      if (ly === null) return;
      const usagesStr = prompt('Usages (comma-separated topRail,bottomRail,hingeRail,lockRail,midRail,glassStop,doorBacker,lug,fastener,hingeJamb,lockJamb,doorHeader,transomHeader,doorStop,frameBacker)', (p.usages || []).join(','));
      if (usagesStr === null) return;
      const requiresStr = prompt('Requires (comma-separated part numbers)', (p.requires || []).join(','));
      const usages = usagesStr.split(',').map(s => s.trim()).filter(Boolean);
      const requires = requiresStr.split(',').map(s => s.trim()).filter(Boolean);
      api(`/parts/${p.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ number, description, lx: lx ? parseFloat(lx) : null, ly: ly ? parseFloat(ly) : null, usages, requires }) }).then(loadParts);
    };
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.onclick = () => {
      if (!confirm('Delete part ' + p.number + '?')) return;
      api(`/parts/${p.id}`, { method: 'DELETE' }).then(loadParts);
    };
    right.appendChild(edit); right.appendChild(del);
    item.appendChild(left); item.appendChild(right);
    list.appendChild(item);
  });
}


document.getElementById('addPart').onclick = async () => {
  const number = document.getElementById('newPartNumber').value.trim();
  if (!number) return;
  const description = document.getElementById('newPartDescription').value.trim() || null;
  const lxVal = document.getElementById('newPartLX').value;
  const lyVal = document.getElementById('newPartLY').value;
  const lx = lxVal ? parseFloat(lxVal) : null;
  const ly = lyVal ? parseFloat(lyVal) : null;
  const usages = [];
  document.querySelectorAll('.usage-checkbox:checked').forEach(cb => usages.push(cb.value));
  const reqStr = document.getElementById('newPartRequires').value.trim();
  const requires = reqStr ? reqStr.split(',').map(s => s.trim()).filter(Boolean) : [];
  await api('/parts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ number, description, lx, ly, usages, requires }) });
  document.getElementById('newPartNumber').value = '';
  document.getElementById('newPartDescription').value = '';
  document.getElementById('newPartLX').value = '';
  document.getElementById('newPartLY').value = '';
  document.querySelectorAll('.usage-checkbox').forEach(cb => cb.checked = false);
  document.getElementById('newPartRequires').value = '';
  loadParts();
};
