import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import * as folderService from '../services/folder-service';

const router = Router();

router.use(authenticate);

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// GET /api/v1/folders
router.get('/', asyncHandler(async (_req, res) => {
  const folders = await folderService.listFolders();
  res.json({ success: true, data: folders });
}));

// GET /api/v1/folders/tree
router.get('/tree', asyncHandler(async (_req, res) => {
  const tree = await folderService.buildFolderTree();
  res.json({ success: true, data: tree });
}));

// GET /api/v1/folders/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const folder = await folderService.getFolder(req.params.id);
  res.json({ success: true, data: folder });
}));

// POST /api/v1/folders
router.post('/', asyncHandler(async (req, res) => {
  const folder = await folderService.createFolder(req.body, req.user!.id);
  res.status(201).json({ success: true, data: folder });
}));

// PATCH /api/v1/folders/:id
router.patch('/:id', asyncHandler(async (req, res) => {
  const folder = await folderService.updateFolder(req.params.id, req.body);
  res.json({ success: true, data: folder });
}));

// DELETE /api/v1/folders/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  await folderService.deleteFolder(req.params.id);
  res.json({ success: true, data: { id: req.params.id } });
}));

export default router;
