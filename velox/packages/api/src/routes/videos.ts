import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import * as videoService from '../services/video-service';

const router = Router();

router.use(authenticate);

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// GET /api/v1/videos
router.get('/', asyncHandler(async (req, res) => {
  const result = await videoService.listVideos({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    folderId: req.query.folderId as string | undefined,
    status: req.query.status as string | undefined,
    sort: req.query.sort as string | undefined,
  });
  res.json({ success: true, ...result });
}));

// GET /api/v1/videos/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const video = await videoService.getVideo(req.params.id);
  res.json({ success: true, data: video });
}));

// POST /api/v1/videos
router.post('/', asyncHandler(async (req, res) => {
  const video = await videoService.createVideo(req.body, req.user!.id);
  res.status(201).json({ success: true, data: video });
}));

// POST /api/v1/videos/upload-url — get presigned upload URL
router.post('/upload-url', asyncHandler(async (req, res) => {
  const { filename, contentType } = req.body;
  if (!filename || !contentType) {
    res.status(400).json({ success: false, error: 'filename and contentType are required' });
    return;
  }
  const result = await videoService.getUploadUrl(filename, contentType);
  res.json({ success: true, data: result });
}));

// PATCH /api/v1/videos/:id
router.patch('/:id', asyncHandler(async (req, res) => {
  const video = await videoService.updateVideo(req.params.id, req.body);
  res.json({ success: true, data: video });
}));

// DELETE /api/v1/videos/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  await videoService.deleteVideo(req.params.id);
  res.json({ success: true, data: { id: req.params.id } });
}));

// POST /api/v1/videos/:id/publish
router.post('/:id/publish', asyncHandler(async (req, res) => {
  const video = await videoService.updateVideo(req.params.id, { status: 'published' });
  res.json({ success: true, data: video });
}));

// GET /api/v1/videos/:id/transcript
router.get('/:id/transcript', asyncHandler(async (req, res) => {
  const transcriptService = await import('../services/transcript-service');
  const result = await transcriptService.getTranscript(req.params.id);
  res.json({ success: true, data: { videoId: req.params.id, ...result } });
}));

// PATCH /api/v1/videos/:id/transcript — update segments, regenerate WebVTT
router.patch('/:id/transcript', asyncHandler(async (req, res) => {
  const transcriptService = await import('../services/transcript-service');
  const { segments } = req.body;
  if (!segments || !Array.isArray(segments)) {
    res.status(400).json({ success: false, error: 'segments array is required' });
    return;
  }
  const result = await transcriptService.updateTranscript(req.params.id, segments);
  res.json({ success: true, data: { videoId: req.params.id, ...result } });
}));

// GET /api/v1/videos/:id/captions — proxy WebVTT file
router.get('/:id/captions', asyncHandler(async (req, res) => {
  const transcriptService = await import('../services/transcript-service');
  const vtt = await transcriptService.getCaptionsVTT(req.params.id);
  res.type('text/vtt').send(vtt);
}));

export default router;
