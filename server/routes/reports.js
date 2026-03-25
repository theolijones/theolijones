import { Router } from 'express';
import pool from '../db.js';
import { authenticate } from '../auth.js';

const router = Router();

router.use(authenticate);

// GET / - list all reports
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, period_start, period_end, created_at, sent_at
       FROM reports
       ORDER BY created_at DESC`,
    );
    return res.json({ reports: rows });
  } catch (err) {
    console.error('[REPORTS] List error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - single report detail
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM reports WHERE id = $1`,
      [req.params.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    return res.json({ report: rows[0] });
  } catch (err) {
    console.error('[REPORTS] Detail error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
