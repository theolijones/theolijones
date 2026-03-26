import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/v1/folders
router.get('/', async (_req: Request, res: Response) => {
  res.json({ success: true, data: [], total: 0, page: 1, limit: 25 });
});

// POST /api/v1/folders
router.post('/', async (_req: Request, res: Response) => {
  res.status(201).json({ success: true, data: {} });
});

// PATCH /api/v1/folders/:id
router.patch('/:id', async (req: Request, res: Response) => {
  res.json({ success: true, data: { id: req.params.id } });
});

// DELETE /api/v1/folders/:id
router.delete('/:id', async (req: Request, res: Response) => {
  res.json({ success: true, data: { id: req.params.id } });
});

export default router;
