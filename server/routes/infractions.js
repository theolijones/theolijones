import { Router } from 'express';
import pool from '../db.js';
import { authenticate, adminOnly } from '../auth.js';

const router = Router();

router.use(authenticate);

// GET / - paginated, filterable list
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];
    const values = [];
    let idx = 1;

    if (req.query.company_id) {
      conditions.push(`c.id = $${idx++}`);
      values.push(req.query.company_id);
    }
    if (req.query.platform) {
      conditions.push(`sa.platform = $${idx++}`);
      values.push(req.query.platform);
    }
    if (req.query.date_start) {
      conditions.push(`i.detected_at >= $${idx++}`);
      values.push(req.query.date_start);
    }
    if (req.query.date_end) {
      conditions.push(`i.detected_at <= $${idx++}`);
      values.push(req.query.date_end);
    }
    if (req.query.dismissed !== undefined) {
      conditions.push(`i.is_dismissed = $${idx++}`);
      values.push(req.query.dismissed === 'true');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM infractions i
       JOIN posts p ON p.id = i.post_id
       JOIN social_accounts sa ON sa.id = p.social_account_id
       JOIN companies c ON c.id = sa.company_id
       ${where}`,
      values,
    );

    const total = countResult.rows[0].total;

    const dataValues = [...values, limit, offset];
    const { rows } = await pool.query(
      `SELECT i.*,
              p.caption, p.post_url, p.thumbnail_url, p.posted_at,
              sa.platform, sa.handle,
              c.id AS company_id, c.name AS company_name
       FROM infractions i
       JOIN posts p ON p.id = i.post_id
       JOIN social_accounts sa ON sa.id = p.social_account_id
       JOIN companies c ON c.id = sa.company_id
       ${where}
       ORDER BY i.detected_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      dataValues,
    );

    return res.json({
      infractions: rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[INFRACTIONS] List error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - single infraction detail
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*,
              p.caption, p.post_url, p.thumbnail_url, p.posted_at, p.platform_post_id,
              sa.platform, sa.handle, sa.account_url,
              c.id AS company_id, c.name AS company_name, c.logo_url AS company_logo_url,
              u.name AS dismissed_by_name
       FROM infractions i
       JOIN posts p ON p.id = i.post_id
       JOIN social_accounts sa ON sa.id = p.social_account_id
       JOIN companies c ON c.id = sa.company_id
       LEFT JOIN users u ON u.id = i.dismissed_by_user_id
       WHERE i.id = $1`,
      [req.params.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Infraction not found' });
    }

    return res.json({ infraction: rows[0] });
  } catch (err) {
    console.error('[INFRACTIONS] Detail error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id/dismiss - dismiss infraction (admin only)
router.patch('/:id/dismiss', adminOnly, async (req, res) => {
  try {
    const { reason } = req.body;

    const { rows } = await pool.query(
      `UPDATE infractions
       SET is_dismissed = true,
           dismissed_by_user_id = $1,
           dismissed_at = NOW(),
           dismissed_reason = $2
       WHERE id = $3
       RETURNING *`,
      [req.user.id, reason || null, req.params.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Infraction not found' });
    }

    console.log(`[INFRACTIONS] Dismissed infraction id=${req.params.id} by user ${req.user.id}`);
    return res.json({ infraction: rows[0] });
  } catch (err) {
    console.error('[INFRACTIONS] Dismiss error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
