import { Router } from 'express';
import bcrypt from 'bcrypt';
import pool from '../db.js';
import { authenticate, adminOnly } from '../auth.js';

const router = Router();

router.use(authenticate, adminOnly);

// GET / - list all users
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, role, name, created_at, last_login FROM users ORDER BY id',
    );
    return res.json({ users: rows });
  } catch (err) {
    console.error('[USERS] List error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create user
router.post('/', async (req, res) => {
  try {
    const { email, name, role, password } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ error: 'email, name, and password are required' });
    }

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, role, name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, role, name, created_at`,
      [email, hash, role || 'viewer', name],
    );

    console.log(`[USERS] Created user: ${email}`);
    return res.status(201).json({ user: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error('[USERS] Create error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - delete user
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`[USERS] Deleted user id=${req.params.id}`);
    return res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('[USERS] Delete error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id - update role or name
router.patch('/:id', async (req, res) => {
  try {
    const { role, name } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;

    if (role !== undefined) {
      fields.push(`role = $${idx++}`);
      values.push(role);
    }
    if (name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(name);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING id, email, role, name, created_at, last_login`,
      values,
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`[USERS] Updated user id=${req.params.id}`);
    return res.json({ user: rows[0] });
  } catch (err) {
    console.error('[USERS] Update error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
