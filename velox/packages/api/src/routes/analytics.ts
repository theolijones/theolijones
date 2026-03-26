import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { getDashboardData, getVideoAnalytics } from '../services/analytics-service';

const router = Router();
router.use(authenticate);

// GET /api/v1/analytics/dashboard — dashboard overview data
router.get('/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getDashboardData();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/v1/analytics/video/:id — per-video analytics
router.get('/video/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getVideoAnalytics(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

export default router;
