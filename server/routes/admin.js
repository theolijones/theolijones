import { Router } from 'express';
import { authenticate, adminOnly } from '../auth.js';

const router = Router();

router.use(authenticate, adminOnly);

// POST /scrape-now
router.post('/scrape-now', async (_req, res) => {
  try {
    const { runScrape } = await import('../services/scheduler.js');
    console.log('[ADMIN] Manual scrape triggered');
    await runScrape();
    return res.json({ message: 'Scrape completed' });
  } catch (err) {
    console.error('[ADMIN] Scrape error:', err.message);
    return res.status(500).json({ error: 'Scrape failed: ' + err.message });
  }
});

// POST /send-weekly-report
router.post('/send-weekly-report', async (_req, res) => {
  try {
    const { sendWeeklyReport } = await import('../services/scheduler.js');
    console.log('[ADMIN] Manual weekly report triggered');
    await sendWeeklyReport();
    return res.json({ message: 'Weekly report sent' });
  } catch (err) {
    console.error('[ADMIN] Weekly report error:', err.message);
    return res.status(500).json({ error: 'Weekly report failed: ' + err.message });
  }
});

export default router;
