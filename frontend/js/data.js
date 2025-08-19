const API_ORIGIN = window.APP_CONFIG?.apiBase || window.location.origin;
const API_BASE = API_ORIGIN === window.location.origin ? '' : API_ORIGIN; // same base as main app
function api(path, opts = {}) {
  return fetch(API_BASE + '/api' + path, opts).then(async r => {
    const txt = await r.text();
    try { return { ok: r.ok, json: JSON.parse(txt), status: r.status }; } catch(e) { return { ok: r.ok, text: txt, status: r.status }; }
  });
}

let partsCache = [];
let pmCache = [];
let templateCache = [];
let hardwareCategoryCache = [];
let hardwareCache = [];
const templateTopRail = document.getElementById('templateTopRail');
const templateBottomRail = document.getElementById('templateBottomRail');
const templateHingeRail = document.getElementById('templateHingeRail');
const templateLockRail = document.getElementById('templateLockRail');
const pmSelect = document.getElementById('pmSelect');
const pmModal = document.getElementById('pmModal');
const pmModalClose = document.getElementById('closePmModal');
const templateSelect = document.getElementById('templateSelect');
const templateModal = document.getElementById('templateModal');
const templateModalClose = document.getElementById('closeTemplateModal');
const partsSelect = document.getElementById('partsSelect');
const partModal = document.getElementById('partModal');
const partModalClose = document.getElementById('closePartModal');
const hardwareCategorySelect = document.getElementById('hardwareCategorySelect');
const hardwareItemSelect = document.getElementById('hardwareItemSelect');
const hardwareCategoryModal = document.getElementById('hardwareCategoryModal');
const hardwareItemModal = document.getElementById('hardwareItemModal');
const hardwareCategoryModalClose = document.getElementById('closeHardwareCategoryModal');
const hardwareItemModalClose = document.getElementById('closeHardwareItemModal');
const hardwareItemCategorySelect = document.getElementById('hardwareItemCategory');

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
  const parts = (partsCache || []).filter(p => (p.data?.uses || []).includes(usage));
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
  if (res.ok) {
    pmCache = res.json.managers || [];
    renderProjectManagers(pmCache);
  }
}
function renderProjectManagers(managers) {
  pmSelect.innerHTML = '';
  (managers || []).forEach(pm => {
    const opt = document.createElement('option');
    opt.value = pm.id;
    opt.textContent = pm.name;
    pmSelect.appendChild(opt);
  });
}
function openPmModal(pm) {
  document.getElementById('pmId').value = pm?.id || '';
  document.getElementById('pmNameInput').value = pm?.name || '';
  pmModal.style.display = 'flex';
}
pmModalClose.onclick = () => { pmModal.style.display = 'none'; };
document.getElementById('addPm').onclick = () => openPmModal();
document.getElementById('editPm').onclick = () => {
  const id = pmSelect.value;
  if (!id) return alert('Select project manager');
  const pm = pmCache.find(p => String(p.id) === String(id));
  openPmModal(pm);
};
document.getElementById('deletePm').onclick = async () => {
  const id = pmSelect.value;
  if (!id) return alert('Select project manager');
  if (!confirm('Delete project manager?')) return;
  await api(`/project-managers/${id}`, { method: 'DELETE' });
  loadProjectManagers();
};
document.getElementById('savePm').onclick = async () => {
  const id = document.getElementById('pmId').value;
  const name = document.getElementById('pmNameInput').value.trim();
  if (!name) return alert('Name required');
  const res = id
    ? await api(`/project-managers/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) })
    : await api('/project-managers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
  if (!res.ok) return alert('Save failed');
  pmModal.style.display = 'none';
  loadProjectManagers();
};
async function loadTemplates() {
  const res = await api('/door-part-templates');
  if (res.ok) {
    templateCache = res.json.templates || [];
    renderTemplates(templateCache);
  }
}
function renderTemplates(templates) {
  templateSelect.innerHTML = '';
  (templates || []).forEach(t => {
    const opt = document.createElement('option');
    const partsDesc = Object.entries(t.parts || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
    opt.value = t.id;
    opt.textContent = partsDesc ? `${t.name} — ${partsDesc}` : t.name;
    templateSelect.appendChild(opt);
  });
}
function openTemplateModal(t) {
  document.getElementById('templateId').value = t?.id || '';
  document.getElementById('templateNameInput').value = t?.name || '';
  populateRailSelect(templateTopRail, 'topRail', t?.parts?.topRail);
  populateRailSelect(templateBottomRail, 'bottomRail', t?.parts?.bottomRail);
  populateRailSelect(templateHingeRail, 'hingeRail', t?.parts?.hingeRail);
  populateRailSelect(templateLockRail, 'lockRail', t?.parts?.lockRail);
  templateModal.style.display = 'flex';
}
templateModalClose.onclick = () => { templateModal.style.display = 'none'; };
document.getElementById('addTemplate').onclick = () => openTemplateModal();
document.getElementById('editTemplate').onclick = () => {
  const id = templateSelect.value;
  if (!id) return alert('Select template');
  const tpl = templateCache.find(t => String(t.id) === String(id));
  openTemplateModal(tpl);
};
document.getElementById('deleteTemplate').onclick = async () => {
  const id = templateSelect.value;
  if (!id) return alert('Select template');
  if (!confirm('Delete template?')) return;
  await api(`/door-part-templates/${id}`, { method: 'DELETE' });
  loadTemplates();
};
document.getElementById('saveTemplate').onclick = async () => {
  const id = document.getElementById('templateId').value;
  const name = document.getElementById('templateNameInput').value.trim();
  if (!name) return alert('Template name required');
  const parts = {};
  if (templateTopRail.value) parts.topRail = templateTopRail.value;
  if (templateBottomRail.value) parts.bottomRail = templateBottomRail.value;
  if (templateHingeRail.value) parts.hingeRail = templateHingeRail.value;
  if (templateLockRail.value) parts.lockRail = templateLockRail.value;
  const res = id
    ? await api(`/door-part-templates/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, parts }) })
    : await api('/door-part-templates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, parts }) });
  if (!res.ok) return alert('Save failed');
  templateModal.style.display = 'none';
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
    populateRailSelect(templateTopRail, 'topRail');
    populateRailSelect(templateBottomRail, 'bottomRail');
    populateRailSelect(templateHingeRail, 'hingeRail');
    populateRailSelect(templateLockRail, 'lockRail');
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
  document.getElementById('partDescriptionInput').value = part?.data?.description || '';
  document.getElementById('partRequiresInput').value = part?.requires
    ? Object.entries(part.requires).map(([k, v]) => `${k}:${v}`).join(',')
    : '';
  const uses = part?.data?.uses || [];
  document.querySelectorAll('#partDoorUses input[type="checkbox"], #partFrameUses input[type="checkbox"]').forEach(cb => {
    cb.checked = uses.includes(cb.value);
  });
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
  const description = document.getElementById('partDescriptionInput').value.trim();

  const requiresVal = document.getElementById('partRequiresInput').value.trim();
  let requires = null;
  if (requiresVal) {
    requires = {};
    requiresVal.split(',').map(s => s.trim()).filter(Boolean).forEach(pair => {
      const [p, q] = pair.split(':').map(s => s.trim());
      if (p) requires[p] = q ? parseInt(q, 10) : 1;
    });
    if (Object.keys(requires).length === 0) requires = null;
  }
  const uses = Array.from(document.querySelectorAll('#partDoorUses input:checked, #partFrameUses input:checked')).map(cb => cb.value);
  let data = {};
  if (description) data.description = description;
  const uniqueUses = [...new Set(uses)];
  if (uniqueUses.length) data.uses = uniqueUses;
  if (Object.keys(data).length === 0) data = null;
  const payload = { partType, partLz, partLy, data, requires };
  const res = id
    ? await api(`/parts/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    : await api('/parts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) return alert('Save failed');
  partModal.style.display = 'none';
  loadParts();
};

// Hardware Categories
async function loadHardwareCategories() {
  const res = await api('/hardware-categories');
  if (res.ok) {
    hardwareCategoryCache = res.json.categories || [];
    renderHardwareCategories(hardwareCategoryCache);
    populateHardwareCategoryDropdown();
  }
}

function renderHardwareCategories(categories) {
  hardwareCategorySelect.innerHTML = '';
  (categories || []).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    hardwareCategorySelect.appendChild(opt);
  });
}

function populateHardwareCategoryDropdown(selectedId) {
  hardwareItemCategorySelect.innerHTML = '<option value=""></option>';
  hardwareCategoryCache.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    hardwareItemCategorySelect.appendChild(opt);
  });
  if (selectedId) hardwareItemCategorySelect.value = selectedId;
}

function openHardwareCategoryModal(cat) {
  document.getElementById('hardwareCategoryId').value = cat?.id || '';
  document.getElementById('hardwareCategoryName').value = cat?.name || '';
  hardwareCategoryModal.style.display = 'flex';
}

hardwareCategoryModalClose.onclick = () => { hardwareCategoryModal.style.display = 'none'; };
document.getElementById('addHardwareCategory').onclick = () => openHardwareCategoryModal();
document.getElementById('editHardwareCategory').onclick = () => {
  const id = hardwareCategorySelect.value;
  if (!id) return alert('Select category');
  const cat = hardwareCategoryCache.find(c => String(c.id) === String(id));
  openHardwareCategoryModal(cat);
};
document.getElementById('deleteHardwareCategory').onclick = async () => {
  const id = hardwareCategorySelect.value;
  if (!id) return alert('Select category');
  if (!confirm('Delete category?')) return;
  await api(`/hardware-categories/${id}`, { method: 'DELETE' });
  loadHardwareCategories();
  loadHardwareItems(hardwareCategorySelect.value);
};
document.getElementById('saveHardwareCategory').onclick = async () => {
  const id = document.getElementById('hardwareCategoryId').value;
  const name = document.getElementById('hardwareCategoryName').value.trim();
  if (!name) return alert('Name required');
  const res = id
    ? await api(`/hardware-categories/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) })
    : await api('/hardware-categories', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
  if (!res.ok) return alert('Save failed');
  hardwareCategoryModal.style.display = 'none';
  loadHardwareCategories();
};

hardwareCategorySelect.onchange = () => {
  const id = hardwareCategorySelect.value;
  loadHardwareItems(id);
};

// Hardware Items
async function loadHardwareItems(categoryId) {
  const path = categoryId ? `/hardware?categoryId=${categoryId}` : '/hardware';
  const res = await api(path);
  if (res.ok) {
    hardwareCache = res.json.hardware || [];
    renderHardwareItems(hardwareCache);
  }
}

function renderHardwareItems(items) {
  hardwareItemSelect.innerHTML = '';
  (items || []).forEach(h => {
    const opt = document.createElement('option');
    opt.value = h.id;
    const feat = (h.features || []).join(', ');
    const text = `${h.manufacturer || ''} ${h.model_number || ''}`.trim();
    opt.textContent = feat ? `${text} — ${feat}` : text;
    hardwareItemSelect.appendChild(opt);
  });
}

function openHardwareItemModal(h) {
  document.getElementById('hardwareItemId').value = h?.id || '';
  populateHardwareCategoryDropdown(h?.category_id);
  document.getElementById('hardwareManufacturerInput').value = h?.manufacturer || '';
  document.getElementById('hardwareModelInput').value = h?.model_number || '';
  document.getElementById('hardwareFeaturesInput').value = h?.features ? h.features.join(', ') : '';
  hardwareItemModal.style.display = 'flex';
}

hardwareItemModalClose.onclick = () => { hardwareItemModal.style.display = 'none'; };
document.getElementById('addHardwareItem').onclick = () => openHardwareItemModal();
document.getElementById('editHardwareItem').onclick = () => {
  const id = hardwareItemSelect.value;
  if (!id) return alert('Select hardware');
  const hw = hardwareCache.find(h => String(h.id) === String(id));
  openHardwareItemModal(hw);
};
document.getElementById('deleteHardwareItem').onclick = async () => {
  const id = hardwareItemSelect.value;
  if (!id) return alert('Select hardware');
  if (!confirm('Delete hardware?')) return;
  await api(`/hardware/${id}`, { method: 'DELETE' });
  loadHardwareItems(hardwareCategorySelect.value);
};
document.getElementById('saveHardwareItem').onclick = async () => {
  const id = document.getElementById('hardwareItemId').value;
  const categoryId = hardwareItemCategorySelect.value;
  if (!categoryId) return alert('Select category');
  const manufacturer = document.getElementById('hardwareManufacturerInput').value.trim();
  const modelNumber = document.getElementById('hardwareModelInput').value.trim();
  const featuresTxt = document.getElementById('hardwareFeaturesInput').value.trim();
  const features = featuresTxt ? featuresTxt.split(',').map(f => f.trim()).filter(Boolean) : [];
  const payload = { categoryId: parseInt(categoryId, 10), manufacturer, modelNumber, features };
  const res = id
    ? await api(`/hardware/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    : await api('/hardware', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) return alert('Save failed');
  hardwareItemModal.style.display = 'none';
  loadHardwareItems(hardwareCategorySelect.value);
};

loadHardwareCategories();
loadHardwareItems();
