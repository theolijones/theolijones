import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireGroup } from '../middleware/auth';
import * as schemaService from '../services/schema-service';

const router = Router();

router.use(authenticate);

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// GET /api/v1/schema
router.get('/', asyncHandler(async (_req, res) => {
  const schema = await schemaService.getSchema();
  res.json({ success: true, data: schema });
}));

// PATCH /api/v1/schema — update custom field definitions (admin only)
router.patch('/', requireGroup('admin'), asyncHandler(async (req, res) => {
  const { fields } = req.body;
  if (!fields || !Array.isArray(fields)) {
    res.status(400).json({ success: false, error: 'fields array is required' });
    return;
  }
  const schema = await schemaService.updateSchema(fields, req.user!.id);
  res.json({ success: true, data: schema });
}));

export default router;
