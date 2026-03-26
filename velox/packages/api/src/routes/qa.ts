import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/v1/qa — list QA records
router.get('/', async (_req: Request, res: Response) => {
  res.json({ success: true, data: [], total: 0, page: 1, limit: 25 });
});

// GET /api/v1/qa/:id
router.get('/:id', async (req: Request, res: Response) => {
  res.json({ success: true, data: { id: req.params.id } });
});

// PATCH /api/v1/qa/:id — update QA record (approve/reject/add notes)
router.patch('/:id', async (req: Request, res: Response) => {
  res.json({ success: true, data: { id: req.params.id } });
});

// GET /api/v1/qa/rules — get QA rules
router.get('/rules/list', async (_req: Request, res: Response) => {
  res.json({ success: true, data: [] });
});

// PATCH /api/v1/qa/rules — update QA rules (admin only)
router.patch('/rules/update', async (_req: Request, res: Response) => {
  res.json({ success: true, data: [] });
});

export default router;
