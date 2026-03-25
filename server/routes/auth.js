import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { authenticate } from '../auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { rows } = await pool.query(
      'SELECT id, email, password_hash, role, name FROM users WHERE email = $1',
      [email],
    );

    if (rows.length === 0) {
      console.log(`[AUTH] Login failed – unknown email: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      console.log(`[AUTH] Login failed – wrong password for: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
    });

    console.log(`[AUTH] Login successful: ${email}`);
    return res.json({ user: payload });
  } catch (err) {
    console.error('[AUTH] Login error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /logout
router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  console.log('[AUTH] User logged out');
  return res.json({ message: 'Logged out' });
});

// GET /me
router.get('/me', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, role, name, created_at, last_login FROM users WHERE id = $1',
      [req.user.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user: rows[0] });
  } catch (err) {
    console.error('[AUTH] /me error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
