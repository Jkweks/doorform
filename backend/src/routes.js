const express = require('express');
const pool = require('./db');
const csv = require('csv-parser');
const multer = require('multer');
const fs = require('fs');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });


// Create a job
router.post('/jobs', async (req, res) => {
  const { job_number, job_name, pm, work_order } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO jobs (job_number, job_name, pm, work_order) VALUES ($1, $2, $3, $4) RETURNING *',
      [job_number, job_name, pm, work_order]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get latest job
router.get('/jobs/latest', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM jobs ORDER BY created_at DESC LIMIT 1');
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a job by ID
router.get('/jobs/:jobId', async (req, res) => {
  const jobId = req.params.jobId;
  try {
    const result = await pool.query('SELECT * FROM jobs WHERE id = $1', [jobId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import frames via CSV
router.post('/frames/import/:jobId', upload.single('file'), (req, res) => {
  const jobId = req.params.jobId;
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      for (let row of results) {
        await pool.query(
          'INSERT INTO frames (job_id, frame_number, frame_details) VALUES ($1, $2, $3)',
          [jobId, row.frame_number, row.frame_details || '']
        );
      }
      fs.unlinkSync(req.file.path);
      res.json({ message: 'Frames imported successfully' });
    });
});

// Import doors via CSV
router.post('/doors/import/:jobId', upload.single('file'), (req, res) => {
  const jobId = req.params.jobId;
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      for (let row of results) {
        await pool.query(
          'INSERT INTO doors (job_id, door_number, door_details) VALUES ($1, $2, $3)',
          [jobId, row.door_number, row.door_details || '']
        );
      }
      fs.unlinkSync(req.file.path);
      res.json({ message: 'Doors imported successfully' });
    });
});

// Get frames for a job
router.get('/frames/job/:jobId', async (req, res) => {
  const jobId = req.params.jobId;
  try {
    const result = await pool.query('SELECT * FROM frames WHERE job_id = $1', [jobId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get doors for a job
router.get('/doors/job/:jobId', async (req, res) => {
  const jobId = req.params.jobId;
  try {
    const result = await pool.query('SELECT * FROM doors WHERE job_id = $1', [jobId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
