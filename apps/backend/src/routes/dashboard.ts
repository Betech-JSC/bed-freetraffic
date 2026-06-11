import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import {
  fetchGscSummary,
  formatChartDay,
  getGa4Client,
  getGa4PropertyId,
  getGscSiteUrl,
} from '../lib/google';
import { getDashboardFromSnapshots } from '../services/analyticsSync';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cache } from '../lib/cache';

const router = Router();
router.use(authenticate);

async function getLiveDashboard(days: number, workspaceId?: number) {
  const totalKeywords = await prisma.seoKeyword.count({ where: { workspaceId } });
  const activeChannels = await prisma.channel.count({ where: { status: 'ACTIVE', workspaceId } });
  const facebookConnected = !!(await prisma.socialConnection.findFirst({
    where: { platform: 'facebook', status: 'CONNECTED', workspaceId },
  }));

  let totalTraffic = 0;
  let organicSearch = 0;
  let ga4Connected = false;
  let gscConnected = false;
  let gscImpressions = 0;

  let chartData: { name: string; traffic: number; keywords: number; pageviews?: number }[] = [];

  const gscByDate = new Map<string, number>();
  const gsc = await fetchGscSummary(days, workspaceId);
  if (gsc.connected) {
    gscConnected = true;
    organicSearch = gsc.clicks;
    gscImpressions = gsc.impressions;
    for (const row of gsc.daily) gscByDate.set(row.date, row.clicks);
  }

  const integration = await prisma.googleIntegration.findFirst({ where: { workspaceId } });
  const ga4PropertyId = integration?.ga4PropertyId || getGa4PropertyId();
  const analyticsDataClient = await getGa4Client(workspaceId);

  ga4Connected = integration?.syncStatus === 'CONNECTED';
  gscConnected = gscConnected || !!integration?.gscSiteUrl || !!getGscSiteUrl();

  if (analyticsDataClient) {
    try {
      const [response] = await analyticsDataClient.runReport({
        property: `properties/${ga4PropertyId}`,
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
        metrics: [{ name: 'activeUsers' }],
      });
      if (response?.rows?.length) {
        totalTraffic = parseInt(response.rows[0].metricValues![0].value!) || 0;
      }

      const chartDays = Math.min(days, 30);
      const [chartRes] = await analyticsDataClient.runReport({
        property: `properties/${ga4PropertyId}`,
        dateRanges: [{ startDate: `${chartDays}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
      });

      if (chartRes?.rows?.length) {
        chartData = chartRes.rows
          .sort((a, b) => a.dimensionValues![0].value!.localeCompare(b.dimensionValues![0].value!))
          .map((row) => {
            const dateStr = row.dimensionValues![0].value!;
            const iso =
              dateStr.length === 8
                ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
                : dateStr;
            return {
              name: formatChartDay(iso),
              traffic: parseInt(row.metricValues![0].value!) || 0,
              keywords: gscByDate.get(iso) ?? 0,
              pageviews: parseInt(row.metricValues![1]?.value || '0') || 0,
            };
          });
      }
    } catch (err: unknown) {
      console.error('GA4:', err instanceof Error ? err.message : err);
    }
  }

  if (chartData.length === 0 && gsc.daily.length > 0) {
    chartData = gsc.daily.map((row) => ({
      name: formatChartDay(row.date),
      traffic: 0,
      keywords: row.clicks,
      pageviews: 0,
    }));
  }

  return {
    stats: {
      totalTraffic,
      organicSearch,
      referral: gscConnected ? Math.max(0, gscImpressions - organicSearch) : 0,
      activeChannels,
      totalKeywords,
      growth: ga4Connected || gscConnected ? '+5.4%' : '+0%',
      ga4Connected,
      gscConnected,
      facebookConnected,
      gscImpressions,
    },
    chartData:
      chartData.length > 0
        ? chartData
        : [{ name: '—', traffic: 0, keywords: 0, pageviews: 0 }],
    channelBreakdown: [],
  };
}

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const days = parseInt((req.query.days as string) || '7');
    const channelType = (req.query.channel as string) || undefined;
    const cacheKey = `ws:${req.workspaceId}:dashboard:days:${days}:channel:${channelType || 'all'}`;

    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const snapshotCount = await prisma.analyticsSnapshot.count({
      where: { channelType: channelType || 'all', workspaceId: req.workspaceId },
    });

    let data;
    if (snapshotCount > 0) {
      data = await getDashboardFromSnapshots(days, channelType, req.workspaceId);
    } else {
      data = await getLiveDashboard(days, req.workspaceId);
    }

    await cache.set(cacheKey, data, 60); // Cache for 60 seconds
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
  }
});

export default router;
