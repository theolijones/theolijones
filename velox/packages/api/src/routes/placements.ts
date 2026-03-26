import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/v1/placements
router.get('/', async (_req: Request, res: Response) => {
  res.json({ success: true, data: [], total: 0, page: 1, limit: 25 });
});

// POST /api/v1/placements
router.post('/', async (_req: Request, res: Response) => {
  res.status(201).json({ success: true, data: {} });
});

// PATCH /api/v1/placements/:id
router.patch('/:id', async (req: Request, res: Response) => {
  res.json({ success: true, data: { id: req.params.id } });
});

// DELETE /api/v1/placements/:id
router.delete('/:id', async (req: Request, res: Response) => {
  res.json({ success: true, data: { id: req.params.id } });
});

// GET /api/v1/placements/:id/videos — ordered list of videos for placement
router.get('/:id/videos', async (req: Request, res: Response) => {
  res.json({ success: true, data: { placementId: req.params.id, videos: [] } });
});

// PATCH /api/v1/placements/:id/videos — reorder videos in placement
router.patch('/:id/videos', async (req: Request, res: Response) => {
  res.json({ success: true, data: { placementId: req.params.id } });
});

export default router;
