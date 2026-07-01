import { Router } from 'express';
import pool from '../db.js';
import { authenticate, adminOnly } from '../auth.js';

const router = Router();

router.use(authenticate, adminOnly);

// GET / - list all
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM mailing_list ORDER BY id');
    return res.json({ recipients: rows });
  } catch (err) {
    console.error('[MAILING_LIST] List error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - add recipient
router.post('/', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO mailing_list (email, name) VALUES ($1, $2) RETURNING *`,
      [email, name || null],
    );

    console.log(`[MAILING_LIST] Added recipient: ${email}`);
    return res.status(201).json({ recipient: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists in mailing list' });
    }
    console.error('[MAILING_LIST] Create error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - remove
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM mailing_list WHERE id = $1', [req.params.id]);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    console.log(`[MAILING_LIST] Deleted recipient id=${req.params.id}`);
    return res.json({ message: 'Recipient deleted' });
  } catch (err) {
    console.error('[MAILING_LIST] Delete error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id - update (toggle active, change name/email)
router.patch('/:id', async (req, res) => {
  try {
    const { is_active, name, email } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;

    if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(is_active); }
    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (email !== undefined) { fields.push(`email = $${idx++}`); values.push(email); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE mailing_list SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    console.log(`[MAILING_LIST] Updated recipient id=${req.params.id}`);
    return res.json({ recipient: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists in mailing list' });
    }
    console.error('[MAILING_LIST] Update error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
