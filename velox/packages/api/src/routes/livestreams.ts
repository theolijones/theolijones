import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/v1/livestreams
router.get('/', async (_req: Request, res: Response) => {
  res.json({ success: true, data: [], total: 0, page: 1, limit: 25 });
});

// POST /api/v1/livestreams — provision MediaLive channel + stream key
router.post('/', async (_req: Request, res: Response) => {
  res.status(201).json({ success: true, data: {} });
});

// PATCH /api/v1/livestreams/:id
router.patch('/:id', async (req: Request, res: Response) => {
  res.json({ success: true, data: { id: req.params.id } });
});

// DELETE /api/v1/livestreams/:id
router.delete('/:id', async (req: Request, res: Response) => {
  res.json({ success: true, data: { id: req.params.id } });
});

// POST /api/v1/livestreams/:id/start
router.post('/:id/start', async (req: Request, res: Response) => {
  res.json({ success: true, data: { id: req.params.id, status: 'starting' } });
});

// POST /api/v1/livestreams/:id/stop
router.post('/:id/stop', async (req: Request, res: Response) => {
  res.json({ success: true, data: { id: req.params.id, status: 'stopping' } });
});

// GET /api/v1/livestreams/:id/outputs — get MediaPackage endpoints
router.get('/:id/outputs', async (req: Request, res: Response) => {
  res.json({ success: true, data: { id: req.params.id, outputs: [] } });
});

export default router;
