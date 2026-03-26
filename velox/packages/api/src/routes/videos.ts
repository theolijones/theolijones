import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/v1/videos — list, filter, paginate
router.get('/', async (_req: Request, res: Response) => {
  res.json({ success: true, data: [], total: 0, page: 1, limit: 25 });
});

// GET /api/v1/videos/:id — get with full metadata
router.get('/:id', async (req: Request, res: Response) => {
  res.json({ success: true, data: { id: req.params.id } });
});

// POST /api/v1/videos — create record / initiate upload
router.post('/', async (_req: Request, res: Response) => {
  res.status(201).json({ success: true, data: {} });
});

// PATCH /api/v1/videos/:id — update metadata fields
router.patch('/:id', async (req: Request, res: Response) => {
  res.json({ success: true, data: { id: req.params.id } });
});

// DELETE /api/v1/videos/:id
router.delete('/:id', async (req: Request, res: Response) => {
  res.json({ success: true, data: { id: req.params.id } });
});

// GET /api/v1/videos/:id/transcript
router.get('/:id/transcript', async (req: Request, res: Response) => {
  res.json({ success: true, data: { videoId: req.params.id, segments: [] } });
});

// PATCH /api/v1/videos/:id/transcript — update transcript, triggers WebVTT regen
router.patch('/:id/transcript', async (req: Request, res: Response) => {
  res.json({ success: true, data: { videoId: req.params.id } });
});

// GET /api/v1/videos/:id/captions — proxy to WebVTT file
router.get('/:id/captions', async (req: Request, res: Response) => {
  res.type('text/vtt').send('WEBVTT\n\n');
});

// POST /api/v1/videos/:id/publish — update status to published
router.post('/:id/publish', async (req: Request, res: Response) => {
  res.json({ success: true, data: { id: req.params.id, status: 'published' } });
});

export default router;
