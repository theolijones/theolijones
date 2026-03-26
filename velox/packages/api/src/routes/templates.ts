import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireGroup } from '../middleware/auth';
import {
  listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate, matchTemplate,
} from '../services/template-service';

const router = Router();
router.use(authenticate);

// GET /api/v1/templates — list all templates
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await listTemplates();
    res.json({ success: true, data: templates });
  } catch (err) { next(err); }
});

// GET /api/v1/templates/match — find matching template for a video context
router.get('/match', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileName, folderId, folderPath } = req.query as Record<string, string>;
    if (!fileName) {
      res.status(400).json({ success: false, error: 'fileName query param is required' });
      return;
    }
    const template = await matchTemplate({ fileName, folderId, folderPath });
    res.json({ success: true, data: template });
  } catch (err) { next(err); }
});

// GET /api/v1/templates/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await getTemplate(req.params.id);
    res.json({ success: true, data: template });
  } catch (err) { next(err); }
});

// POST /api/v1/templates
router.post('/', requireGroup('admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await createTemplate(req.body, req.user?.id || 'system');
    res.status(201).json({ success: true, data: template });
  } catch (err) { next(err); }
});

// PATCH /api/v1/templates/:id
router.patch('/:id', requireGroup('admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await updateTemplate(req.params.id, req.body);
    res.json({ success: true, data: template });
  } catch (err) { next(err); }
});

// DELETE /api/v1/templates/:id
router.delete('/:id', requireGroup('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteTemplate(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
