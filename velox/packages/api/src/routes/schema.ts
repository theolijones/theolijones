import { Router, Request, Response } from 'express';
import { authenticate, requireGroup } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/v1/schema
router.get('/', async (_req: Request, res: Response) => {
  res.json({ success: true, data: { id: 'default', fields: [] } });
});

// PATCH /api/v1/schema — update custom field definitions (admin only)
router.patch('/', requireGroup('admin'), async (_req: Request, res: Response) => {
  res.json({ success: true, data: { id: 'default', fields: [] } });
});

export default router;
