const express = require('express');
const pool = require('./db');

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

module.exports = router;
