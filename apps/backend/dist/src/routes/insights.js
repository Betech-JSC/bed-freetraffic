"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const aiRecommendations_1 = require("../services/aiRecommendations");
const router = (0, express_1.Router)();
// authenticate + workspaceMiddleware are applied at index.ts level
router.get('/', async (req, res) => {
    const withAi = req.query.ai === '1' || req.query.ai === 'true';
    const items = await (0, aiRecommendations_1.buildRecommendations)(req.workspaceId);
    if (!withAi) {
        res.json({ items, summary: null });
        return;
    }
    const enhanced = await (0, aiRecommendations_1.enhanceWithOpenAi)(items);
    res.json(enhanced);
});
exports.default = router;
