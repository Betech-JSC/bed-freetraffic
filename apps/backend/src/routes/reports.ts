import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { buildKeywordsPdf, buildTrafficPdf } from '../services/reportPdf';
import { buildSpreadsheetXml } from '../services/reportExcel';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cache } from '../lib/cache';
import { AiReportService } from '../services/aiReportService';

const router = Router();
router.use(authenticate);

router.get('/traffic', async (req: AuthRequest, res: Response): Promise<void> => {
  const days = parseInt((req.query.days as string) || '30');
  const cacheKey = `ws:${req.workspaceId}:report:traffic:${days}`;

  try {
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const snapshots = await prisma.analyticsSnapshot.findMany({
      where: { date: { gte: since }, channelType: 'all', workspaceId: req.workspaceId },
      orderBy: { date: 'asc' },
    });

    const rows = snapshots.map((s) => ({
      date: s.date.toISOString().slice(0, 10),
      sessions: s.sessions,
      users: s.users,
      pageviews: s.pageviews,
      clicks: s.clicks,
      impressions: s.impressions,
    }));

    const result = { rows, total: rows.length };
    await cache.set(cacheKey, result, 60); // Cache for 60 seconds
    res.json(result);
  } catch (error) {
    console.error('[GET /reports/traffic]', error);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.get('/keywords', async (req: AuthRequest, res: Response): Promise<void> => {
  const cacheKey = `ws:${req.workspaceId}:report:keywords`;

  try {
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const keywords = await prisma.seoKeyword.findMany({
      where: { workspaceId: req.workspaceId },
      include: {
        channel: { select: { name: true } },
        rankHistory: { orderBy: { recordedAt: 'desc' }, take: 1 },
      },
      orderBy: { keyword: 'asc' },
    });

    const rows = keywords.map((k) => ({
      keyword: k.keyword,
      url: k.url,
      position: k.currentPosition,
      searchVolume: k.searchVolume,
      channel: k.channel?.name,
      lastClicks: k.rankHistory[0]?.clicks,
      lastImpressions: k.rankHistory[0]?.impressions,
    }));

    const result = { rows };
    await cache.set(cacheKey, result, 60); // Cache for 60 seconds
    res.json(result);
  } catch (error) {
    console.error('[GET /reports/keywords]', error);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.get('/export/csv', async (req: AuthRequest, res: Response): Promise<void> => {
  const type = (req.query.type as string) || 'traffic';
  const days = parseInt((req.query.days as string) || '30');
  const since = new Date();
  since.setDate(since.getDate() - days);

  let csv = '';
  let filename = 'report.csv';

  try {
    if (type === 'keywords') {
      const keywords = await prisma.seoKeyword.findMany({
        where: { workspaceId: req.workspaceId },
        include: { channel: true }
      });
      csv = 'keyword,url,position,searchVolume,channel\n';
      for (const k of keywords) {
        csv += `"${k.keyword}","${k.url || ''}",${k.currentPosition ?? ''},${k.searchVolume ?? ''},"${k.channel?.name || ''}"\n`;
      }
      filename = 'keywords-report.csv';
    } else {
      const snapshots = await prisma.analyticsSnapshot.findMany({
        where: { date: { gte: since }, channelType: 'all', workspaceId: req.workspaceId },
        orderBy: { date: 'asc' },
      });
      csv = 'date,sessions,users,pageviews,clicks,impressions\n';
      for (const s of snapshots) {
        csv += `${s.date.toISOString().slice(0, 10)},${s.sessions},${s.users},${s.pageviews},${s.clicks},${s.impressions}\n`;
      }
      filename = 'traffic-report.csv';
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('[GET /reports/export/csv]', error);
    res.status(500).send('Lỗi xuất file');
  }
});

router.get('/export/xlsx', async (req: AuthRequest, res: Response): Promise<void> => {
  const type = (req.query.type as string) || 'traffic';
  const days = parseInt((req.query.days as string) || '30');
  const since = new Date();
  since.setDate(since.getDate() - days);

  let xml = '';
  let filename = 'report.xls';

  try {
    if (type === 'keywords') {
      const keywords = await prisma.seoKeyword.findMany({
        where: { workspaceId: req.workspaceId },
        include: { channel: { select: { name: true } } },
        orderBy: { keyword: 'asc' },
      });
      xml = buildSpreadsheetXml(
        ['keyword', 'url', 'position', 'searchVolume', 'channel'],
        keywords.map((k) => [k.keyword, k.url, k.currentPosition, k.searchVolume, k.channel?.name])
      );
      filename = 'keywords-report.xls';
    } else {
      const snapshots = await prisma.analyticsSnapshot.findMany({
        where: { date: { gte: since }, channelType: 'all', workspaceId: req.workspaceId },
        orderBy: { date: 'asc' },
      });
      xml = buildSpreadsheetXml(
        ['date', 'sessions', 'users', 'pageviews', 'clicks', 'impressions'],
        snapshots.map((s) => [
          s.date.toISOString().slice(0, 10),
          s.sessions,
          s.users,
          s.pageviews,
          s.clicks,
          s.impressions,
        ])
      );
      filename = 'traffic-report.xls';
    }

    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + xml);
  } catch (error) {
    console.error('[GET /reports/export/xlsx]', error);
    res.status(500).send('Lỗi xuất file');
  }
});

router.get('/export/pdf', async (req: AuthRequest, res: Response): Promise<void> => {
  const type = (req.query.type as string) || 'traffic';
  const days = parseInt((req.query.days as string) || '30');
  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    if (type === 'keywords') {
      const keywords = await prisma.seoKeyword.findMany({
        where: { workspaceId: req.workspaceId },
        include: { channel: { select: { name: true } } },
        orderBy: { keyword: 'asc' },
      });
      const rows = keywords.map((k) => ({
        keyword: k.keyword,
        url: k.url,
        position: k.currentPosition,
        searchVolume: k.searchVolume,
        channel: k.channel?.name,
      }));
      const pdf = await buildKeywordsPdf(rows);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="keywords-report.pdf"');
      res.send(pdf);
      return;
    }

    const snapshots = await prisma.analyticsSnapshot.findMany({
      where: { date: { gte: since }, channelType: 'all', workspaceId: req.workspaceId },
      orderBy: { date: 'asc' },
    });
    const rows = snapshots.map((s) => ({
      date: s.date.toISOString().slice(0, 10),
      sessions: s.sessions,
      users: s.users,
      pageviews: s.pageviews,
      clicks: s.clicks,
      impressions: s.impressions,
    }));
    const pdf = await buildTrafficPdf(rows, days);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="traffic-report.pdf"');
    res.send(pdf);
  } catch (err) {
    console.error('PDF export:', err);
    res.status(500).json({ error: 'Không tạo được PDF' });
  }
});

router.post('/ai-analyze', async (req: AuthRequest, res: Response): Promise<void> => {
  const workspaceId = req.workspaceId;
  if (!workspaceId) {
    res.status(400).json({ error: 'Workspace ID không hợp lệ' });
    return;
  }

  const days = parseInt(req.body.days || '7');
  if (![1, 7, 30, 90].includes(days)) {
    res.status(400).json({ error: 'Khoảng thời gian chỉ chấp nhận 1, 7, 30 hoặc 90 ngày' });
    return;
  }

  const cacheKey = `ws:${workspaceId}:ai-report:analysis:${days}`;

  try {
    const bypassCache = req.body.refresh === true;

    if (!bypassCache) {
      const cached = await cache.get<any>(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }
    }

    const result = await AiReportService.generateAnalysis(workspaceId, days);
    await cache.set(cacheKey, result, 43200); // Cache for 12 hours

    res.json(result);
  } catch (error) {
    console.error('[POST /reports/ai-analyze] error:', error);
    res.status(500).json({ error: 'Lỗi máy chủ khi phân tích AI' });
  }
});

router.get('/traffic-sources', async (req: AuthRequest, res: Response): Promise<void> => {
  const days = parseInt((req.query.days as string) || '30');
  const cacheKey = `ws:${req.workspaceId}:report:traffic-sources:${days}`;

  try {
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const snapshots = await prisma.analyticsSnapshot.findMany({
      where: {
        workspaceId: req.workspaceId,
        date: { gte: since },
      },
    });

    const sourceMap = new Map<string, { sessions: number; users: number; pageviews: number }>();
    const landingMap = new Map<string, { sessions: number; users: number; pageviews: number }>();
    let totalAllSessions = 0;

    for (const s of snapshots) {
      if (s.channelType === 'all') {
        totalAllSessions += s.sessions;
        continue;
      }
      if (!s.channelType) continue;

      if (s.channelType.startsWith('source:')) {
        const src = s.channelType.slice(7);
        const cur = sourceMap.get(src) || { sessions: 0, users: 0, pageviews: 0 };
        cur.sessions += s.sessions;
        cur.users += s.users;
        cur.pageviews += s.pageviews;
        sourceMap.set(src, cur);
      } else if (s.channelType.startsWith('landing:')) {
        const path = s.channelType.slice(8);
        const cur = landingMap.get(path) || { sessions: 0, users: 0, pageviews: 0 };
        cur.sessions += s.sessions;
        cur.users += s.users;
        cur.pageviews += s.pageviews;
        landingMap.set(path, cur);
      }
    }

    let sources = Array.from(sourceMap.entries()).map(([source, data]) => ({
      source,
      ...data,
    }));

    let landingPages = Array.from(landingMap.entries()).map(([path, data]) => ({
      path,
      ...data,
    }));



    // Sort landing pages and sources by sessions descending
    sources.sort((a, b) => b.sessions - a.sessions);
    landingPages.sort((a, b) => b.sessions - a.sessions);

    const result = { sources, landingPages };
    await cache.set(cacheKey, result, 60); // Cache for 60 seconds
    res.json(result);
  } catch (error) {
    console.error('[GET /reports/traffic-sources]', error);
    res.status(500).json({ error: 'Lỗi máy chủ khi tải nguồn truy cập' });
  }
});

router.get('/content-roi', async (req: AuthRequest, res: Response): Promise<void> => {
  const cacheKey = `ws:${req.workspaceId}:report:content-roi`;

  try {
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const schedules = await prisma.contentSchedule.findMany({
      where: {
        workspaceId: req.workspaceId,
        status: 'SUCCESS',
      },
      orderBy: { publishedAt: 'desc' },
    });

    const rows = [];

    for (const s of schedules) {
      // Get clicks from snapshots
      const campaignType = `campaign:post-${s.id}`;
      const snapshots = await prisma.analyticsSnapshot.findMany({
        where: {
          workspaceId: req.workspaceId,
          channelType: campaignType,
        },
      });
      const clicks = snapshots.reduce((sum, snap) => sum + snap.sessions, 0);

      // Get leads from CRM
      const leads = await prisma.customer.count({
        where: {
          workspaceId: req.workspaceId,
          utmCampaign: `post-${s.id}`,
        },
      });

      // Get orders and revenue
      const orders = await prisma.order.findMany({
        where: {
          workspaceId: req.workspaceId,
          customer: {
            utmCampaign: `post-${s.id}`,
          },
        },
        select: {
          totalAmount: true,
        },
      });

      const ordersCount = orders.length;
      const revenue = orders.reduce((sum, ord) => sum + ord.totalAmount, 0);

      // Conversion rate = (leads / clicks) * 100
      const conversionRate = clicks > 0 ? parseFloat(((leads / clicks) * 100).toFixed(1)) : 0;

      rows.push({
        id: s.id,
        title: s.title,
        platforms: s.platforms,
        publishedAt: s.publishedAt || s.scheduledAt,
        clicks,
        leads,
        orders: ordersCount,
        revenue,
        conversionRate,
      });
    }



    // Sort by revenue descending, then clicks descending
    rows.sort((a, b) => b.revenue - a.revenue || b.clicks - a.clicks);

    const result = { rows };
    await cache.set(cacheKey, result, 60); // Cache for 60 seconds
    res.json(result);
  } catch (error) {
    console.error('[GET /reports/content-roi]', error);
    res.status(500).json({ error: 'Lỗi máy chủ khi tải báo cáo Content ROI' });
  }
});

export default router;
