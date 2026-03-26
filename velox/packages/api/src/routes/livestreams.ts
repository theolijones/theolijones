import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import * as livestreamService from '../services/livestream-service';

const router = Router();
router.use(authenticate);

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => { fn(req, res, next).catch(next); };
}

router.get('/', asyncHandler(async (_req, res) => {
  const streams = await livestreamService.listLivestreams();
  res.json({ success: true, data: streams, total: streams.length, page: 1, limit: streams.length });
}));

router.post('/', asyncHandler(async (req, res) => {
  const stream = await livestreamService.createLivestream(req.body, req.user!.id);
  res.status(201).json({ success: true, data: stream });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const stream = await livestreamService.getLivestream(req.params.id);
  res.json({ success: true, data: stream });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const stream = await livestreamService.updateLivestream(req.params.id, req.body);
  res.json({ success: true, data: stream });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await livestreamService.deleteLivestream(req.params.id);
  res.json({ success: true, data: { id: req.params.id } });
}));

router.post('/:id/start', asyncHandler(async (req, res) => {
  const stream = await livestreamService.startLivestream(req.params.id);
  res.json({ success: true, data: stream });
}));

router.post('/:id/stop', asyncHandler(async (req, res) => {
  const stream = await livestreamService.stopLivestream(req.params.id);
  res.json({ success: true, data: stream });
}));

router.get('/:id/status', asyncHandler(async (req, res) => {
  const status = await livestreamService.getStreamStatus(req.params.id);
  res.json({ success: true, data: status });
}));

router.get('/:id/outputs', asyncHandler(async (req, res) => {
  const outputs = await livestreamService.getOutputs(req.params.id);
  res.json({ success: true, data: { id: req.params.id, outputs } });
}));

export default router;
