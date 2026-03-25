import { Router } from 'express';
import pool from '../db.js';
import { authenticate, adminOnly } from '../auth.js';

const router = Router();

router.use(authenticate);

// GET / - list all companies with social_accounts count
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*,
             COALESCE(sa.account_count, 0)::int AS account_count
      FROM companies c
      LEFT JOIN (
        SELECT company_id, COUNT(*) AS account_count
        FROM social_accounts
        GROUP BY company_id
      ) sa ON sa.company_id = c.id
      ORDER BY c.id
    `);
    return res.json({ companies: rows });
  } catch (err) {
    console.error('[COMPANIES] List error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create company (admin only)
router.post('/', adminOnly, async (req, res) => {
  try {
    const { name, logo_url, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO companies (name, logo_url, notes, created_by_user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, logo_url || null, notes || null, req.user.id],
    );

    console.log(`[COMPANIES] Created company: ${name}`);
    return res.status(201).json({ company: rows[0] });
  } catch (err) {
    console.error('[COMPANIES] Create error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id - update company (admin only)
router.patch('/:id', adminOnly, async (req, res) => {
  try {
    const { name, logo_url, notes } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (logo_url !== undefined) { fields.push(`logo_url = $${idx++}`); values.push(logo_url); }
    if (notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(notes); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE companies SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    console.log(`[COMPANIES] Updated company id=${req.params.id}`);
    return res.json({ company: rows[0] });
  } catch (err) {
    console.error('[COMPANIES] Update error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - soft delete (admin only)
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE companies SET is_active = false WHERE id = $1 RETURNING *`,
      [req.params.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    console.log(`[COMPANIES] Soft-deleted company id=${req.params.id}`);
    return res.json({ company: rows[0] });
  } catch (err) {
    console.error('[COMPANIES] Delete error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
