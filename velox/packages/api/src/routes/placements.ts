import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import * as placementService from '../services/placement-service';

const router = Router();
router.use(authenticate);

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => { fn(req, res, next).catch(next); };
}

// GET /api/v1/placements
router.get('/', asyncHandler(async (_req, res) => {
  const placements = await placementService.listPlacements();
  res.json({ success: true, data: placements, total: placements.length, page: 1, limit: placements.length });
}));

// POST /api/v1/placements
router.post('/', asyncHandler(async (req, res) => {
  const placement = await placementService.createPlacement(req.body);
  res.status(201).json({ success: true, data: placement });
}));

// GET /api/v1/placements/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const placement = await placementService.getPlacement(req.params.id);
  res.json({ success: true, data: placement });
}));

// PATCH /api/v1/placements/:id
router.patch('/:id', asyncHandler(async (req, res) => {
  const placement = await placementService.updatePlacement(req.params.id, req.body);
  res.json({ success: true, data: placement });
}));

// DELETE /api/v1/placements/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  await placementService.deletePlacement(req.params.id);
  res.json({ success: true, data: { id: req.params.id } });
}));

// GET /api/v1/placements/:id/videos — evaluated video list
router.get('/:id/videos', asyncHandler(async (req, res) => {
  const placement = await placementService.getPlacement(req.params.id);
  const videos = await placementService.evaluateRules(placement);
  res.json({ success: true, data: { placementId: req.params.id, videos } });
}));

// PATCH /api/v1/placements/:id/videos — reorder (manual override)
router.patch('/:id/videos', asyncHandler(async (req, res) => {
  const { videoIds } = req.body;
  const placement = await placementService.updatePlacement(req.params.id, { manualOrder: videoIds });
  res.json({ success: true, data: placement });
}));

// ─── Schedule Overrides ─────────────────────────────────────

// GET /api/v1/placements/:id/overrides
router.get('/:id/overrides', asyncHandler(async (req, res) => {
  const overrides = await placementService.listOverrides(req.params.id);
  res.json({ success: true, data: overrides });
}));

// POST /api/v1/placements/:id/overrides
router.post('/:id/overrides', asyncHandler(async (req, res) => {
  const override = await placementService.createOverride(
    { ...req.body, placementId: req.params.id },
    req.user!.id
  );
  res.status(201).json({ success: true, data: override });
}));

// DELETE /api/v1/placements/:id/overrides/:overrideId
router.delete('/:id/overrides/:overrideId', asyncHandler(async (req, res) => {
  await placementService.deleteOverride(req.params.overrideId);
  res.json({ success: true, data: { id: req.params.overrideId } });
}));

export default router;
