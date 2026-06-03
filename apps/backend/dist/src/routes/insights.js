"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const aiRecommendations_1 = require("../services/aiRecommendations");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/', async (req, res) => {
    const withAi = req.query.ai === '1' || req.query.ai === 'true';
    const items = await (0, aiRecommendations_1.buildRecommendations)();
    if (!withAi) {
        res.json({ items, summary: null });
        return;
    }
    const enhanced = await (0, aiRecommendations_1.enhanceWithOpenAi)(items);
    res.json(enhanced);
});
exports.default = router;
