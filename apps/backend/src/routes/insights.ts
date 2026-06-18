import { Router, Response } from 'express';
import { WorkspaceRequest } from '../middleware/workspace';
import { buildRecommendations, enhanceWithOpenAi, generateCmoReport } from '../services/aiRecommendations';

const router = Router();
// authenticate + workspaceMiddleware are applied at index.ts level

// GET /api/insights/cmo - Returns strategic AI CMO report
router.get('/cmo', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const report = await generateCmoReport(req.workspaceId!);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Lỗi hệ thống khi sinh báo cáo AI CMO.' });
  }
});

router.get('/', async (req: WorkspaceRequest, res: Response): Promise<void> => {
  const withAi = req.query.ai === '1' || req.query.ai === 'true';
  const items = await buildRecommendations(req.workspaceId);
  if (!withAi) {
    res.json({ items, summary: null });
    return;
  }
  const enhanced = await enhanceWithOpenAi(items);
  res.json(enhanced);
});

export default router;
