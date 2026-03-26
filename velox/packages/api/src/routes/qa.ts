import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireGroup } from '../middleware/auth';
import {
  listQARecords, getQARecord, getQARecordByVideoId, createQARecord,
  updateQARecord, deleteQARecord,
  listQARules, upsertQARule, deleteQARule,
  runFlaggingRules,
} from '../services/qa-service';
import { getTranscript } from '../services/transcript-service';

const router = Router();
router.use(authenticate);

// ── QA Records ──────────────────────────────────────────────────────

// GET /api/v1/qa — list QA records, optionally filtered by status
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, assignedTo } = req.query as Record<string, string>;
    const records = await listQARecords({ status: status as any, assignedTo });
    res.json({ success: true, data: records, total: records.length });
  } catch (err) { next(err); }
});

// GET /api/v1/qa/video/:videoId — get QA record for a specific video
router.get('/video/:videoId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await getQARecordByVideoId(req.params.videoId);
    if (!record) {
      res.json({ success: true, data: null });
      return;
    }
    res.json({ success: true, data: record });
  } catch (err) { next(err); }
});

// GET /api/v1/qa/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await getQARecord(req.params.id);
    res.json({ success: true, data: record });
  } catch (err) { next(err); }
});

// POST /api/v1/qa — create a QA record (or re-run flagging) for a video
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { videoId } = req.body;
    if (!videoId) {
      res.status(400).json({ success: false, error: 'videoId is required' });
      return;
    }

    // Try to get transcript and run rules
    let automatedFlags: any[] = [];
    try {
      const { segments } = await getTranscript(videoId);
      const rules = await listQARules();
      automatedFlags = runFlaggingRules(rules, segments);
    } catch {
      // No transcript yet — create record without flags
    }

    const record = await createQARecord(videoId, automatedFlags);
    res.status(201).json({ success: true, data: record });
  } catch (err) { next(err); }
});

// PATCH /api/v1/qa/:id — update QA record (approve/reject/assign/add notes/flags)
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, assignedTo, transcriptNotes, flaggedSegments } = req.body;
    const record = await updateQARecord(req.params.id, {
      status,
      assignedTo,
      transcriptNotes,
      flaggedSegments,
      reviewedBy: (status === 'approved' || status === 'rejected') ? req.user?.id : undefined,
    });
    res.json({ success: true, data: record });
  } catch (err) { next(err); }
});

// POST /api/v1/qa/:id/rerun — re-run automated flagging
router.post('/:id/rerun', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await getQARecord(req.params.id);
    let automatedFlags: any[] = [];
    try {
      const { segments } = await getTranscript(existing.videoId);
      const rules = await listQARules();
      automatedFlags = runFlaggingRules(rules, segments);
    } catch {
      // transcript not available
    }
    const record = await updateQARecord(req.params.id, { status: 'pending' });
    // update automated flags directly via the create function (which handles upsert)
    const updated = await createQARecord(existing.videoId, automatedFlags);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// DELETE /api/v1/qa/:id
router.delete('/:id', requireGroup('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteQARecord(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── QA Rules ────────────────────────────────────────────────────────

// GET /api/v1/qa/rules/list
router.get('/rules/list', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await listQARules();
    res.json({ success: true, data: rules });
  } catch (err) { next(err); }
});

// PUT /api/v1/qa/rules — create or update a rule
router.put('/rules', requireGroup('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rule = await upsertQARule(req.body);
    res.json({ success: true, data: rule });
  } catch (err) { next(err); }
});

// DELETE /api/v1/qa/rules/:ruleId
router.delete('/rules/:ruleId', requireGroup('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteQARule(req.params.ruleId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
