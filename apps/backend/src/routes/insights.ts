import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { WorkspaceRequest } from '../middleware/workspace';
import { buildRecommendations, enhanceWithOpenAi } from '../services/aiRecommendations';

const router = Router();
// authenticate + workspaceMiddleware are applied at index.ts level

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
