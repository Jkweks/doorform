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
