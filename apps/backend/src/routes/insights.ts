import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { buildRecommendations, enhanceWithOpenAi } from '../services/aiRecommendations';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const withAi = req.query.ai === '1' || req.query.ai === 'true';
  const items = await buildRecommendations();
  if (!withAi) {
    res.json({ items, summary: null });
    return;
  }
  const enhanced = await enhanceWithOpenAi(items);
  res.json(enhanced);
});

export default router;
