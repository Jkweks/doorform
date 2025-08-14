const express = require('express');
const pool = require('./db');
const csv = require('csv-parser');
const multer = require('multer');
const fs = require('fs');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

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

// Create or update a job by jobNumber + workOrder
router.post('/jobs', async (req, res) => {
  const { jobNumber, jobName, pm, workOrder, archived } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO jobs (job_number, job_name, pm, work_order, archived)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (job_number, work_order)
       DO UPDATE SET job_name = EXCLUDED.job_name,
                     pm = EXCLUDED.pm,
                     archived = EXCLUDED.archived
       RETURNING *`,
      [jobNumber, jobName, pm, workOrder, archived || false]
    );
    res.json({ job: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get job with frames and doors by ID
router.get('/jobs/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const jobRes = await pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
    if (jobRes.rows.length === 0) return res.status(404).json({ error: 'Job not found' });
    const job = jobRes.rows[0];
    const framesRes = await pool.query('SELECT id, data FROM frames WHERE job_id = $1 ORDER BY id', [id]);
    const doorsRes = await pool.query('SELECT id, data FROM doors WHERE job_id = $1 ORDER BY id', [id]);
    res.json({ job, frames: framesRes.rows, doors: doorsRes.rows });
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

// Add a single frame
router.post('/jobs/:id/frames', async (req, res) => {
  const jobId = req.params.id;
  const { data } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO frames (job_id, data) VALUES ($1, $2) RETURNING id, data',
      [jobId, data]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a single door
router.post('/jobs/:id/doors', async (req, res) => {
  const jobId = req.params.id;
  const { data } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO doors (job_id, data) VALUES ($1, $2) RETURNING id, data',
      [jobId, data]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import frames via CSV
router.post('/jobs/:id/import-frames', upload.single('file'), async (req, res) => {
  const jobId = req.params.id;
  try {
    const rows = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => rows.push(data))
      .on('end', async () => {
        for (const row of rows) {
          await pool.query('INSERT INTO frames (job_id, data) VALUES ($1, $2)', [jobId, row]);
        }
        fs.unlinkSync(req.file.path);
        res.json({ message: 'Frames imported successfully' });
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import doors via CSV
router.post('/jobs/:id/import-doors', upload.single('file'), async (req, res) => {
  const jobId = req.params.id;
  try {
    const rows = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => rows.push(data))
      .on('end', async () => {
        for (const row of rows) {
          await pool.query('INSERT INTO doors (job_id, data) VALUES ($1, $2)', [jobId, row]);
        }
        fs.unlinkSync(req.file.path);
        res.json({ message: 'Doors imported successfully' });
      });
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
