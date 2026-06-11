import prisma from '../lib/prisma';
import { getAiConfig, fetchWithRetry, parseAiJson } from '../lib/ai';

export interface AiAnalysisResult {
  summary: string;
  highlights: string[];
  issues: string[];
  recommendations: string[];
  markdown: string;
}

export class AiReportService {
  static async generateAnalysis(workspaceId: number, days: number): Promise<AiAnalysisResult> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // 1. Fetch Traffic data
    const snapshots = await prisma.analyticsSnapshot.findMany({
      where: {
        workspaceId,
        channelType: 'all',
        date: { gte: since }
      },
      orderBy: { date: 'asc' }
    });

    const trafficStats = snapshots.reduce(
      (acc, s) => {
        acc.sessions += s.sessions;
        acc.users += s.users;
        acc.pageviews += s.pageviews;
        acc.clicks += s.clicks;
        acc.impressions += s.impressions;
        return acc;
      },
      { sessions: 0, users: 0, pageviews: 0, clicks: 0, impressions: 0 }
    );

    // 2. Fetch SEO Keywords rank
    const keywords = await prisma.seoKeyword.findMany({
      where: { workspaceId }
    });
    const totalKeywords = keywords.length;
    const positionKeywords = keywords.filter(k => k.currentPosition !== null && k.currentPosition > 0);
    const avgPosition = positionKeywords.length > 0
      ? parseFloat((positionKeywords.reduce((sum, k) => sum + (k.currentPosition || 0), 0) / positionKeywords.length).toFixed(1))
      : null;
    const top3Keywords = keywords.filter(k => k.currentPosition !== null && k.currentPosition <= 3).length;
    const top10Keywords = keywords.filter(k => k.currentPosition !== null && k.currentPosition <= 10).length;

    // 3. Fetch Email Campaigns stats
    const emailCampaigns = await prisma.emailCampaign.findMany({
      where: {
        workspaceId,
        createdAt: { gte: since }
      }
    });
    const campaignStats = emailCampaigns.reduce(
      (acc, c) => {
        acc.totalCampaigns++;
        acc.totalSent += c.sentCount;
        acc.totalOpened += c.openCount;
        acc.totalClicked += c.clickCount;
        return acc;
      },
      { totalCampaigns: 0, totalSent: 0, totalOpened: 0, totalClicked: 0 }
    );

    // 4. Fetch CRM (New Customers)
    const newCustomersCount = await prisma.customer.count({
      where: {
        workspaceId,
        createdAt: { gte: since }
      }
    });

    // 5. Fetch Orders & Revenue
    const orders = await prisma.order.findMany({
      where: {
        workspaceId,
        createdAt: { gte: since }
      }
    });
    const orderStats = orders.reduce(
      (acc, o) => {
        acc.totalOrders++;
        acc.totalRevenue += o.totalAmount;
        if (o.status === 'COMPLETED') {
          acc.completedOrders++;
          acc.completedRevenue += o.totalAmount;
        }
        return acc;
      },
      { totalOrders: 0, totalRevenue: 0, completedOrders: 0, completedRevenue: 0 }
    );

    // 6. Fetch Audit Logs (last 10 entries)
    const logs = await prisma.auditLog.findMany({
      where: {
        workspaceId,
        createdAt: { gte: since }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: { select: { name: true, email: true } }
      }
    });

    const auditSummary = logs.map(l => ({
      action: l.action,
      user: l.user.name || l.user.email,
      time: l.createdAt.toISOString().slice(0, 16).replace('T', ' ')
    }));

    // Construct Context for AI Prompt
    const systemPrompt = `Bạn là Giám đốc tiếp thị & Tăng trưởng AI (Chief Growth Officer) chuyên nghiệp, có tư duy sắc bén về dữ liệu kinh doanh và tối ưu hóa SEO/Email Marketing.
Nhiệm vụ của bạn là nhận báo cáo dữ liệu thô hoạt động của hệ thống trong vòng ${days} ngày qua, phân tích thật chi tiết và trả về phản hồi dưới dạng JSON cấu trúc chính xác.
Đừng đưa ra các nhận xét chung chung, hãy phân tích xu hướng tăng giảm cụ thể, chỉ ra nguyên nhân có thể và đưa ra hành động đề xuất thực tiễn phù hợp cho sự tăng trưởng.

Phản hồi của bạn BẮT BUỘC phải là một đối tượng JSON hợp lệ duy nhất có cấu trúc như sau:
{
  "summary": "Tóm tắt tổng quan hoạt động trong ${days} ngày qua (khoảng 3-4 câu ngắn gọn, súc tích)",
  "highlights": [
    "Điểm sáng nổi bật 1 (ví dụ: Thứ hạng từ khóa tăng, nhiều đơn hàng hoàn thành hơn...)",
    "Điểm sáng nổi bật 2",
    "..."
  ],
  "issues": [
    "Vấn đề cần lưu ý 1 (ví dụ: Tỷ lệ mở email thấp, traffic sụt giảm vào giữa tuần...)",
    "Vấn đề cần lưu ý 2",
    "..."
  ],
  "recommendations": [
    "Khuyến nghị đề xuất 1 (hành động cụ thể, có số liệu hoặc phương pháp rõ ràng)",
    "Khuyến nghị đề xuất 2",
    "..."
  ],
  "markdown": "Bản báo cáo đầy đủ, chi tiết, chuyên nghiệp định dạng markdown (Tiếng Việt). Sử dụng tiêu đề lớn, bảng so sánh và định dạng trực quan để người dùng đọc trực tiếp."
}

Hãy viết hoàn toàn bằng Tiếng Việt.`;

    const userPrompt = `Dưới đây là dữ liệu thống kê hoạt động của Workspace trong vòng ${days} ngày qua:

1. LƯỢNG TRUY CẬP (TRAFFIC):
- Tổng Sessions: ${trafficStats.sessions}
- Tổng Users (Khách truy cập): ${trafficStats.users}
- Tổng Pageviews: ${trafficStats.pageviews}
- Tổng Click từ tìm kiếm: ${trafficStats.clicks}
- Tổng Impression (Lượt hiển thị tìm kiếm): ${trafficStats.impressions}

2. THỨ HẠNG TỪ KHÓA SEO:
- Tổng số từ khóa theo dõi: ${totalKeywords}
- Vị trí trung bình: ${avgPosition !== null ? avgPosition : 'Chưa có thứ hạng'}
- Số từ khóa lọt Top 3 Google: ${top3Keywords}
- Số từ khóa lọt Top 10 Google: ${top10Keywords}

3. CHIẾN DỊCH EMAIL MARKETING:
- Số chiến dịch đã tạo/chạy: ${campaignStats.totalCampaigns}
- Tổng số email đã gửi đi: ${campaignStats.totalSent}
- Số email được mở: ${campaignStats.totalOpened} (Tỉ lệ mở: ${campaignStats.totalSent > 0 ? ((campaignStats.totalOpened / campaignStats.totalSent) * 100).toFixed(1) : 0}%)
- Số lượt click trong email: ${campaignStats.totalClicked} (Tỉ lệ click: ${campaignStats.totalSent > 0 ? ((campaignStats.totalClicked / campaignStats.totalSent) * 100).toFixed(1) : 0}%)

4. KHÁCH HÀNG MỚI (CRM):
- Số lượng khách hàng mới đăng ký/nhập: ${newCustomersCount}

5. ĐƠN HÀNG & DOANH THU (SALES):
- Tổng số đơn hàng phát sinh: ${orderStats.totalOrders}
- Tổng doanh thu (Tất cả trạng thái): ${orderStats.totalRevenue.toLocaleString()} VND
- Số đơn hàng hoàn thành (COMPLETED): ${orderStats.completedOrders}
- Doanh thu thực tế thu về (COMPLETED): ${orderStats.completedRevenue.toLocaleString()} VND

6. NHẬT KÝ HOẠT ĐỘNG HỆ THỐNG GẦN ĐÂY (AUDIT LOGS):
${auditSummary.length > 0 ? auditSummary.map(l => `- [${l.time}] ${l.user} thực hiện hành động: ${l.action}`).join('\n') : '- Không có hoạt động nổi bật nào ghi nhận.'}

Hãy phân tích toàn bộ dữ liệu trên để đưa ra báo cáo JSON chất lượng cao.`;

    const aiConfig = getAiConfig();
    if (!aiConfig.apiKey) {
      // Fallback response if AI Key is not configured
      return {
        summary: `Hệ thống chưa cấu hình AI API Key. Đây là dữ liệu báo cáo nhanh cho ${days} ngày qua: Lượt truy cập đạt ${trafficStats.sessions.toLocaleString()} lượt; có ${newCustomersCount} khách hàng mới và doanh thu thực tế thu về đạt ${orderStats.completedRevenue.toLocaleString()} VND.`,
        highlights: [
          `Lượng truy cập ghi nhận ${trafficStats.sessions.toLocaleString()} Sessions và ${trafficStats.pageviews.toLocaleString()} Pageviews.`,
          `Thêm mới thành công ${newCustomersCount} khách hàng vào danh sách CRM.`,
          `Ghi nhận ${orderStats.completedOrders} đơn hàng hoàn thành, thu về ${orderStats.completedRevenue.toLocaleString()} VND.`
        ],
        issues: [
          aiConfig.model ? `Chưa thiết lập khóa API để chạy phân tích chuyên sâu.` : `Mô hình AI chưa được bật.`
        ],
        recommendations: [
          `Vui lòng truy cập Cài đặt để bổ sung OPENAI_API_KEY để AI tự động đánh giá chuyên sâu và đề xuất các hành động tăng trưởng.`,
          `Tập trung đẩy mạnh SEO các từ khóa đang lọt Top 10 để nhanh chóng cải thiện lượng truy cập tự nhiên.`
        ],
        markdown: `### Báo cáo Nhanh Tiếp thị & Kinh doanh (${days} ngày qua)
*Chú ý: Đây là báo cáo sơ bộ tự động do chưa có khóa API AI.*

#### 📈 Tóm tắt hiệu suất:
- **Lượng truy cập**: Đạt **${trafficStats.sessions.toLocaleString()}** Sessions và **${trafficStats.users.toLocaleString()}** người dùng thật.
- **Doanh thu**: Thu về **${orderStats.completedRevenue.toLocaleString()} VND** từ **${orderStats.completedOrders}** đơn hàng thành công.
- **CRM**: Thu hút thêm **${newCustomersCount}** khách hàng tiềm năng mới.

#### 💡 Khuyến nghị ngắn hạn:
1. Thiết lập API Key trong phần cấu hình biến môi trường để kích hoạt tính năng **Marketing Chief AI** phân tích sâu.
2. Kiểm tra lại hiệu suất các từ khóa SEO để cải thiện vị trí trung bình hiện tại (${avgPosition !== null ? avgPosition : 'chưa có'}).`
      };
    }

    try {
      const response = await fetchWithRetry(aiConfig.url, {
        method: 'POST',
        headers: aiConfig.headers,
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2
        })
      });

      if (!response.ok) {
        throw new Error(`AI API responded with status ${response.status}`);
      }

      const resJson = await response.json();
      const content = resJson.choices?.[0]?.message?.content || '';
      
      const parsed = parseAiJson<AiAnalysisResult>(content);
      
      return {
        summary: parsed.summary || 'Không có tóm tắt.',
        highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        markdown: parsed.markdown || 'Không có nội dung báo cáo chi tiết.'
      };
    } catch (error) {
      console.error('[AiReportService.generateAnalysis] error:', error);
      // Fallback in case of parse/network error
      return {
        summary: `Lỗi kết nối hoặc phân tích AI cho báo cáo ${days} ngày qua. Tuy nhiên, hệ thống vẫn ghi nhận các số liệu cơ bản về lượt truy cập và đơn hàng.`,
        highlights: [
          `Sessions: ${trafficStats.sessions.toLocaleString()} | Users: ${trafficStats.users.toLocaleString()}`,
          `Doanh thu thực nhận: ${orderStats.completedRevenue.toLocaleString()} VND`
        ],
        issues: [
          `Tiến trình AI phân tích gặp lỗi: ${(error as Error).message}`
        ],
        recommendations: [
          `Thử bấm phân tích lại sau vài giây để chạy lại tiến trình.`,
          `Kiểm tra lại khóa API và hạn mức sử dụng (quota) tài khoản OpenAI/Gemini/DeepSeek.`
        ],
        markdown: `### Phân tích Báo cáo Tiếp thị (Lỗi AI Fallback)
Không thể hoàn thành phân tích AI chuyên sâu do lỗi kết nối dịch vụ hoặc phản hồi từ LLM không đúng định dạng.

#### 📊 Số liệu cơ bản đã thu thập:
- **Sessions**: ${trafficStats.sessions.toLocaleString()}
- **Pageviews**: ${trafficStats.pageviews.toLocaleString()}
- **Khách hàng mới**: ${newCustomersCount}
- **Doanh thu thực tế**: ${orderStats.completedRevenue.toLocaleString()} VND`
      };
    }
  }
}
