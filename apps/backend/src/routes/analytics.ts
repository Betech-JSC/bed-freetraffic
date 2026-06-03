import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [logs, tasks, connections, keywords] = await Promise.all([
      prisma.botLog.findMany({
        where: { task: { workspaceId: req.workspaceId } },
        take: 200,
        orderBy: { createdAt: 'desc' },
        include: { task: { select: { name: true } } }
      }),
      prisma.automationTask.findMany({
        where: { workspaceId: req.workspaceId },
        select: { id: true, name: true, status: true, platforms: true, lastRunAt: true }
      }),
      prisma.socialConnection.findMany({
        where: { workspaceId: req.workspaceId },
        select: { platform: true, pageName: true, status: true }
      }),
      prisma.seoKeyword.count({
        where: { workspaceId: req.workspaceId }
      })
    ]);

    const successCount = logs.filter(l => l.status === 'SUCCESS').length;
    const errorCount = logs.filter(l => l.status === 'ERROR').length;
    const total = successCount + errorCount;

    const byPlatform: Record<string, { success: number; error: number }> = {};
    for (const log of logs) {
      const key = log.action.replace('POST_', '').toLowerCase();
      if (!byPlatform[key]) byPlatform[key] = { success: 0, error: 0 };
      if (log.status === 'SUCCESS') byPlatform[key].success++;
      else byPlatform[key].error++;
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

export default router;
