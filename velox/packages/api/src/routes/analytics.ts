import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/v1/analytics/video/:id — GA4 Data API results merged with video metadata
router.get('/video/:id', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      videoId: req.params.id,
      views: 0,
      avgWatchTime: 0,
      completionRate: 0,
      milestones: { '25': 0, '50': 0, '75': 0, '100': 0 },
    },
  });
});

// GET /api/v1/analytics/dashboard — dashboard overview data
router.get('/dashboard', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      topPerformers: [],
      placementPerformance: [],
      trending: [],
      contentHealth: {
        processing: 0,
        transcribed: 0,
        published: 0,
        scheduled: 0,
        failed: 0,
      },
    },
  });
});

export default router;
