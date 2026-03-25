import { Router } from 'express';
import pool from '../db.js';
import { authenticate } from '../auth.js';

const router = Router();

router.use(authenticate);

// GET /summary
router.get('/summary', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM infractions WHERE is_dismissed = false) AS total_infractions,
        (SELECT COUNT(*)::int FROM infractions
         WHERE is_dismissed = false
           AND detected_at >= date_trunc('week', CURRENT_DATE)) AS infractions_this_week,
        (SELECT COUNT(*)::int FROM companies WHERE is_active = true) AS companies_monitored,
        (SELECT COUNT(*)::int FROM social_accounts WHERE is_active = true) AS accounts_monitored
    `);
    return res.json(rows[0]);
  } catch (err) {
    console.error('[DASHBOARD] Summary error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /leaderboard
router.get('/leaderboard', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        c.id, c.name, c.logo_url,
        COUNT(i.id)::int AS total_infractions,
        COUNT(i.id) FILTER (
          WHERE i.detected_at >= date_trunc('week', CURRENT_DATE)
        )::int AS this_week
      FROM companies c
      JOIN social_accounts sa ON sa.company_id = c.id
      JOIN posts p ON p.social_account_id = sa.id
      JOIN infractions i ON i.post_id = p.id AND i.is_dismissed = false
      GROUP BY c.id, c.name, c.logo_url
      ORDER BY total_infractions DESC
    `);
    return res.json({ leaderboard: rows });
  } catch (err) {
    console.error('[DASHBOARD] Leaderboard error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /recent - 10 most recent non-dismissed infractions
router.get('/recent', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        i.id, i.detected_ip_types, i.confidence_score, i.detected_at,
        c.name AS company_name,
        sa.platform,
        p.thumbnail_url
      FROM infractions i
      JOIN posts p ON p.id = i.post_id
      JOIN social_accounts sa ON sa.id = p.social_account_id
      JOIN companies c ON c.id = sa.company_id
      WHERE i.is_dismissed = false
      ORDER BY i.detected_at DESC
      LIMIT 10
    `);
    return res.json({ infractions: rows });
  } catch (err) {
    console.error('[DASHBOARD] Recent error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /timeline - daily infraction counts for past 30 days
router.get('/timeline', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      WITH days AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '29 days',
          CURRENT_DATE,
          '1 day'
        )::date AS day
      )
      SELECT
        d.day,
        COALESCE(COUNT(i.id), 0)::int AS count
      FROM days d
      LEFT JOIN infractions i
        ON i.detected_at::date = d.day
        AND i.is_dismissed = false
      GROUP BY d.day
      ORDER BY d.day
    `);
    return res.json({ timeline: rows });
  } catch (err) {
    console.error('[DASHBOARD] Timeline error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
