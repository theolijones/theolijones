import { Router } from 'express';
import pool from '../db.js';
import { authenticate, adminOnly } from '../auth.js';

const router = Router();

router.use(authenticate);

// GET /companies/:companyId/accounts - list accounts for a company
router.get('/companies/:companyId/accounts', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM social_accounts WHERE company_id = $1 ORDER BY id`,
      [req.params.companyId],
    );
    return res.json({ accounts: rows });
  } catch (err) {
    console.error('[ACCOUNTS] List error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /companies/:companyId/accounts - add account (admin only)
router.post('/companies/:companyId/accounts', adminOnly, async (req, res) => {
  try {
    const { platform, handle, account_url } = req.body;

    if (!platform || !handle) {
      return res.status(400).json({ error: 'platform and handle are required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO social_accounts (company_id, platform, handle, account_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.params.companyId, platform, handle, account_url || null],
    );

    console.log(`[ACCOUNTS] Created account: ${platform}/${handle} for company ${req.params.companyId}`);
    return res.status(201).json({ account: rows[0] });
  } catch (err) {
    console.error('[ACCOUNTS] Create error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - remove account (admin only)
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM social_accounts WHERE id = $1',
      [req.params.id],
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    console.log(`[ACCOUNTS] Deleted account id=${req.params.id}`);
    return res.json({ message: 'Account deleted' });
  } catch (err) {
    console.error('[ACCOUNTS] Delete error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id - toggle active / update (admin only)
router.patch('/:id', adminOnly, async (req, res) => {
  try {
    const { is_active, handle, account_url, platform } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;

    if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(is_active); }
    if (handle !== undefined) { fields.push(`handle = $${idx++}`); values.push(handle); }
    if (account_url !== undefined) { fields.push(`account_url = $${idx++}`); values.push(account_url); }
    if (platform !== undefined) { fields.push(`platform = $${idx++}`); values.push(platform); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE social_accounts SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    console.log(`[ACCOUNTS] Updated account id=${req.params.id}`);
    return res.json({ account: rows[0] });
  } catch (err) {
    console.error('[ACCOUNTS] Update error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
