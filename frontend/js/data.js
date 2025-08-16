const API_BASE = 'http://192.168.4.251:3000'; // same base as main app
function api(path, opts = {}) {
  return fetch(API_BASE + '/api' + path, opts).then(async r => {
    const txt = await r.text();
    try { return { ok: r.ok, json: JSON.parse(txt), status: r.status }; } catch(e) { return { ok: r.ok, text: txt, status: r.status }; }
  });
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
    left.innerHTML = `<strong>${t.name}</strong>`;
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
  const partsStr = document.getElementById('newTemplateParts').value.trim();
  if (!name) return;
  let parts = {};
  if (partsStr) {
    try { parts = JSON.parse(partsStr); } catch (e) { return alert('Invalid JSON'); }
  }
  await api('/door-part-templates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, parts }) });
  document.getElementById('newTemplateName').value = '';
  document.getElementById('newTemplateParts').value = '';
  loadTemplates();
};

loadProjectManagers();
loadTemplates();
loadParts();

async function loadParts() {
  const res = await api('/parts');
  if (res.ok) renderParts(res.json.parts || []);
}

function renderParts(parts) {
  const list = document.getElementById('partList');
  list.innerHTML = '';
  (parts || []).forEach(p => {
    const item = document.createElement('div');
    item.className = 'item';
    const left = document.createElement('div');
    const usages = (p.usages || []).join(', ');
    const req = (p.requires && p.requires.length) ? ` (requires ${p.requires.join(', ')})` : '';
    left.innerHTML = `<strong>${p.number}</strong> — ${usages}${req}`;
    const right = document.createElement('div');
    const edit = document.createElement('button');
    edit.textContent = 'Edit';
    edit.onclick = () => {
      const number = prompt('Part number', p.number);
      if (number === null) return;
      const usagesStr = prompt('Usages (comma-separated topRail,bottomRail,hingeRail,lockRail,midRail,glassStop,doorBacker,hingeJamb,lockJamb,doorHeader,transomHeader,doorStop,frameBacker)', (p.usages || []).join(','));
      if (usagesStr === null) return;
      const requiresStr = prompt('Requires (comma-separated part numbers)', (p.requires || []).join(','));
      const usages = usagesStr.split(',').map(s => s.trim()).filter(Boolean);
      const requires = requiresStr.split(',').map(s => s.trim()).filter(Boolean);
      api(`/parts/${p.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ number, usages, requires }) }).then(loadParts);
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
  const usages = [];
  if (document.getElementById('newUsageTop').checked) usages.push('topRail');
  if (document.getElementById('newUsageBottom').checked) usages.push('bottomRail');
  if (document.getElementById('newUsageHinge').checked) usages.push('hingeRail');
  if (document.getElementById('newUsageLock').checked) usages.push('lockRail');
  if (document.getElementById('newUsageMid').checked) usages.push('midRail');
  if (document.getElementById('newUsageGlass').checked) usages.push('glassStop');
  if (document.getElementById('newUsageDoorBacker').checked) usages.push('doorBacker');
  if (document.getElementById('newUsageHingeJamb').checked) usages.push('hingeJamb');
  if (document.getElementById('newUsageLockJamb').checked) usages.push('lockJamb');
  if (document.getElementById('newUsageDoorHeader').checked) usages.push('doorHeader');
  if (document.getElementById('newUsageTransomHeader').checked) usages.push('transomHeader');
  if (document.getElementById('newUsageDoorStop').checked) usages.push('doorStop');
  if (document.getElementById('newUsageFrameBacker').checked) usages.push('frameBacker');
  const reqStr = document.getElementById('newPartRequires').value.trim();
  const requires = reqStr ? reqStr.split(',').map(s => s.trim()).filter(Boolean) : [];
  await api('/parts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ number, usages, requires }) });
  document.getElementById('newPartNumber').value = '';
  document.getElementById('newUsageTop').checked = false;
  document.getElementById('newUsageBottom').checked = false;
  document.getElementById('newUsageHinge').checked = false;
  document.getElementById('newUsageLock').checked = false;
  document.getElementById('newUsageMid').checked = false;
  document.getElementById('newUsageGlass').checked = false;
  document.getElementById('newUsageDoorBacker').checked = false;
  document.getElementById('newUsageHingeJamb').checked = false;
  document.getElementById('newUsageLockJamb').checked = false;
  document.getElementById('newUsageDoorHeader').checked = false;
  document.getElementById('newUsageTransomHeader').checked = false;
  document.getElementById('newUsageDoorStop').checked = false;
  document.getElementById('newUsageFrameBacker').checked = false;
  document.getElementById('newPartRequires').value = '';
  loadParts();
};