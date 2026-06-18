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

// ==================== HỘP THƯ THÔNG BÁO (NOTIFICATION CENTER) ====================

router.get('/notifications', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      res.status(400).json({ error: 'Không xác định được Workspace' });
      return;
    }

    // 1. Fetch Alert Logs (cảnh báo hệ thống)
    const alertLogs = await prisma.alertLog.findMany({
      where: {
        rule: {
          workspaceId,
        },
      },
      include: {
        rule: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    // 2. Fetch Chat Sessions (live chat từ khách hàng)
    const chatSessions = await prisma.chatSession.findMany({
      where: {
        workspaceId,
      },
      include: {
        customer: true,
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 10,
    });

    // 3. Fetch Form Submissions (leads đăng ký mới)
    const submissions = await prisma.formSubmission.findMany({
      where: {
        workspaceId,
      },
      include: {
        form: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    const notifications = [];

    // Map Alert Logs
    for (const log of alertLogs) {
      notifications.push({
        id: `alert-${log.id}`,
        type: 'alert',
        title: `Cảnh báo: ${log.rule.name}`,
        message: log.message,
        createdAt: log.createdAt,
        severity: log.severity,
        link: '/dashboard/alerts',
      });
    }

    // Map Chat Sessions
    for (const session of chatSessions) {
      const lastMessage = session.messages[0];
      if (!lastMessage) continue;

      const senderName = session.customer?.name || session.customer?.email || session.ipAddress || 'Khách truy cập';
      notifications.push({
        id: `chat-${session.id}`,
        type: 'chat',
        title: `Hội thoại mới`,
        message: `${senderName}: "${lastMessage.content.slice(0, 80)}${lastMessage.content.length > 80 ? '...' : ''}"`,
        createdAt: lastMessage.createdAt,
        link: '/dashboard/cskh/settings',
      });
    }

    // Map Form Submissions
    for (const sub of submissions) {
      let emailOrName = 'Khách truy cập';
      try {
        const parsed = JSON.parse(sub.dataJson);
        emailOrName = parsed.email || parsed.name || emailOrName;
      } catch {
        // ignore
      }
      notifications.push({
        id: `submission-${sub.id}`,
        type: 'submission',
        title: `Phản hồi Form: ${sub.form.name}`,
        message: `Khách hàng ${emailOrName} vừa gửi thông tin liên hệ`,
        createdAt: sub.createdAt,
        link: '/dashboard/customers',
      });
    }

    // Sắp xếp giảm dần theo thời gian tạo
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(notifications.slice(0, 15));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy danh sách thông báo' });
  }
});

// ==================== BÁO CÁO SỬ DỤNG MODEL AI (AI MODELS USAGE REPORT) ====================

function calculateEstimatedCost(model: string, promptTokens: number, completionTokens: number): number {
  const m = model.toLowerCase();
  
  // Mức giá mặc định (DeepSeek Flash)
  let promptRate = 0.14; 
  let completionRate = 0.28;

  if (m.includes('gemini-2.5-flash')) {
    promptRate = 0.075;
    completionRate = 0.30;
  } else if (m.includes('gemini-embedding') || m.includes('embedding')) {
    promptRate = 0.02; // Chỉ tính đầu vào cho embedding
    completionRate = 0.00;
  } else if (m.includes('deepseek-v4') || m.includes('deepseek-chat')) {
    promptRate = 0.14;
    completionRate = 0.28;
  } else if (m.includes('deepseek-reasoner')) {
    promptRate = 0.55;
    completionRate = 2.19;
  }

  const cost = (promptTokens * promptRate + completionTokens * completionRate) / 1000000;
  return cost;
}

router.get('/ai-usage', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      res.status(400).json({ error: 'Không xác định được Workspace' });
      return;
    }

    // Lấy dữ liệu sử dụng trong 30 ngày gần nhất
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 30);

    const usages = await prisma.aiUsage.findMany({
      where: {
        workspaceId,
        createdAt: { gte: dateLimit }
      },
      orderBy: { createdAt: 'asc' }
    });

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    let totalCalls = usages.length;
    let totalCostUsd = 0;

    const modelBreakdown: Record<string, { model: string; promptTokens: number; completionTokens: number; totalTokens: number; calls: number; costUsd: number }> = {};
    const featureBreakdown: Record<string, { feature: string; promptTokens: number; completionTokens: number; totalTokens: number; calls: number; costUsd: number }> = {};
    const dailyUsage: Record<string, { date: string; promptTokens: number; completionTokens: number; totalTokens: number; calls: number; costUsd: number }> = {};

    // Khởi tạo trước 30 ngày gần nhất để biểu đồ không bị khuyết dữ liệu
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyUsage[dateStr] = {
        date: dateStr,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        calls: 0,
        costUsd: 0,
      };
    }

    for (const u of usages) {
      const cost = calculateEstimatedCost(u.model, u.promptTokens, u.completionTokens);

      totalPromptTokens += u.promptTokens;
      totalCompletionTokens += u.completionTokens;
      totalTokens += u.totalTokens;
      totalCostUsd += cost;

      // Phân tách theo Model
      if (!modelBreakdown[u.model]) {
        modelBreakdown[u.model] = { model: u.model, promptTokens: 0, completionTokens: 0, totalTokens: 0, calls: 0, costUsd: 0 };
      }
      modelBreakdown[u.model].promptTokens += u.promptTokens;
      modelBreakdown[u.model].completionTokens += u.completionTokens;
      modelBreakdown[u.model].totalTokens += u.totalTokens;
      modelBreakdown[u.model].calls += 1;
      modelBreakdown[u.model].costUsd += cost;

      // Phân tách theo Tính năng
      const feat = u.feature || 'unknown';
      if (!featureBreakdown[feat]) {
        featureBreakdown[feat] = { feature: feat, promptTokens: 0, completionTokens: 0, totalTokens: 0, calls: 0, costUsd: 0 };
      }
      featureBreakdown[feat].promptTokens += u.promptTokens;
      featureBreakdown[feat].completionTokens += u.completionTokens;
      featureBreakdown[feat].totalTokens += u.totalTokens;
      featureBreakdown[feat].calls += 1;
      featureBreakdown[feat].costUsd += cost;

      // Phân tách theo ngày
      const dateStr = u.createdAt.toISOString().split('T')[0];
      if (dailyUsage[dateStr]) {
        dailyUsage[dateStr].promptTokens += u.promptTokens;
        dailyUsage[dateStr].completionTokens += u.completionTokens;
        dailyUsage[dateStr].totalTokens += u.totalTokens;
        dailyUsage[dateStr].calls += 1;
        dailyUsage[dateStr].costUsd += cost;
      }
    }

    const resData = {
      stats: {
        totalPromptTokens,
        totalCompletionTokens,
        totalTokens,
        totalCalls,
        totalCostUsd: Number(totalCostUsd.toFixed(6)),
        totalCostVnd: Math.round(totalCostUsd * 25000),
      },
      modelBreakdown: Object.values(modelBreakdown).map(x => ({
        ...x,
        costUsd: Number(x.costUsd.toFixed(6)),
        costVnd: Math.round(x.costUsd * 25000),
      })),
      featureBreakdown: Object.values(featureBreakdown).map(x => ({
        ...x,
        costUsd: Number(x.costUsd.toFixed(6)),
        costVnd: Math.round(x.costUsd * 25000),
      })),
      dailyUsage: Object.values(dailyUsage),
    };

    res.json(resData);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy báo cáo sử dụng Model AI' });
  }
});

export default router;
