"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const [logs, tasks, connections, keywords] = await Promise.all([
            prisma_1.default.botLog.findMany({
                where: { task: { workspaceId: req.workspaceId } },
                take: 200,
                orderBy: { createdAt: 'desc' },
                include: { task: { select: { name: true } } }
            }),
            prisma_1.default.automationTask.findMany({
                where: { workspaceId: req.workspaceId },
                select: { id: true, name: true, status: true, platforms: true, lastRunAt: true }
            }),
            prisma_1.default.socialConnection.findMany({
                where: { workspaceId: req.workspaceId },
                select: { platform: true, pageName: true, status: true }
            }),
            prisma_1.default.seoKeyword.count({
                where: { workspaceId: req.workspaceId }
            })
        ]);
        const successCount = logs.filter(l => l.status === 'SUCCESS').length;
        const errorCount = logs.filter(l => l.status === 'ERROR').length;
        const total = successCount + errorCount;
        const byPlatform = {};
        for (const log of logs) {
            const key = log.action.replace('POST_', '').toLowerCase();
            if (!byPlatform[key])
                byPlatform[key] = { success: 0, error: 0 };
            if (log.status === 'SUCCESS')
                byPlatform[key].success++;
            else
                byPlatform[key].error++;
        }
        const chartData = Object.entries(byPlatform).map(([name, stats]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            success: stats.success,
            error: stats.error
        }));
        res.json({
            summary: {
                totalLogs: logs.length,
                successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
                runningBots: tasks.filter(t => t.status === 'RUNNING').length,
                totalBots: tasks.length,
                totalKeywords: keywords,
                connectedPlatforms: connections.filter(c => c.status === 'CONNECTED').length
            },
            connections,
            tasks,
            recentLogs: logs.slice(0, 30),
            chartData: chartData.length > 0 ? chartData : [
                { name: 'Facebook', success: 0, error: 0 },
                { name: 'Email', success: 0, error: 0 },
                { name: 'Zalo', success: 0, error: 0 }
            ]
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi máy chủ' });
    }
});
exports.default = router;
