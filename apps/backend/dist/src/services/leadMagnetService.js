"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAndSendLeadReport = generateAndSendLeadReport;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const ai_1 = require("../lib/ai");
const smtp_1 = require("../lib/smtp");
/**
 * Downloads a font if it doesn't exist, to support Vietnamese Unicode in PDFKit.
 */
async function ensureFontExists(filename, url) {
    const uploadsDir = path_1.default.join(__dirname, '../../uploads');
    if (!fs_1.default.existsSync(uploadsDir)) {
        fs_1.default.mkdirSync(uploadsDir, { recursive: true });
    }
    const fontPath = path_1.default.join(uploadsDir, filename);
    if (fs_1.default.existsSync(fontPath)) {
        return fontPath;
    }
    try {
        console.log(`[LeadMagnet] Downloading font from ${url}...`);
        const res = await fetch(url);
        if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            fs_1.default.writeFileSync(fontPath, Buffer.from(arrayBuffer));
            console.log(`[LeadMagnet] Font saved to ${fontPath}`);
            return fontPath;
        }
    }
    catch (err) {
        console.error(`[LeadMagnet] Failed to download font:`, err.message);
    }
    return 'Helvetica'; // Fallback
}
/**
 * Helper to convert PDF document to Buffer
 */
function docToBuffer(doc) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });
}
/**
 * Scrapes metadata from target URL
 */
async function scrapeUrlMetadata(url) {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'GrowthOSBot/1.0 Lead-Magnet-Generator' },
            signal: AbortSignal.timeout(6000),
        });
        if (res.ok) {
            const html = await res.text();
            const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || '';
            const desc = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim() || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i)?.[1]?.trim() || '';
            return { title, desc };
        }
    }
    catch (err) {
        console.warn(`[LeadMagnet Scraper] Failed to scrape ${url}:`, err.message);
    }
    return { title: 'Website', desc: 'Không có mô tả' };
}
/**
 * Generates SEO & Growth audit report using DeepSeek
 */
async function generateAuditReportData(url, title, desc) {
    const ai = (0, ai_1.getAiConfig)('/chat/completions', 'lead_qualifier');
    if (!ai.apiKey) {
        throw new Error('Chưa cấu hình OPENAI_API_KEY ở backend.');
    }
    const prompt = `Bạn là chuyên gia tư vấn tối ưu chuyển đổi và tăng trưởng doanh nghiệp (Growth & SEO Consultant).
Hãy lập một Bản báo cáo Tăng trưởng & Tối ưu SEO nhanh cho website: ${url}.
Thông tin cào quét ban đầu:
- Tiêu đề website: "${title}"
- Mô tả website: "${desc}"

Yêu cầu nội dung báo cáo:
1. Đánh giá tổng quan (summary): Viết khoảng 3-4 câu đánh giá tổng thể cấu trúc và cơ hội phát triển.
2. Điểm đánh giá (seoGrade): Trả về 1 chữ cái xếp hạng chất lượng SEO hiện tại (A, B, C hoặc D).
3. Danh sách 3 điểm nghẽn/vấn đề lớn nhất (issues): Mỗi vấn đề gồm tiêu đề (title) và mô tả chi tiết cách sửa (description).
4. Danh sách 4 hành động đề xuất cụ thể (recommendations): Mỗi hành động gồm hành động (action), mức độ tác động (impact: Cao/Trung bình/Thấp), mức độ nỗ lực (effort: Dễ/Vừa/Khó).

Yêu cầu định dạng: Trả về DUY NHẤT một đối tượng JSON hợp lệ (không kèm lời dẫn hay markdown), khớp định dạng sau:
{
  "summary": "Nội dung tóm tắt",
  "seoGrade": "B",
  "issues": [
    { "title": "Tiêu đề lỗi", "description": "Cách khắc phục" }
  ],
  "recommendations": [
    { "action": "Hành động tối ưu", "impact": "Cao", "effort": "Dễ" }
  ]
}`;
    const res = await (0, ai_1.fetchWithRetry)(ai.url, {
        method: 'POST',
        headers: ai.headers,
        body: JSON.stringify({
            model: ai.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
            max_tokens: 1500,
        }),
        signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) {
        throw new Error(`AI API returned status ${res.status}`);
    }
    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content?.trim() || '';
    return (0, ai_1.parseAiJson)(rawText);
}
/**
 * Builds A4 PDF document buffer using PDFKit with custom styles and fonts
 */
async function buildAuditPdf(url, report) {
    // Download Unicode fonts for Vietnamese accents support
    const fontRegular = await ensureFontExists('Roboto-Regular.ttf', 'https://github.com/google/fonts/raw/main/apache/roboto/static/Roboto-Regular.ttf');
    const fontBold = await ensureFontExists('Roboto-Bold.ttf', 'https://github.com/google/fonts/raw/main/apache/roboto/static/Roboto-Bold.ttf');
    const doc = new pdfkit_1.default({ margin: 48, size: 'A4' });
    const bufferPromise = docToBuffer(doc);
    // Define brand colors
    const primaryColor = '#e85d26'; // Brand orange
    const darkColor = '#1e293b'; // Slate 800
    const grayColor = '#64748b'; // Slate 500
    // 1. Header Banner
    doc.rect(0, 0, 595.28, 90).fill(primaryColor);
    // Header text
    doc.fillColor('#ffffff')
        .font(fontBold)
        .fontSize(20)
        .text('BÁO CÁO PHÂN TÍCH TĂNG TRƯỞNG & SEO', 48, 25)
        .fontSize(10)
        .font(fontRegular)
        .text(`Được thực hiện tự động bởi Trợ lý AI Growth OS · ${new Date().toLocaleDateString('vi-VN')}`, 48, 52);
    // Reset text color to dark slate
    doc.fillColor(darkColor).font(fontRegular).fontSize(10);
    // 2. Info Block
    doc.y = 120;
    doc.font(fontBold).text('THÔNG TIN PHÂN TÍCH', 48, doc.y);
    doc.font(fontRegular);
    doc.text(`• Website đích: `, 48, doc.y + 15, { continued: true })
        .font(fontBold).fillColor(primaryColor).text(url, { continued: false })
        .fillColor(darkColor).font(fontRegular);
    doc.text(`• Điểm đánh giá SEO: `)
        .font(fontBold).fillColor(primaryColor).fontSize(14).text(` ${report.seoGrade} `, { continued: false })
        .fontSize(10).fillColor(darkColor).font(fontRegular);
    // Divider line
    doc.moveTo(48, doc.y + 15).lineTo(547, doc.y + 15).stroke('#e2e8f0');
    // 3. Overview/Summary
    doc.y = doc.y + 35;
    doc.font(fontBold).fontSize(12).fillColor(primaryColor).text('1. ĐÁNH GIÁ TỔNG QUAN', 48, doc.y);
    doc.font(fontRegular).fontSize(10).fillColor(darkColor);
    doc.moveDown(0.5);
    doc.text(report.summary, { align: 'justify', lineGap: 3 });
    // 4. Critical Issues
    doc.moveDown(1.5);
    doc.font(fontBold).fontSize(12).fillColor(primaryColor).text('2. ĐIỂM NGHẼN CẦN KHẮC PHỤC NGAY');
    doc.font(fontRegular).fontSize(10).fillColor(darkColor);
    doc.moveDown(0.5);
    report.issues.forEach((issue, idx) => {
        doc.font(fontBold).fillColor(primaryColor).text(` Lỗi ${idx + 1}: ${issue.title} `)
            .font(fontRegular).fillColor(darkColor).text(issue.description, { lineGap: 2 });
        doc.moveDown(0.8);
    });
    // 5. Growth Recommendations
    doc.moveDown(0.5);
    doc.font(fontBold).fontSize(12).fillColor(primaryColor).text('3. HÀNH ĐỘNG ĐỀ XUẤT TĂNG TRƯỞNG');
    doc.font(fontRegular).fontSize(10).fillColor(darkColor);
    doc.moveDown(0.5);
    report.recommendations.forEach((rec, idx) => {
        doc.font(fontBold).text(`• Đề xuất ${idx + 1}: `, { continued: true })
            .font(fontRegular).text(`${rec.action} `, { continued: true })
            .font(fontBold).fillColor(primaryColor).text(`[Tác động: ${rec.impact} | Nỗ lực: ${rec.effort}]`, { continued: false })
            .fillColor(darkColor).font(fontRegular);
        doc.moveDown(0.5);
    });
    // Footer text
    doc.moveTo(48, 770).lineTo(547, 770).stroke('#e2e8f0');
    doc.fontSize(8).fillColor(grayColor).text('Bản quyền thuộc về Be Traffic System · Tự động hóa CRM & Phễu khách hàng.', 48, 780, { align: 'center' });
    doc.end();
    return bufferPromise;
}
/**
 * Core function to generate the lead report, save the customer to CRM, and send the email
 */
async function generateAndSendLeadReport(workspaceId, targetUrl, email, name) {
    console.log(`[LeadMagnet] Starting generation for ${email} targeting ${targetUrl}`);
    // 1. Scrape metadata
    const metadata = await scrapeUrlMetadata(targetUrl);
    // 2. Query AI
    const reportData = await generateAuditReportData(targetUrl, metadata.title, metadata.desc);
    // 3. Compile PDF
    const pdfBuffer = await buildAuditPdf(targetUrl, reportData);
    // 4. Save Customer to CRM (or update existing)
    let customer = await prisma_1.default.customer.findFirst({
        where: { email: email.trim().toLowerCase(), workspaceId },
    });
    const noteContent = `🎯 Khách hàng tiềm năng đăng ký nhận báo cáo Lead Magnet tự động.\n🔗 Website phân tích: ${targetUrl}\n📊 Điểm đánh giá AI: Xếp hạng ${reportData.seoGrade}\n📝 Tóm tắt: "${reportData.summary}"`;
    if (customer) {
        customer = await prisma_1.default.customer.update({
            where: { id: customer.id },
            data: {
                name: name || customer.name || 'Khách hàng ẩn danh',
                status: 'NEW',
                trafficSource: 'LEAD_MAGNET',
                notes: {
                    create: [{ content: noteContent }],
                },
            },
        });
    }
    else {
        customer = await prisma_1.default.customer.create({
            data: {
                name: name || 'Khách hàng ẩn danh',
                email: email.trim().toLowerCase(),
                status: 'NEW',
                trafficSource: 'LEAD_MAGNET',
                workspaceId,
                notes: {
                    create: [{ content: noteContent }],
                },
            },
        });
    }
    // 5. Send SMTP Email with PDF attachment
    const transporter = await (0, smtp_1.createSmtpTransporter)(workspaceId);
    const smtpConfig = await (0, smtp_1.getSmtpConfig)(workspaceId);
    if (transporter && smtpConfig) {
        const subject = `📊 Bản báo cáo Tăng trưởng & Tối ưu SEO cho trang ${targetUrl.replace('https://', '').replace('http://', '')}`;
        const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
        <h2 style="color: #e85d26; border-bottom: 2px solid #e85d26; padding-bottom: 10px;">Bản báo cáo từ AI Growth OS</h2>
        <p>Chào bạn,</p>
        <p>Cảm ơn bạn đã đăng ký nhận báo cáo kiểm toán hiệu suất website tự động từ hệ thống <strong>Be Traffic</strong>.</p>
        <p>AI của chúng tôi đã hoàn tất phân tích website của bạn tại địa chỉ: <a href="${targetUrl}" style="color: #e85d26; text-decoration: none; font-weight: bold;">${targetUrl}</a></p>
        
        <div style="background-color: #fcf6f2; border-left: 4px solid #e85d26; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <h4 style="margin: 0 0 8px 0; color: #e85d26;">Đánh giá sơ bộ:</h4>
          <p style="margin: 0; font-style: italic;">"${reportData.summary}"</p>
          <p style="margin: 8px 0 0 0; font-weight: bold;">Điểm đánh giá SEO tổng quát: Xếp hạng ${reportData.seoGrade}</p>
        </div>

        <p>Chi tiết về 3 điểm nghẽn nghiêm trọng nhất và các đề xuất hành động đã được xuất thành <strong>file PDF đính kèm</strong> trong email này.</p>
        <p>Nếu cần hỗ trợ cấu hình hệ thống hoặc tư vấn sâu hơn về cách thu hút traffic tự động, bạn có thể phản hồi trực tiếp email này.</p>
        <br/>
        <p>Trân trọng,<br/><strong>Đội ngũ Be Traffic System</strong></p>
      </div>
    `;
        await transporter.sendMail({
            from: `"${smtpConfig.email.split('@')[0]}" <${smtpConfig.email}>`,
            to: email,
            subject,
            html: htmlContent,
            attachments: [
                {
                    filename: `Bao-cao-GrowthOS-${customer.id}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf',
                },
            ],
        });
        console.log(`[LeadMagnet] Email with PDF sent successfully to ${email}`);
        // Log the email to CRM
        await prisma_1.default.customerEmailLog.create({
            data: {
                customerId: customer.id,
                subject,
                body: htmlContent,
                status: 'SENT',
                channel: 'email',
                sentAt: new Date(),
            },
        });
    }
    else {
        console.warn(`[LeadMagnet] SMTP not configured for Workspace #${workspaceId}. PDF generated but email skipped.`);
    }
    return { success: true, customerId: customer.id };
}
