"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRecommendations = buildRecommendations;
exports.enhanceWithOpenAi = enhanceWithOpenAi;
exports.generateCmoReport = generateCmoReport;
const prisma_1 = __importDefault(require("../lib/prisma"));
const ai_1 = require("../lib/ai");
async function buildRecommendations(workspaceId) {
    const items = [];
    let id = 0;
    const add = (r) => {
        items.push({ ...r, id: `r-${++id}` });
    };
    const integration = await prisma_1.default.googleIntegration.findFirst({ where: { workspaceId } });
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
    const snapshots = await prisma_1.default.analyticsSnapshot.findMany({
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
    const keywordsNoRank = await prisma_1.default.seoKeyword.count({
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
    const failedSchedules = await prisma_1.default.contentSchedule.count({ where: { status: 'FAILED', workspaceId } });
    if (failedSchedules > 0) {
        add({
            category: 'automation',
            priority: 'high',
            title: `${failedSchedules} lịch hẹn giờ đang lỗi`,
            description: 'Kiểm tra kết nối Facebook/Zalo/SMTP và gửi lại.',
            actionPath: '/dashboard/schedule',
        });
    }
    const runningBots = await prisma_1.default.automationTask.count({ where: { status: 'RUNNING', workspaceId } });
    const templateCount = await prisma_1.default.postTemplate.count({ where: { isActive: true, workspaceId } });
    if (runningBots > 0 && templateCount === 0) {
        add({
            category: 'automation',
            priority: 'high',
            title: 'Bot đang chạy nhưng chưa có mẫu nội dung',
            description: 'Tạo template trong Content Editor để Bot có thể đăng bài.',
            actionPath: '/dashboard/content',
        });
    }
    const draftCampaigns = await prisma_1.default.emailCampaign.count({ where: { status: 'DRAFT', workspaceId } });
    if (draftCampaigns > 3) {
        add({
            category: 'email',
            priority: 'low',
            title: `${draftCampaigns} email campaign ở trạng thái nháp`,
            description: 'Lên lịch hoặc gửi các chiến dịch email để tăng KPI open rate.',
            actionPath: '/dashboard/email',
        });
    }
    const backlinks = await prisma_1.default.backlink.count({ where: { workspaceId } });
    if (backlinks < 5) {
        add({
            category: 'seo',
            priority: 'low',
            title: 'Mở rộng hồ sơ backlink',
            description: 'SRS mục tiêu ~20 domain/tháng — dùng quét tự động từ bài guest post.',
            actionPath: '/dashboard/backlinks',
        });
    }
    const openRate = await prisma_1.default.emailCampaign.aggregate({ where: { workspaceId }, _sum: { sentCount: true, openCount: true } });
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
    const runningAb = await prisma_1.default.abTest.count({ where: { status: 'RUNNING', workspaceId } });
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
async function enhanceWithOpenAi(items) {
    const ai = (0, ai_1.getAiConfig)('/chat/completions', 'content_generation');
    if (!ai.apiKey) {
        return {
            summary: 'Bật OPENAI_API_KEY trong backend .env để nhận tóm tắt AI chi tiết hơn.',
            items,
        };
    }
    try {
        const prompt = `Bạn là chuyên gia marketing. Tóm tắt ngắn (3 câu, tiếng Việt) và 1 gợi ý ưu tiên nhất từ danh sách:\n${JSON.stringify(items.slice(0, 8))}`;
        const res = await (0, ai_1.fetchWithRetry)(ai.url, {
            method: 'POST',
            headers: ai.headers,
            body: JSON.stringify({
                model: ai.model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 300,
            }),
            signal: AbortSignal.timeout(20000),
        });
        const data = (await res.json());
        const summary = data.choices?.[0]?.message?.content?.trim() || '';
        return { summary, items };
    }
    catch {
        return { summary: '', items };
    }
}
async function generateCmoReport(workspaceId) {
    const since7 = new Date();
    since7.setDate(since7.getDate() - 7);
    // 1. Traffic Snapshots
    const snapshots = await prisma_1.default.analyticsSnapshot.findMany({
        where: { date: { gte: since7 }, workspaceId },
    });
    const totalTraffic = snapshots.reduce((s, r) => s + r.sessions, 0);
    const totalBounce = snapshots.reduce((s, r) => s + (r.bounceRate || 0), 0);
    const avgBounceRate = snapshots.length > 0 ? totalBounce / snapshots.length : 0;
    // 2. CRM Leads
    const totalLeads = await prisma_1.default.customer.count({ where: { workspaceId } });
    const newLeads7Days = await prisma_1.default.customer.count({ where: { workspaceId, createdAt: { gte: since7 } } });
    const leadMagnetLeads = await prisma_1.default.customer.count({ where: { workspaceId, trafficSource: 'LEAD_MAGNET' } });
    // 3. Social Listening
    const listeningLogsScanned = await prisma_1.default.socialListeningLog.count({
        where: { campaign: { workspaceId }, createdAt: { gte: since7 } }
    });
    const listeningLogsHot = await prisma_1.default.socialListeningLog.count({
        where: { campaign: { workspaceId }, aiDecision: 'HOT', createdAt: { gte: since7 } }
    });
    // 4. Email Campaign Statistics
    const emailCampaignStats = await prisma_1.default.emailCampaign.aggregate({
        where: { workspaceId },
        _sum: { sentCount: true, openCount: true }
    });
    const emailsSent = emailCampaignStats._sum.sentCount || 0;
    const emailsOpened = emailCampaignStats._sum.openCount || 0;
    // 5. SEO Keywords
    const seoKeywordsCount = await prisma_1.default.seoKeyword.count({ where: { workspaceId } });
    // 6. Orders & Revenue
    const totalOrders = await prisma_1.default.order.count({ where: { workspaceId, status: 'PAID' } });
    const revenueObj = await prisma_1.default.order.aggregate({
        where: { workspaceId, status: 'PAID' },
        _sum: { totalAmount: true }
    });
    const totalRevenue = revenueObj._sum.totalAmount || 0;
    const stats = {
        totalTraffic,
        avgBounceRate,
        totalLeads,
        newLeads7Days,
        leadMagnetLeads,
        listeningLogsScanned,
        listeningLogsHot,
        emailsSent,
        emailsOpened,
        seoKeywordsCount,
        totalOrders,
        totalRevenue
    };
    // 7. Get AI recommendation summary using DeepSeek/OpenAI config
    const ai = (0, ai_1.getAiConfig)('/chat/completions', 'chatbot');
    if (!ai.apiKey) {
        return {
            performanceReview: "Hãy thiết lập mã API Key ở file .env của backend để AI CMO phân tích chi tiết dữ liệu tiếp thị thực tế.",
            growthOpportunities: "Các kênh Social Listening và Phễu Lead Magnet tự động là cơ hội tăng trưởng lớn.",
            recommendedTasks: [
                {
                    task: "Kết nối tài khoản Google Analytics để đồng bộ dữ liệu traffic thực tế.",
                    reason: "Hiện tại hệ thống chưa nhận được dữ liệu GA4.",
                    priority: "high",
                    actionPath: "/dashboard/settings",
                    actionLabel: "Kết nối ngay"
                }
            ],
            stats
        };
    }
    const prompt = `Bạn là Giám đốc Marketing AI (AI CMO) chuyên nghiệp.
Dưới đây là báo cáo các chỉ số tiếp thị và kinh doanh thực tế trong 7 ngày qua của doanh nghiệp:
- Tổng lưu lượng truy cập (sessions): ${totalTraffic}
- Tỷ lệ thoát trung bình (bounce rate): ${avgBounceRate.toFixed(1)}%
- Tổng số khách hàng trong CRM: ${totalLeads}
- Khách hàng mới trong 7 ngày qua: ${newLeads7Days}
- Khách hàng đăng ký nhận PDF Lead Magnet: ${leadMagnetLeads}
- Tin đăng social quét từ Social Listening: ${listeningLogsScanned}
- Khách hàng HOT tiềm năng phát hiện từ Social Listening: ${listeningLogsHot}
- Số lượng Email tiếp thị đã gửi: ${emailsSent}
- Số lượng Email tiếp thị đã mở: ${emailsOpened}
- Số từ khóa SEO đang theo dõi: ${seoKeywordsCount}
- Số đơn hàng đã thanh toán thành công: ${totalOrders}
- Tổng doanh thu (VNĐ): ${totalRevenue.toLocaleString('vi-VN')} VNĐ

Nhiệm vụ của bạn: Hãy phân tích các chỉ số trên và đưa ra báo cáo định hướng chiến lược.
Báo cáo phải trả về dưới dạng JSON thô, không chứa markdown block (không viết \`\`\`json), khớp chính xác cấu trúc sau:
{
  "performanceReview": "Tóm tắt đánh giá ngắn gọn khoảng 3-4 câu về sức khỏe và hiệu suất marketing tuần qua của doanh nghiệp.",
  "growthOpportunities": "Phân tích 2-3 dòng chỉ ra cơ hội tăng trưởng tiềm năng (ví dụ tối ưu tỷ lệ chuyển độ, tập trung email drip campaign, khai thác social listening logs).",
  "recommendedTasks": [
    {
      "task": "Nhiệm vụ cụ thể cần làm (Ví dụ: Thiết lập chiến dịch email tự động follow-up khách hàng từ Lead Magnet)",
      "reason": "Lý do ưu tiên nhiệm vụ này dựa trên dữ liệu",
      "priority": "high",
      "actionPath": "/dashboard/email",
      "actionLabel": "Thiết lập Email"
    }
  ]
}`;
    try {
        const res = await (0, ai_1.fetchWithRetry)(ai.url, {
            method: 'POST',
            headers: ai.headers,
            body: JSON.stringify({
                model: ai.model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.5,
                max_tokens: 1200,
            }),
            signal: AbortSignal.timeout(25000)
        }, 2, 1200, workspaceId, 'lead_qualifier');
        if (res.ok) {
            const data = await res.json();
            const rawText = data.choices?.[0]?.message?.content?.trim() || '';
            // Basic JSON parser
            const cleanJsonText = rawText.replace(/^```json|```$/g, '').trim();
            const parsed = JSON.parse(cleanJsonText);
            return {
                performanceReview: parsed.performanceReview || '',
                growthOpportunities: parsed.growthOpportunities || '',
                recommendedTasks: parsed.recommendedTasks || [],
                stats
            };
        }
    }
    catch (err) {
        console.error('[AI CMO Report] Failed to fetch AI CMO analysis, falling back:', err.message);
    }
    // Fallback
    return {
        performanceReview: "Hệ thống ghi nhận hoạt động tiếp thị ổn định. Tổng lượng khách hàng mới đạt mức trung bình tốt.",
        growthOpportunities: "Cần tăng cường khai thác dữ liệu từ các bài đăng Social Listening phát hiện được để tiếp cận chủ động.",
        recommendedTasks: [
            {
                task: "Xem lại danh sách tin đăng từ Social Listening",
                reason: "Hệ thống đang quét được tin bài nhưng chưa phản hồi hết.",
                priority: "medium",
                actionPath: "/dashboard/listening",
                actionLabel: "Social Listening"
            }
        ],
        stats
    };
}
