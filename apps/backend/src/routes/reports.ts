import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { buildKeywordsPdf, buildTrafficPdf } from '../services/reportPdf';
import { buildSpreadsheetXml } from '../services/reportExcel';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/traffic', async (req: AuthRequest, res: Response): Promise<void> => {
  const days = parseInt((req.query.days as string) || '30');
  const since = new Date();
  since.setDate(since.getDate() - days);

  const snapshots = await prisma.analyticsSnapshot.findMany({
    where: { date: { gte: since }, channelType: 'all' },
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

  res.json({ rows, total: rows.length });
});

router.get('/keywords', async (_req: AuthRequest, res: Response): Promise<void> => {
  const keywords = await prisma.seoKeyword.findMany({
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

  res.json({ rows });
});

router.get('/export/csv', async (req: AuthRequest, res: Response): Promise<void> => {
  const type = (req.query.type as string) || 'traffic';
  const days = parseInt((req.query.days as string) || '30');
  const since = new Date();
  since.setDate(since.getDate() - days);

  let csv = '';
  let filename = 'report.csv';

  if (type === 'keywords') {
    const keywords = await prisma.seoKeyword.findMany({ include: { channel: true } });
    csv = 'keyword,url,position,searchVolume,channel\n';
    for (const k of keywords) {
      csv += `"${k.keyword}","${k.url || ''}",${k.currentPosition ?? ''},${k.searchVolume ?? ''},"${k.channel?.name || ''}"\n`;
    }
    filename = 'keywords-report.csv';
  } else {
    const snapshots = await prisma.analyticsSnapshot.findMany({
      where: { date: { gte: since }, channelType: 'all' },
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
});

router.get('/export/xlsx', async (req: AuthRequest, res: Response): Promise<void> => {
  const type = (req.query.type as string) || 'traffic';
  const days = parseInt((req.query.days as string) || '30');
  const since = new Date();
  since.setDate(since.getDate() - days);

  let xml = '';
  let filename = 'report.xls';

  if (type === 'keywords') {
    const keywords = await prisma.seoKeyword.findMany({
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
      where: { date: { gte: since }, channelType: 'all' },
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
});

router.get('/export/pdf', async (req: AuthRequest, res: Response): Promise<void> => {
  const type = (req.query.type as string) || 'traffic';
  const days = parseInt((req.query.days as string) || '30');
  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    if (type === 'keywords') {
      const keywords = await prisma.seoKeyword.findMany({
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
      where: { date: { gte: since }, channelType: 'all' },
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

export default router;
