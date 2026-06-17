import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { workspaceMiddleware, WorkspaceRequest } from '../middleware/workspace';
import { getAiConfig, fetchWithRetry } from '../lib/ai';
import { runSeoAudit } from '../services/seoAuditService';

const router = Router();

// Endpoint lấy trạng thái onboarding của Workspace hiện tại
router.get('/onboard-status', authenticate, workspaceMiddleware as any, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const ws = await prisma.workspace.findUnique({
      where: { id: req.workspaceId },
      select: {
        id: true,
        name: true,
        companyName: true,
        websiteUrl: true,
        onboardingGoal: true,
        onboardingCompleted: true,
        aiAuditReport: true,
      }
    });

    if (!ws) {
      res.status(404).json({ error: 'Không tìm thấy Workspace' });
      return;
    }

    res.json(ws);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Lỗi lấy thông tin onboarding' });
  }
});

// Endpoint thiết lập hồ sơ onboarding và sinh chiến lược tăng trưởng tự động bằng AI
router.post('/onboard', authenticate, workspaceMiddleware as any, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const { companyName, websiteUrl, onboardingGoal } = req.body;

    if (!companyName || !onboardingGoal) {
      res.status(400).json({ error: 'Tên công ty/doanh nghiệp và Mục tiêu là bắt buộc.' });
      return;
    }

    let auditScore = null;
    let seoReportDetails = 'Không thực hiện phân tích SEO do người dùng bỏ qua hoặc chưa có website.';
    let auditLogs = '';

    // 1. Chạy SEO Audit nếu người dùng cung cấp link website
    if (websiteUrl && websiteUrl.trim().startsWith('http')) {
      try {
        console.log(`[Onboarding Audit] Đang chạy phân tích nhanh cho website: ${websiteUrl}`);
        const audit = await runSeoAudit(websiteUrl);
        auditScore = audit.score;

        const issuesList = audit.issues
          .map(issue => `- [${issue.severity}] ${issue.message}: ${issue.suggestion || ''}`)
          .join('\n');

        seoReportDetails = `
- **Điểm SEO Tổng quan**: ${audit.score}/100
- **Điểm kỹ thuật (Technical)**: ${audit.technicalScore}/100
- **Điểm nội dung (Content)**: ${audit.contentScore}/100
- **Điểm Trải nghiệm người dùng (UX)**: ${audit.uxScore}/100

**Các vấn đề/lỗi SEO chính phát hiện được:**
${issuesList || 'Không phát hiện lỗi nghiêm trọng.'}
        `;

        // Lưu kết quả audit trực tiếp vào bảng SeoAudit trong DB để hiển thị ở trang SEO sau này
        await prisma.seoAudit.create({
          data: {
            url: websiteUrl,
            score: audit.score,
            technicalScore: audit.technicalScore,
            contentScore: audit.contentScore,
            uxScore: audit.uxScore,
            workspaceId: req.workspaceId!,
            issues: {
              create: audit.issues.map(issue => ({
                category: issue.category,
                severity: issue.severity,
                message: issue.message,
                suggestion: issue.suggestion || null
              }))
            }
          }
        });
      } catch (auditErr: any) {
        console.error('[Onboarding Audit Error] Lỗi chạy SEO audit:', auditErr.message);
        seoReportDetails = `Không thể truy cập hoặc phân tích SEO website do lỗi kết nối: ${auditErr.message}`;
      }
    }

    // 2. Chuyển ngữ cảnh sang Tiếng Việt cho các mục tiêu
    const goalLabels: Record<string, string> = {
      AUTOMATE_SOCIAL: 'Tự động hóa truyền thông & mạng xã hội (AI đăng bài, tìm kiếm lead từ Facebook Group)',
      CSKH: 'Chăm sóc khách hàng tự động (AI Chatbot phản hồi Zalo, Facebook DMs và Live chat)',
      EMAIL_DRIP: 'Tiếp thị qua Email thông minh (AI RAG tự động sinh email chào mừng, chăm sóc cá nhân hóa)',
      SEO_TRAFFIC: 'Tối ưu hóa SEO & Traffic (Phân tích SEO, nghiên cứu từ khóa, tối ưu trang đích kéo traffic)',
    };
    const selectedGoalLabel = goalLabels[onboardingGoal] || onboardingGoal;

    // 3. Gọi AI để đề xuất chiến lược tăng trưởng
    let aiAuditReport = '';
    const ai = getAiConfig('/chat/completions');

    if (ai.apiKey) {
      try {
        console.log(`[Onboarding AI] Đang gọi LLM để lập kế hoạch tăng trưởng cho ${companyName}`);
        const systemPrompt = `Bạn là Giám đốc tăng trưởng (Chief Growth Officer - CGO) kiêm chuyên gia tối ưu hóa SEO của Be Traffic (nền tảng Growth OS All-in-One).
Hãy lập một bản kế hoạch chiến lược phát triển lưu lượng truy cập và tự động hóa bán hàng chi tiết viết bằng Tiếng Việt định dạng Markdown cho khách hàng mới.
Bản kế hoạch cần thiết thực, rõ ràng từng bước hành động cụ thể, và kết nối trực tiếp với các công cụ có sẵn trong hệ thống Be Traffic.

Thông tin khách hàng khai báo:
- Tên doanh nghiệp/Thương hiệu: "${companyName}"
- Đường dẫn website: ${websiteUrl || 'Không có (chưa xây dựng website)'}
- Mục tiêu chính được lựa chọn: "${selectedGoalLabel}"

Kết quả kiểm tra SEO nhanh của hệ thống:
${seoReportDetails}

Yêu cầu định dạng cấu trúc báo cáo bằng Markdown gồm các phần:
# 🎯 CHIẾN LƯỢC TĂNG TRƯỞNG & TỰ ĐỘNG HÓA CHO [Tên doanh nghiệp]

## 1. Phân tích hiện trạng & Cơ hội phát triển
- Đánh giá hiện trạng dựa trên việc họ đã có website hay chưa (nếu có, nhận định qua điểm số audit; nếu chưa, gợi ý phễu bắt đầu bằng việc xây dựng Landing Page trên Be Traffic).
- Chỉ ra các cơ hội tăng trưởng tức thì dựa trên mục tiêu cốt lõi họ đã chọn.

## 2. Lộ trình Hành động Ưu tiên (Tập trung vào mục tiêu chính)
- Đưa ra 3 hành động cụ thể mà doanh nghiệp cần thực hiện ngay trong tuần đầu tiên.

## 3. Hướng dẫn áp dụng công cụ Be Traffic
- Hướng dẫn rõ ràng cách họ sẽ sử dụng tính năng tương ứng của Be Traffic để giải quyết vấn đề (Ví dụ: Cách nạp tài liệu vào RAG, thiết lập kịch bản email tự động, kết nối chatbot Zalo/Livechat, thiết lập chiến dịch quét Group Facebook, v.v.).

LƯU Ý: Viết báo cáo đầy thuyết phục, chuyên nghiệp, trình bày đẹp mắt bằng Markdown sạch (sử dụng bullet points, bảng biểu và in đậm hợp lý), KHÔNG dùng các ghi chú suy nghĩ hay mã code bọc ngoài Markdown.`;

        const response = await fetchWithRetry(ai.url, {
          method: 'POST',
          headers: ai.headers,
          body: JSON.stringify({
            model: ai.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: 'Hãy sinh bản kế hoạch định hướng chiến lược tăng trưởng ngay lập tức.' }
            ],
            temperature: 0.75,
          }),
          signal: AbortSignal.timeout(35000),
        });

        if (response.ok) {
          const resJson = await response.json() as any;
          aiAuditReport = resJson.choices?.[0]?.message?.content?.trim() || '';
        } else {
          throw new Error(`AI API trả về status: ${response.status}`);
        }
      } catch (aiErr: any) {
        console.error('[Onboarding AI Error] Lỗi gọi AI sinh báo cáo:', aiErr.message);
        aiAuditReport = `## 🎯 KHỞI ĐẦU NHANH CHO ${companyName.toUpperCase()}
        
Chúng tôi rất vui mừng được hỗ trợ bạn trong việc triển khai kế hoạch kinh doanh của mình.
Mục tiêu trọng tâm đã chọn: **${selectedGoalLabel}**

### 💡 Các khuyến nghị hành động nhanh trên Be Traffic:
1. **Liên kết Kênh tiếp cận**: Truy cập phần **Cài đặt -> Kết nối kênh** để liên kết các trang Facebook Fanpage hoặc Zalo OA của bạn.
2. **Thiết lập Tri thức RAG**: Tải lên các file giới thiệu sản phẩm/dịch vụ tại mục **Tri thức RAG (AI)** để chatbot tự động học và trả lời khách hàng chuẩn xác.
3. **Chạy thử chiến dịch AI Social Listening**: Nhập từ khóa nhu cầu (Ví dụ: *Cần thiết kế web, mua phần mềm*) để AI tự động tìm kiếm cơ hội bán hàng trên các Group Facebook lớn.

*(Lưu ý: Báo cáo chi tiết tạm thời gặp sự cố kết nối AI. Bạn có thể bấm nút tiếp tục để truy cập ngay vào hệ thống).*`;
      }
    } else {
      // Fallback if no API key is provided
      aiAuditReport = `## 🎯 KHỞI ĐẦU NHANH CHO ${companyName.toUpperCase()}
Mục tiêu trọng tâm: **${selectedGoalLabel}**
*(Vui lòng thiết lập OpenAI API Key trong cấu hình môi trường của hệ thống backend để nhận báo cáo phân tích tự động cá nhân hóa từ AI).*`;
    }

    // 4. Lưu dữ liệu onboarding hoàn tất vào cơ sở dữ liệu
    const updatedWorkspace = await prisma.workspace.update({
      where: { id: req.workspaceId },
      data: {
        companyName,
        websiteUrl: websiteUrl || null,
        onboardingGoal,
        onboardingCompleted: true,
        aiAuditReport,
        // Cập nhật tên Workspace theo tên công ty để cá nhân hóa
        name: `Workspace ${companyName}`
      }
    });

    res.json({
      success: true,
      workspaceId: updatedWorkspace.id,
      onboardingCompleted: true,
      aiAuditReport,
      auditScore
    });
  } catch (err: any) {
    console.error('[Onboarding API Error]:', err);
    res.status(500).json({ error: err.message || 'Lỗi hệ thống khi xử lý onboarding.' });
  }
});

export default router;
