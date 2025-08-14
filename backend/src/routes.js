const express = require('express');
const pool = require('./db');
const csv = require('csv-parser');
const multer = require('multer');
const fs = require('fs');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// List jobs
router.get('/jobs', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM jobs ORDER BY created_at DESC');
    res.json({ jobs: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create or update a job by jobNumber
router.post('/jobs', async (req, res) => {
  const { jobNumber, jobName, pm, workOrder } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO jobs (job_number, job_name, pm, work_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (job_number)
       DO UPDATE SET job_name = EXCLUDED.job_name,
                     pm = EXCLUDED.pm,
                     work_order = EXCLUDED.work_order
       RETURNING *`,
      [jobNumber, jobName, pm, workOrder]
    );
    res.json({ job: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to fetch job by number
async function getJobId(jobNumber) {
  const jobRes = await pool.query('SELECT id FROM jobs WHERE job_number = $1', [jobNumber]);
  if (jobRes.rows.length === 0) return null;
  return jobRes.rows[0].id;
}

// Get job with frames and doors
router.get('/jobs/:jobNumber', async (req, res) => {
  const jobNumber = req.params.jobNumber;
  try {
    const jobRes = await pool.query('SELECT * FROM jobs WHERE job_number = $1', [jobNumber]);
    if (jobRes.rows.length === 0) return res.status(404).json({ error: 'Job not found' });
    const job = jobRes.rows[0];
    const framesRes = await pool.query('SELECT id, data FROM frames WHERE job_id = $1 ORDER BY id', [job.id]);
    const doorsRes = await pool.query('SELECT id, data FROM doors WHERE job_id = $1 ORDER BY id', [job.id]);
    res.json({ job, frames: framesRes.rows, doors: doorsRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a job by job number
router.delete('/jobs/:jobNumber', async (req, res) => {
  const jobNumber = req.params.jobNumber;
  try {
    const result = await pool.query('DELETE FROM jobs WHERE job_number = $1 RETURNING *', [jobNumber]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Job not found' });
    res.json({ message: 'Job deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a single frame
router.post('/jobs/:jobNumber/frames', async (req, res) => {
  const jobNumber = req.params.jobNumber;
  const { data } = req.body;
  try {
    const jobId = await getJobId(jobNumber);
    if (!jobId) return res.status(404).json({ error: 'Job not found' });
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
router.post('/jobs/:jobNumber/doors', async (req, res) => {
  const jobNumber = req.params.jobNumber;
  const { data } = req.body;
  try {
    const jobId = await getJobId(jobNumber);
    if (!jobId) return res.status(404).json({ error: 'Job not found' });
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
router.post('/jobs/:jobNumber/import-frames', upload.single('file'), async (req, res) => {
  const jobNumber = req.params.jobNumber;
  try {
    const jobId = await getJobId(jobNumber);
    if (!jobId) return res.status(404).json({ error: 'Job not found' });
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
router.post('/jobs/:jobNumber/import-doors', upload.single('file'), async (req, res) => {
  const jobNumber = req.params.jobNumber;
  try {
    const jobId = await getJobId(jobNumber);
    if (!jobId) return res.status(404).json({ error: 'Job not found' });
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
