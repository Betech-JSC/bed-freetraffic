"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const cache_1 = require("../lib/cache");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/groups', async (req, res) => {
    const groups = await prisma_1.default.keywordGroup.findMany({
        where: { workspaceId: req.workspaceId },
        include: { _count: { select: { keywords: true } } },
        orderBy: { name: 'asc' },
    });
    res.json(groups);
});
router.post('/groups', auth_1.requireWrite, async (req, res) => {
    const { name } = req.body;
    if (!name) {
        res.status(400).json({ error: 'Tên nhóm là bắt buộc' });
        return;
    }
    const group = await prisma_1.default.keywordGroup.create({
        data: {
            name,
            workspaceId: req.workspaceId
        }
    });
    res.status(201).json(group);
});
router.get('/', async (req, res) => {
    const cacheKey = `ws:${req.workspaceId}:keywords`;
    try {
        const cached = await cache_1.cache.get(cacheKey);
        if (cached) {
            res.json(cached);
            return;
        }
        const keywords = await prisma_1.default.seoKeyword.findMany({
            where: { workspaceId: req.workspaceId },
            include: { channel: true, group: true },
            orderBy: { createdAt: 'desc' },
        });
        await cache_1.cache.set(cacheKey, keywords, 300); // Cache for 5 minutes
        res.json(keywords);
    }
    catch (error) {
        console.error('[GET /keywords]', error);
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
router.get('/:id/history', async (req, res) => {
    const id = parseInt(req.params.id);
    const keyword = await prisma_1.default.seoKeyword.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!keyword) {
        res.status(404).json({ error: 'Không tìm thấy từ khóa' });
        return;
    }
    const history = await prisma_1.default.keywordRankHistory.findMany({
        where: { keywordId: id },
        orderBy: { recordedAt: 'desc' },
        take: 90,
    });
    res.json(history);
});
router.post('/', auth_1.requireWrite, async (req, res) => {
    const { keyword, url, currentPosition, searchVolume, channelId, groupId } = req.body;
    if (!keyword) {
        res.status(400).json({ error: 'Từ khóa là bắt buộc' });
        return;
    }
    const seoKeyword = await prisma_1.default.seoKeyword.create({
        data: {
            keyword,
            url,
            currentPosition: currentPosition ? parseInt(currentPosition) : null,
            searchVolume: searchVolume ? parseInt(searchVolume) : null,
            channelId: channelId ? parseInt(channelId) : null,
            groupId: groupId ? parseInt(groupId) : null,
            workspaceId: req.workspaceId,
        },
        include: { channel: true, group: true },
    });
    if (seoKeyword.currentPosition != null) {
        await prisma_1.default.keywordRankHistory.create({
            data: {
                keywordId: seoKeyword.id,
                position: seoKeyword.currentPosition,
                source: 'manual',
            },
        });
    }
    // Invalidate cache
    if (req.workspaceId) {
        void (0, cache_1.invalidateWorkspaceCache)(req.workspaceId, ['keywords', 'report', 'dashboard']).catch(err => {
            console.error('[Cache Invalidation Error]:', err);
        });
    }
    res.status(201).json(seoKeyword);
});
router.patch('/:id', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const { currentPosition, ...rest } = req.body;
    const existing = await prisma_1.default.seoKeyword.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!existing) {
        res.status(404).json({ error: 'Không tìm thấy từ khóa' });
        return;
    }
    const seoKeyword = await prisma_1.default.seoKeyword.update({
        where: { id },
        data: {
            ...rest,
            currentPosition: currentPosition != null ? parseInt(currentPosition) : undefined,
            channelId: rest.channelId != null ? parseInt(rest.channelId) : undefined,
            groupId: rest.groupId != null ? parseInt(rest.groupId) : undefined,
        },
        include: { channel: true, group: true },
    });
    if (currentPosition != null) {
        await prisma_1.default.keywordRankHistory.create({
            data: {
                keywordId: id,
                position: parseInt(currentPosition),
                source: 'manual',
            },
        });
    }
    // Invalidate cache
    if (req.workspaceId) {
        void (0, cache_1.invalidateWorkspaceCache)(req.workspaceId, ['keywords', 'report', 'dashboard']).catch(err => {
            console.error('[Cache Invalidation Error]:', err);
        });
    }
    res.json(seoKeyword);
});
router.delete('/:id', auth_1.requireWrite, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await prisma_1.default.seoKeyword.findFirst({
        where: { id, workspaceId: req.workspaceId }
    });
    if (!existing) {
        res.status(404).json({ error: 'Không tìm thấy từ khóa' });
        return;
    }
    await prisma_1.default.seoKeyword.delete({ where: { id } });
    // Invalidate cache
    if (req.workspaceId) {
        void (0, cache_1.invalidateWorkspaceCache)(req.workspaceId, ['keywords', 'report', 'dashboard']).catch(err => {
            console.error('[Cache Invalidation Error]:', err);
        });
    }
    res.status(204).send();
});
exports.default = router;
