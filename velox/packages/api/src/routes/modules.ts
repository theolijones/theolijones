import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/v1/modules
router.get('/', async (_req: Request, res: Response) => {
  res.json({ success: true, data: [], total: 0, page: 1, limit: 25 });
});

// GET /api/v1/modules/:id
router.get('/:id', async (req: Request, res: Response) => {
  res.json({ success: true, data: { id: req.params.id } });
});

// POST /api/v1/modules
router.post('/', async (_req: Request, res: Response) => {
  res.status(201).json({ success: true, data: {} });
});

// PATCH /api/v1/modules/:id
router.patch('/:id', async (req: Request, res: Response) => {
  res.json({ success: true, data: { id: req.params.id } });
});

// DELETE /api/v1/modules/:id
router.delete('/:id', async (req: Request, res: Response) => {
  res.json({ success: true, data: { id: req.params.id } });
});

// GET /api/v1/modules/:id/embed — get embed code
router.get('/:id/embed', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      id: req.params.id,
      html: '',
      iframeUrl: '',
      config: {},
    },
  });
});

export default router;
