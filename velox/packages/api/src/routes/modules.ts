import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listModules, getModule, createModule, updateModule, deleteModule, getEmbedCode,
} from '../services/module-service';

const router = Router();
router.use(authenticate);

// GET /api/v1/modules
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const modules = await listModules();
    res.json({ success: true, data: modules, total: modules.length });
  } catch (err) { next(err); }
});

// GET /api/v1/modules/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mod = await getModule(req.params.id);
    res.json({ success: true, data: mod });
  } catch (err) { next(err); }
});

// POST /api/v1/modules
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mod = await createModule(req.body, req.user?.id || 'system');
    res.status(201).json({ success: true, data: mod });
  } catch (err) { next(err); }
});

// PATCH /api/v1/modules/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mod = await updateModule(req.params.id, req.body);
    res.json({ success: true, data: mod });
  } catch (err) { next(err); }
});

// DELETE /api/v1/modules/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteModule(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/v1/modules/:id/embed — get embed code
router.get('/:id/embed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mod = await getModule(req.params.id);
    const embed = getEmbedCode(mod);
    res.json({ success: true, data: { id: mod.id, ...embed } });
  } catch (err) { next(err); }
});

export default router;
