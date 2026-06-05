import prisma from '../lib/prisma';
import { getAiConfig } from '../lib/ai';


export type Recommendation = {
  id: string;
  category: 'traffic' | 'seo' | 'automation' | 'email' | 'kpi';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionPath?: string;
};

export async function buildRecommendations(workspaceId?: number): Promise<Recommendation[]> {
  const items: Recommendation[] = [];
  let id = 0;
  const add = (r: Omit<Recommendation, 'id'>) => {
    items.push({ ...r, id: `r-${++id}` });
  };

  const integration = await prisma.googleIntegration.findFirst({ where: { workspaceId } });
  if (!integration?.accessToken) {
    add({
      category: 'traffic',
      priority: 'high',
      title: 'Kết nối Google Analytics & Search Console',
      description: 'Chưa có OAuth Google — dashboard và báo cáo sẽ thiếu dữ liệu thật.',
      actionPath: '/dashboard/settings',
    });
  }

  const since7 = new Date();
  since7.setDate(since7.getDate() - 7);
  const snapshots = await prisma.analyticsSnapshot.findMany({
    where: { date: { gte: since7 }, channelType: 'all', workspaceId },
  });
  const sessions7 = snapshots.reduce((s, r) => s + r.sessions, 0);
  if (sessions7 === 0 && integration?.accessToken) {
    add({
      category: 'traffic',
      priority: 'medium',
      title: 'Đồng bộ lại dữ liệu GA4/GSC',
      description: '7 ngày qua chưa có snapshot — bấm Sync trong Cài đặt hoặc đợi worker 6 giờ.',
      actionPath: '/dashboard/settings',
    });
  }

  const keywordsNoRank = await prisma.seoKeyword.count({
    where: { OR: [{ currentPosition: null }, { currentPosition: { gt: 20 } }], workspaceId },
  });
  if (keywordsNoRank > 0) {
    add({
      category: 'seo',
      priority: 'medium',
      title: `${keywordsNoRank} từ khóa cần tối ưu`,
      description: 'Từ khóa chưa top 20 — chạy SEO Audit URL landing và cập nhật nội dung.',
      actionPath: '/dashboard/seo',
    });
  }

  const failedSchedules = await prisma.contentSchedule.count({ where: { status: 'FAILED', workspaceId } });
  if (failedSchedules > 0) {
    add({
      category: 'automation',
      priority: 'high',
      title: `${failedSchedules} lịch hẹn giờ đang lỗi`,
      description: 'Kiểm tra kết nối Facebook/Zalo/SMTP và gửi lại.',
      actionPath: '/dashboard/schedule',
    });
  }

  const runningBots = await prisma.automationTask.count({ where: { status: 'RUNNING', workspaceId } });
  const templateCount = await prisma.postTemplate.count({ where: { isActive: true, workspaceId } });
  if (runningBots > 0 && templateCount === 0) {
    add({
      category: 'automation',
      priority: 'high',
      title: 'Bot đang chạy nhưng chưa có mẫu nội dung',
      description: 'Tạo template trong Content Editor để Bot có thể đăng bài.',
      actionPath: '/dashboard/content',
    });
  }

  const draftCampaigns = await prisma.emailCampaign.count({ where: { status: 'DRAFT', workspaceId } });
  if (draftCampaigns > 3) {
    add({
      category: 'email',
      priority: 'low',
      title: `${draftCampaigns} email campaign ở trạng thái nháp`,
      description: 'Lên lịch hoặc gửi các chiến dịch email để tăng KPI open rate.',
      actionPath: '/dashboard/email',
    });
  }

  const backlinks = await prisma.backlink.count({ where: { workspaceId } });
  if (backlinks < 5) {
    add({
      category: 'seo',
      priority: 'low',
      title: 'Mở rộng hồ sơ backlink',
      description: 'SRS mục tiêu ~20 domain/tháng — dùng quét tự động từ bài guest post.',
      actionPath: '/dashboard/backlinks',
    });
  }

  const openRate =
    await prisma.emailCampaign.aggregate({ where: { workspaceId }, _sum: { sentCount: true, openCount: true } });
  const sent = openRate._sum.sentCount || 0;
  const opens = openRate._sum.openCount || 0;
  if (sent > 10) {
    const rate = (opens / sent) * 100;
    if (rate < 25) {
      add({
        category: 'kpi',
        priority: 'medium',
        title: `Open rate ${rate.toFixed(1)}% — dưới KPI 25%`,
        description: 'Thử A/B subject line hoặc rút gọn nội dung email.',
        actionPath: '/dashboard/abtests',
      });
    }
  }

  const runningAb = await prisma.abTest.count({ where: { status: 'RUNNING', workspaceId } });
  if (runningAb === 0) {
    add({
      category: 'kpi',
      priority: 'low',
      title: 'Chưa có A/B test đang chạy',
      description: 'Tạo test 2 biến thể để tối ưu CTR nội dung social/email.',
      actionPath: '/dashboard/abtests',
    });
  }

  return items.sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    return p[a.priority] - p[b.priority];
  });
}

export async function enhanceWithOpenAi(
  items: Recommendation[]
): Promise<{ summary: string; items: Recommendation[] }> {
  const ai = getAiConfig('/chat/completions');
  if (!ai.apiKey) {
    return {
      summary: 'Bật OPENAI_API_KEY trong backend .env để nhận tóm tắt AI chi tiết hơn.',
      items,
    };
  }

  try {
    const prompt = `Bạn là chuyên gia marketing. Tóm tắt ngắn (3 câu, tiếng Việt) và 1 gợi ý ưu tiên nhất từ danh sách:\n${JSON.stringify(items.slice(0, 8))}`;
    const res = await fetch(ai.url, {
      method: 'POST',
      headers: ai.headers,
      body: JSON.stringify({
        model: ai.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const summary = data.choices?.[0]?.message?.content?.trim() || '';
    return { summary, items };
  } catch {
    return { summary: '', items };
  }
}
