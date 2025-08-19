const express = require('express');
const pool = require('./db');
const { computeDoorCutList } = require('./cutlist');

const router = express.Router();

// List jobs
router.get('/jobs', async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const query = includeArchived
      ? 'SELECT * FROM jobs ORDER BY created_at DESC'
      : 'SELECT * FROM jobs WHERE archived = false ORDER BY created_at DESC';
    const result = await pool.query(query);
    res.json({ jobs: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create or update a job by jobNumber
router.post('/jobs', async (req, res) => {
  const { jobNumber, jobName, pm, archived } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO jobs (job_number, job_name, pm, archived)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (job_number)
       DO UPDATE SET job_name = EXCLUDED.job_name,
                     pm = EXCLUDED.pm,
                     archived = EXCLUDED.archived
       RETURNING *`,
      [jobNumber, jobName, pm, archived || false]
    );
    res.json({ job: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add or update a work order for a job
router.post('/jobs/:id/work-orders', async (req, res) => {
  const jobId = req.params.id;
  const { workOrder, archived } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO work_orders (job_id, work_order, archived)
       VALUES ($1, $2, $3)
       ON CONFLICT (job_id, work_order)
       DO UPDATE SET archived = EXCLUDED.archived
       RETURNING *`,
      [jobId, workOrder, archived || false]
    );
    res.json({ workOrder: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a work order
router.put('/work-orders/:id', async (req, res) => {
  const id = req.params.id;
  const { workOrder, archived } = req.body;
  try {
    const result = await pool.query(
      'UPDATE work_orders SET work_order = COALESCE($1, work_order), archived = COALESCE($2, archived) WHERE id = $3 RETURNING *',
      [workOrder, archived, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Work order not found' });
    res.json({ workOrder: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a work order
router.delete('/work-orders/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query('DELETE FROM work_orders WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Work order not found' });
    res.json({ message: 'Work order deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save a production PDF for a work order
router.post('/work-orders/:id/pdf', express.raw({ type: 'application/pdf', limit: '10mb' }), async (req, res) => {
  const id = req.params.id;
  const tag = req.headers['x-print-tag'] || null;
  try {
    const result = await pool.query(
      'INSERT INTO work_order_pdfs (work_order_id, tag, pdf) VALUES ($1, $2, $3) RETURNING id',
      [id, tag, req.body]
    );
    res.json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get job with work orders, entries, frames and doors by ID
router.get('/jobs/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const jobRes = await pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
    if (jobRes.rows.length === 0) return res.status(404).json({ error: 'Job not found' });
    const job = jobRes.rows[0];
    const workOrdersRes = await pool.query('SELECT * FROM work_orders WHERE job_id = $1 ORDER BY id', [id]);
    const workOrders = [];
    for (const wo of workOrdersRes.rows) {
      const entriesRes = await pool.query('SELECT * FROM entries WHERE work_order_id = $1 ORDER BY id', [wo.id]);
      const entries = [];
      for (const entry of entriesRes.rows) {
        const framesRes = await pool.query('SELECT id, data FROM frames WHERE entry_id = $1', [entry.id]);
        const doorsRes = await pool.query('SELECT id, leaf, data FROM doors WHERE entry_id = $1 ORDER BY id', [entry.id]);
        entries.push({ ...entry, frames: framesRes.rows, doors: doorsRes.rows });
      }
      workOrders.push({ ...wo, entries });
    }
    res.json({ job, workOrders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a job by ID
router.delete('/jobs/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query('DELETE FROM jobs WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Job not found' });
    res.json({ message: 'Job deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create an entry for a work order and generate frame and door records
router.post('/work-orders/:id/entries', async (req, res) => {
  const workOrderId = req.params.id;
  const { handing, entryData, frameData, doorData } = req.body;
  try {
    const entryRes = await pool.query(
      'INSERT INTO entries (work_order_id, handing, data) VALUES ($1, $2, $3) RETURNING id, handing, data',
      [workOrderId, handing, entryData]
    );
    const entryId = entryRes.rows[0].id;
    await pool.query('INSERT INTO frames (entry_id, data) VALUES ($1, $2)', [entryId, frameData]);
    if (handing === 'LHRA' || handing === 'RHRA') {
      await pool.query(
        'INSERT INTO doors (entry_id, leaf, data) VALUES ($1, $2, $3), ($1, $4, $5)',
        [entryId, 'A', doorData, 'B', doorData]
      );
    } else {
      await pool.query(
        'INSERT INTO doors (entry_id, leaf, data) VALUES ($1, $2, $3)',
        [entryId, 'A', doorData]
      );
    }
    res.json({ entry: entryRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update entry handing or data and adjust door leaves if needed
router.put('/entries/:id', async (req, res) => {
  const id = req.params.id;
  const { handing, data, entryData } = req.body;
  // Some clients may still send entryData instead of data – fall back if needed
  const updatedData = data !== undefined ? data : entryData;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // fetch current handing to determine if door leaves need adjustment
    const current = await client.query('SELECT handing FROM entries WHERE id = $1', [id]);
    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Entry not found' });
    }
    const previousHanding = current.rows[0].handing;

    await client.query('UPDATE entries SET handing = $1, data = $2 WHERE id = $3', [handing, updatedData, id]);

    const wasDouble = previousHanding === 'LHRA' || previousHanding === 'RHRA';
    const isDouble = handing === 'LHRA' || handing === 'RHRA';

    if (!wasDouble && isDouble) {
      // going from single to double: add B leaf duplicating A leaf data
      const doorDataRes = await client.query(
        "SELECT data FROM doors WHERE entry_id = $1 AND leaf = 'A'",
        [id]
      );
      const doorData = doorDataRes.rows[0] ? doorDataRes.rows[0].data : null;
      await client.query(
        "INSERT INTO doors (entry_id, leaf, data) VALUES ($1, 'B', $2)",
        [id, doorData]
      );
    } else if (wasDouble && !isDouble) {
      // going from double to single: remove B leaf
      await client.query("DELETE FROM doors WHERE entry_id = $1 AND leaf = 'B'", [id]);
    }

    await client.query('COMMIT');
    const updated = await client.query('SELECT * FROM entries WHERE id = $1', [id]);
    res.json({ entry: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Delete an entry
router.delete('/entries/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query('DELETE FROM entries WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json({ message: 'Entry deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete frame
router.delete('/frames/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query('DELETE FROM frames WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Frame not found' });
    res.json({ message: 'Frame deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete door
router.delete('/doors/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query('DELETE FROM doors WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Door not found' });
    res.json({ message: 'Door deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update frame data
router.put('/frames/:id', async (req, res) => {
  const id = req.params.id;
  const { data } = req.body;
  try {
    const result = await pool.query('UPDATE frames SET data = $1 WHERE id = $2 RETURNING *', [data, id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Frame not found' });
    res.json({ frame: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update door data
router.put('/doors/:id', async (req, res) => {
  const id = req.params.id;
  const { data } = req.body;
  try {
    const result = await pool.query('UPDATE doors SET data = $1 WHERE id = $2 RETURNING *', [data, id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Door not found' });
    res.json({ door: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List project managers
router.get('/project-managers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM project_managers ORDER BY id');
    res.json({ managers: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a project manager
router.post('/project-managers', async (req, res) => {
  const { name } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO project_managers (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.json({ manager: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a project manager
router.put('/project-managers/:id', async (req, res) => {
  const id = req.params.id;
  const { name } = req.body;
  try {
    const result = await pool.query(
      'UPDATE project_managers SET name = $1 WHERE id = $2 RETURNING *',
      [name, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Project manager not found' });
    res.json({ manager: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a project manager
router.delete('/project-managers/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query('DELETE FROM project_managers WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Project manager not found' });
    res.json({ message: 'Project manager deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List stored parts
router.get('/parts', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM door_parts WHERE door_id IS NULL ORDER BY part_type'
    );
    res.json({ parts: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a part
router.post('/parts', async (req, res) => {
  const { partType, partLz = null, partLy = null, data = null, requires = null } = req.body;
  const dataJson = data ? JSON.stringify(data) : null;
  const requiresJson = requires ? JSON.stringify(requires) : null;
  try {
    const result = await pool.query(
      'INSERT INTO door_parts (door_id, part_type, part_lz, part_ly, data, requires) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [null, partType, partLz, partLy, dataJson, requiresJson]
    );
    res.json({ part: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a part
router.put('/parts/:id', async (req, res) => {
  const id = req.params.id;

  const { partType, partLz = null, partLy = null, data = null, requires = null } = req.body;
  const dataJson = data ? JSON.stringify(data) : null;
  const requiresJson = requires ? JSON.stringify(requires) : null;
  try {
    const result = await pool.query(
      'UPDATE door_parts SET part_type = $1, part_lz = $2, part_ly = $3, data = $4, requires = $5 WHERE id = $6 AND door_id IS NULL RETURNING *',
      [partType, partLz, partLy, dataJson, requiresJson, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Part not found' });
    res.json({ part: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a part
router.delete('/parts/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query('DELETE FROM door_parts WHERE id = $1 AND door_id IS NULL', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Part not found' });
    res.json({ message: 'Part deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List door part templates
router.get('/door-part-templates', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM door_part_templates ORDER BY id');
    res.json({ templates: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a door part template
router.post('/door-part-templates', async (req, res) => {
  const { name, parts } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO door_part_templates (name, parts) VALUES ($1, $2) RETURNING *',
      [name, parts]
    );
    res.json({ template: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a door part template
router.put('/door-part-templates/:id', async (req, res) => {
  const id = req.params.id;
  const { name, parts } = req.body;
  try {
    const result = await pool.query(
      'UPDATE door_part_templates SET name = $1, parts = $2 WHERE id = $3 RETURNING *',
      [name, parts, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ template: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a door part template
router.delete('/door-part-templates/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query('DELETE FROM door_part_templates WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ message: 'Template deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate a cut list for a specific door
router.get('/doors/:id/cut-list', async (req, res) => {
  const doorId = req.params.id;
  try {
    const doorRes = await pool.query(
      'SELECT d.data AS door_data, e.data AS entry_data FROM doors d JOIN entries e ON d.entry_id = e.id WHERE d.id = $1',
      [doorId]
    );
    if (doorRes.rowCount === 0) return res.status(404).json({ error: 'Door not found' });
    const doorData = doorRes.rows[0].door_data || {};
    const entryData = doorRes.rows[0].entry_data || {};
    const partNumbers = [doorData.topRail, doorData.bottomRail, doorData.hingeRail, doorData.lockRail].filter(Boolean);
    const partsMap = {};
    if (partNumbers.length) {
      const partsRes = await pool.query(
        'SELECT part_type, part_ly FROM door_parts WHERE door_id IS NULL AND part_type = ANY($1::text[])',
        [partNumbers]
      );
      partsRes.rows.forEach(p => { partsMap[p.part_type] = p; });
    }
    const cutList = computeDoorCutList(entryData, {
      topRail: partsMap[doorData.topRail],
      bottomRail: partsMap[doorData.bottomRail],
      hingeRail: partsMap[doorData.hingeRail],
      lockRail: partsMap[doorData.lockRail]
    });
    res.json({ cutList });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List parts for a specific door
router.get('/doors/:id/parts', async (req, res) => {
  const doorId = req.params.id;
  try {
    const result = await pool.query('SELECT * FROM door_parts WHERE door_id = $1 ORDER BY id', [doorId]);
    res.json({ parts: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a part to a door
router.post('/doors/:id/parts', async (req, res) => {
  const doorId = req.params.id;
  const { partType, partLz, partLy, data, requires = null, quantity = 1 } = req.body;
  const dataJson = data ? JSON.stringify(data) : null;
  const requiresJson = requires ? JSON.stringify(requires) : null;
  try {
    const result = await pool.query(
      'INSERT INTO door_parts (door_id, part_type, part_lz, part_ly, data, requires, quantity) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [doorId, partType, partLz, partLy, dataJson, requiresJson, quantity]
    );
    res.json({ part: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a door part
router.put('/door-parts/:id', async (req, res) => {
  const id = req.params.id;
  const { partType, partLz, partLy, data, requires = null, quantity = 1 } = req.body;
  const dataJson = data ? JSON.stringify(data) : null;
  const requiresJson = requires ? JSON.stringify(requires) : null;
  try {
    const result = await pool.query(
      'UPDATE door_parts SET part_type = $1, part_lz = $2, part_ly = $3, data = $4, requires = $5, quantity = $6 WHERE id = $7 RETURNING *',
      [partType, partLz, partLy, dataJson, requiresJson, quantity, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Door part not found' });
    res.json({ part: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a door part
router.delete('/door-parts/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query('DELETE FROM door_parts WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Door part not found' });
    res.json({ message: 'Door part deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List hardware categories
router.get('/hardware-categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hardware_categories ORDER BY name');
    res.json({ categories: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a hardware category
router.post('/hardware-categories', async (req, res) => {
  const { name } = req.body;
  try {
    const result = await pool.query('INSERT INTO hardware_categories (name) VALUES ($1) RETURNING *', [name]);
    res.json({ category: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a hardware category
router.put('/hardware-categories/:id', async (req, res) => {
  const id = req.params.id;
  const { name } = req.body;
  try {
    const result = await pool.query('UPDATE hardware_categories SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Category not found' });
    res.json({ category: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a hardware category
router.delete('/hardware-categories/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query('DELETE FROM hardware_categories WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Category not found' });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List hardware items, optionally filtered by category
router.get('/hardware', async (req, res) => {
  const categoryId = req.query.categoryId;
  try {
    const query = categoryId
      ? 'SELECT * FROM hardware_items WHERE category_id = $1 ORDER BY id'
      : 'SELECT * FROM hardware_items ORDER BY id';
    const params = categoryId ? [categoryId] : [];
    const result = await pool.query(query, params);
    res.json({ hardware: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a hardware item
router.post('/hardware', async (req, res) => {
  const { categoryId, manufacturer, modelNumber, features } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO hardware_items (category_id, manufacturer, model_number, features) VALUES ($1, $2, $3, $4) RETURNING *',
      [categoryId, manufacturer, modelNumber, features]
    );
    res.json({ hardware: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a hardware item
router.put('/hardware/:id', async (req, res) => {
  const id = req.params.id;
  const { categoryId, manufacturer, modelNumber, features } = req.body;
  try {
    const result = await pool.query(
      'UPDATE hardware_items SET category_id = $1, manufacturer = $2, model_number = $3, features = $4 WHERE id = $5 RETURNING *',
      [categoryId, manufacturer, modelNumber, features, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Hardware not found' });
    res.json({ hardware: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a hardware item
router.delete('/hardware/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query('DELETE FROM hardware_items WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Hardware not found' });
    res.json({ message: 'Hardware deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
