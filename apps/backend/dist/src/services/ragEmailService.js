"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEmailWithRag = generateEmailWithRag;
exports.getFallbackEmail = getFallbackEmail;
const prisma_1 = __importDefault(require("../lib/prisma"));
const ai_1 = require("../lib/ai");
const embeddings_1 = require("../lib/embeddings");
/**
 * Lấy thông tin ngữ cảnh khách hàng & đơn hàng đầy đủ từ database
 */
async function getEventContext(payload) {
    let customer = null;
    let order = null;
    let notes = [];
    const customerId = payload.customerId || payload.customer?.id;
    const orderId = payload.orderId || payload.order?.id;
    if (customerId) {
        customer = await prisma_1.default.customer.findUnique({
            where: { id: customerId },
            include: {
                notes: { orderBy: { createdAt: 'desc' }, take: 5 },
                orders: { orderBy: { createdAt: 'desc' }, take: 3 }
            }
        });
        if (customer?.notes) {
            notes = customer.notes.map((n) => n.content);
        }
    }
    if (orderId) {
        order = await prisma_1.default.order.findUnique({
            where: { id: orderId },
            include: {
                items: {
                    include: { product: true }
                }
            }
        });
    }
    else if (payload.orderNumber) {
        order = await prisma_1.default.order.findFirst({
            where: { orderNumber: payload.orderNumber },
            include: {
                items: {
                    include: { product: true }
                }
            }
        });
    }
    return {
        customerName: customer?.name || payload.customerName || payload.customer?.name || 'Quý khách',
        customerEmail: customer?.email || payload.customerEmail || payload.customer?.email || '',
        customerCompany: customer?.company || payload.customerCompany || payload.customer?.company || '',
        customerPhone: customer?.phone || payload.customerPhone || payload.customer?.phone || '',
        notes,
        orderNumber: order?.orderNumber || payload.orderNumber || '',
        orderTotal: order?.totalAmount || payload.orderTotal || 0,
        orderItems: order?.items?.map((item) => ({
            productName: item.product?.name || 'Sản phẩm',
            quantity: item.quantity,
            price: item.price
        })) || [],
        releaseNotes: payload.releaseNotes || payload.updateContent || '',
        chatHistory: payload.chatHistory || payload.conversationText || '',
        customMessage: payload.customMessage || ''
    };
}
/**
 * Sinh email tự động sử dụng RAG Kép (Query Expansion & RAG Chunks)
 */
async function generateEmailWithRag(workspaceId, eventType, payload) {
    const context = await getEventContext(payload);
    const ai = (0, ai_1.getAiConfig)('/chat/completions', 'content_generation');
    // Nếu không có API Key, dùng fallback email được thiết kế đẹp mắt trực tiếp
    if (!ai.apiKey) {
        console.warn('[ragEmailService] Không cấu hình AI API Key. Sử dụng fallback email mẫu.');
        return getFallbackEmail(eventType, context);
    }
    try {
        // Bước 1: Sinh câu truy vấn kép (Query Expansion)
        const expansionSystemPrompt = `Bạn là trợ lý AI chuyên phân tích ngữ cảnh chăm sóc khách hàng.
Dựa vào loại sự kiện (eventType) và thông tin ngữ cảnh khách hàng/đơn hàng, hãy sinh ra đúng 2 câu truy vấn tìm kiếm tiếng Việt tối ưu cho cơ sở dữ liệu tri thức vector (RAG):
1. 'businessQuery': tìm kiếm thông tin nghiệp vụ, sản phẩm, hướng dẫn, giới thiệu phù hợp nhất với loại sự kiện này.
2. 'layoutQuery': tìm kiếm mẫu email layout, template HTML thiết kế, màu sắc thiết kế email phù hợp.

Định dạng trả về là JSON duy nhất, ví dụ:
{
  "businessQuery": "câu truy vấn nghiệp vụ",
  "layoutQuery": "câu truy vấn mẫu email layout"
}
Không kèm bất kỳ văn bản giải thích hay code block markdown.`;
        const expansionUserPrompt = `Event Type: ${eventType}
Context: ${JSON.stringify(context)}`;
        let businessQuery = `${eventType} ${context.customerCompany} information`;
        let layoutQuery = `email template layout HTML`;
        try {
            const expansionRes = await (0, ai_1.fetchWithRetry)(ai.url, {
                method: 'POST',
                headers: ai.headers,
                body: JSON.stringify({
                    model: ai.model,
                    messages: [
                        { role: 'system', content: expansionSystemPrompt },
                        { role: 'user', content: expansionUserPrompt }
                    ],
                    temperature: 0.3,
                    max_tokens: 300
                }),
                signal: AbortSignal.timeout(10000)
            });
            if (expansionRes.ok) {
                const data = await expansionRes.json();
                const content = data.choices?.[0]?.message?.content || '';
                const parsed = (0, ai_1.parseAiJson)(content);
                if (parsed.businessQuery)
                    businessQuery = parsed.businessQuery;
                if (parsed.layoutQuery)
                    layoutQuery = parsed.layoutQuery;
            }
        }
        catch (err) {
            console.error('[ragEmailService] Lỗi Query Expansion:', err);
        }
        console.log(`[ragEmailService] Kích hoạt RAG Kép:\n- Business Query: "${businessQuery}"\n- Layout Query: "${layoutQuery}"`);
        // Bước 2: Thực hiện truy xuất pgvector song song
        const [businessChunks, layoutChunks] = await Promise.all([
            (0, embeddings_1.retrieveRelevantChunksStructured)(workspaceId, businessQuery, 4),
            (0, embeddings_1.retrieveRelevantChunksStructured)(workspaceId, layoutQuery, 4)
        ]);
        // Nếu không tìm thấy layout phù hợp trong RAG, thử query chung chung
        let finalLayoutChunks = layoutChunks;
        if (layoutChunks.length === 0) {
            finalLayoutChunks = await (0, embeddings_1.retrieveRelevantChunksStructured)(workspaceId, 'Email template.pdf layout HTML', 3);
        }
        const businessContext = businessChunks
            .map(c => `[Nguồn: ${c.source}]\n${c.content}`)
            .join('\n\n');
        const layoutContext = finalLayoutChunks
            .map(c => `[Nguồn: ${c.source}]\n${c.content}`)
            .join('\n\n');
        // Bước 3: Soạn email chính với LLM
        const mainSystemPrompt = `Bạn là trợ lý AI chăm sóc khách hàng siêu thông minh của Growth OS (Be Traffic).
Nhiệm vụ của bạn là viết một email chăm sóc khách hàng gửi qua email dựa trên thông tin sự kiện và tri thức RAG.

LOẠI SỰ KIỆN: ${eventType}

THÔNG TIN NGƯỜI NHẬN & NGỮ CẢNH:
${JSON.stringify(context, null, 2)}

[TRI THỨC DOANH NGHIỆP/SẢN PHẨM RAG]:
${businessContext || '(Không tìm thấy tri thức nghiệp vụ phù hợp, hãy tự sinh nội dung chuyên nghiệp, chính xác về nền tảng Be Traffic/Betech)'}

[MẪU THIẾT KẾ / LAYOUT EMAIL HTML RAG]:
${layoutContext || '(Không tìm thấy mẫu email layout từ RAG, hãy tự dựng một email HTML responsive đẹp mắt, hiện đại)'}

QUY TẮC CỰC KỲ QUAN TRỌNG:
1. Email phải có tiêu đề (subject) hấp dẫn và được cá nhân hóa theo thông tin khách hàng.
2. Nội dung email (htmlContent) phải là một tài liệu HTML hoàn chỉnh (bắt đầu bằng <html> và kết thúc bằng </html>, có <head>, <body>, style inline) được định dạng chuyên nghiệp dựa trên các [MẪU THIẾT KẾ / LAYOUT EMAIL HTML RAG] tìm được. Hãy học tập cấu trúc HTML của mẫu, giữ lại phần header, footer, màu sắc, font chữ (ví dụ: Inter, Outfit, Roboto qua Google Fonts), và thay phần nội dung chính bằng thư viết riêng cho khách hàng này.
3. Không viết chung chung. Cá nhân hóa tối đa theo tên, công ty, chi tiết đơn hàng, lịch sử chat hoặc cập nhật tính năng.
4. Sử dụng CSS inline để hiển thị tốt nhất trên Gmail, Outlook, Apple Mail... (ví dụ: style="font-family: 'Inter', sans-serif; color: #333;").
5. Trả về kết quả duy nhất dưới dạng JSON:
{
  "subject": "Tiêu đề email",
  "htmlContent": "<html>...</html>"
}
Không kèm bất kỳ text giải thích hay code block markdown \`\`\`json.`;
        const mainRes = await (0, ai_1.fetchWithRetry)(ai.url, {
            method: 'POST',
            headers: ai.headers,
            body: JSON.stringify({
                model: ai.model,
                messages: [
                    { role: 'system', content: mainSystemPrompt },
                    { role: 'user', content: `Hãy sinh email chăm sóc khách hàng cá nhân hóa cho sự kiện ${eventType}.` }
                ],
                temperature: 0.7,
                max_tokens: 2000
            }),
            signal: AbortSignal.timeout(25000)
        });
        if (mainRes.ok) {
            const data = await mainRes.json();
            const content = data.choices?.[0]?.message?.content || '';
            const result = (0, ai_1.parseAiJson)(content);
            if (result.subject && result.htmlContent) {
                return result;
            }
        }
        else {
            console.error('[ragEmailService] Lỗi gọi Main LLM:', mainRes.status, await mainRes.text().catch(() => ''));
        }
    }
    catch (err) {
        console.error('[ragEmailService] Gặp lỗi trong tiến trình RAG email:', err);
    }
    // Fallback cuối cùng nếu toàn bộ quá trình LLM thất bại
    console.warn('[ragEmailService] Gặp sự cố trong quá trình AI RAG. Sử dụng fallback email mẫu.');
    return getFallbackEmail(eventType, context);
}
/**
 * Sinh email HTML mẫu đẹp mắt làm Fallback dự phòng
 */
function getFallbackEmail(eventType, context) {
    const name = context.customerName;
    const company = context.customerCompany ? `tại ${context.customerCompany}` : '';
    let subject = '';
    let contentHtml = '';
    const brandColor = '#e85d26'; // Cam thương hiệu Be Traffic
    switch (eventType.toUpperCase()) {
        case 'WELCOME':
            subject = `Chào mừng ${name} đến với gia đình Be Traffic!`;
            contentHtml = `
        <h2 style="color: ${brandColor}; margin-top: 0;">Chào mừng bạn đồng hành!</h2>
        <p>Chào <strong>${name}</strong> ${company},</p>
        <p>Chúc mừng bạn đã tạo tài khoản thành công trên hệ thống của chúng tôi. Chúng tôi rất hân hạnh được đồng hành cùng bạn trên con đường phát triển lưu lượng truy cập và tối ưu doanh số bán hàng.</p>
        <div style="background-color: #fff9f6; border-left: 4px solid ${brandColor}; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <h4 style="margin: 0 0 10px 0; color: ${brandColor};">Các bước bắt đầu nhanh dành cho bạn:</h4>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Bước 1:</strong> Kết nối tên miền website của bạn.</li>
            <li><strong>Bước 2:</strong> Cấu hình các từ khóa SEO mục tiêu.</li>
            <li><strong>Bước 3:</strong> Tạo các biểu mẫu và popup để thu thập lead đầu tiên.</li>
          </ul>
        </div>
        <p>Nếu bạn có bất kỳ câu hỏi nào, đừng ngần ngại phản hồi lại email này. Đội ngũ kỹ thuật của chúng tôi luôn sẵn sàng hỗ trợ bạn 24/7.</p>
      `;
            break;
        case 'PURCHASE':
            subject = `Cảm ơn bạn đã mua hàng! Xác nhận đơn hàng #${context.orderNumber}`;
            let itemsListHtml = '';
            if (context.orderItems && context.orderItems.length > 0) {
                itemsListHtml = `
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="border-bottom: 2px solid #eee; text-align: left;">
                <th style="padding: 10px 0;">Sản phẩm</th>
                <th style="padding: 10px 0; text-align: center;">Số lượng</th>
                <th style="padding: 10px 0; text-align: right;">Đơn giá</th>
              </tr>
            </thead>
            <tbody>
              ${context.orderItems.map((item) => `
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 10px 0;"><strong>${item.productName}</strong></td>
                  <td style="padding: 10px 0; text-align: center;">${item.quantity}</td>
                  <td style="padding: 10px 0; text-align: right;">${item.price.toLocaleString('vi-VN')} VND</td>
                </tr>
              `).join('')}
              <tr>
                <td colspan="2" style="padding: 15px 0 0 0; font-weight: bold;">Tổng cộng:</td>
                <td style="padding: 15px 0 0 0; text-align: right; font-weight: bold; color: ${brandColor}; font-size: 1.1em;">
                  ${context.orderTotal.toLocaleString('vi-VN')} VND
                </td>
              </tr>
            </tbody>
          </table>
        `;
            }
            contentHtml = `
        <h2 style="color: ${brandColor}; margin-top: 0;">Cảm ơn bạn đã tin tưởng mua hàng!</h2>
        <p>Chào <strong>${name}</strong>,</p>
        <p>Đơn hàng <strong>#${context.orderNumber}</strong> của bạn đã thanh toán thành công và được xác nhận trên hệ thống.</p>
        
        ${itemsListHtml}

        <div style="background-color: #f6f6f6; border-radius: 8px; padding: 15px; text-align: center; margin: 25px 0;">
          <p style="margin: 0; font-size: 0.95em;">Quà tặng tri ân đặc biệt dành riêng cho bạn:</p>
          <h3 style="margin: 5px 0 0 0; color: ${brandColor};">MÃ GIẢM GIÁ 15% CHO LẦN GIA HẠN SAU</h3>
          <code style="font-size: 1.2em; font-weight: bold; background: #fff; padding: 4px 10px; border: 1px dashed ${brandColor}; display: inline-block; margin-top: 8px; border-radius: 4px;">BETECHLOVE15</code>
        </div>
        <p>Đơn hàng của bạn đã kích hoạt các tính năng cao cấp tương ứng. Vui lòng truy cập trang quản trị để trải nghiệm ngay.</p>
      `;
            break;
        case 'UPDATE':
            subject = `Bản cập nhật tính năng mới từ Be Traffic`;
            contentHtml = `
        <h2 style="color: ${brandColor}; margin-top: 0;">Be Traffic có gì mới hôm nay?</h2>
        <p>Chào <strong>${name}</strong>,</p>
        <p>Chúng tôi không ngừng cải tiến để mang lại hiệu suất tốt nhất cho chiến dịch marketing của bạn. Dưới đây là những cập nhật và nâng cấp quan trọng vừa được triển khai trên hệ thống:</p>
        
        <div style="background-color: #fcfcfc; border: 1px solid #eee; border-radius: 6px; padding: 18px; margin: 20px 0;">
          ${context.releaseNotes ? `<div style="white-space: pre-wrap; font-family: inherit;">${context.releaseNotes}</div>` : `
            <ul style="margin: 0; padding-left: 20px; line-height: 1.6;">
              <li><strong>Nâng cấp Trợ lý AI CSKH:</strong> Tự động cá nhân hóa email và tối ưu hóa phản hồi theo ngữ cảnh khách hàng.</li>
              <li><strong>Tối ưu hóa Tốc độ Landing Page:</strong> Tăng tốc độ tải trang trên di động thêm 30%.</li>
              <li><strong>Báo cáo SEO chi tiết:</strong> Xuất báo cáo vị trí từ khóa tự động hàng tuần qua file PDF/Excel.</li>
            </ul>
          `}
        </div>
        
        <p>Hãy truy cập bảng điều khiển của bạn ngay để trải nghiệm những cải tiến tuyệt vời này nhé!</p>
      `;
            break;
        case 'FOLLOWUP':
            subject = `Chúng tôi có thể hỗ trợ gì thêm cho bạn?`;
            contentHtml = `
        <h2 style="color: ${brandColor}; margin-top: 0;">Chào ${name},</h2>
        <p>Cảm ơn bạn đã liên hệ và trò chuyện với chatbot hỗ trợ của chúng tôi gần đây.</p>
        
        ${context.chatHistory ? `
          <div style="background-color: #f9f9f9; border-left: 3px solid #ccc; padding: 12px; margin: 15px 0; font-size: 0.9em; color: #555;">
            <strong>Lịch sử cuộc hội thoại trước đó:</strong>
            <p style="white-space: pre-wrap; margin: 5px 0 0 0;">${context.chatHistory}</p>
          </div>
        ` : ''}

        <p>Chúng tôi gửi thư này để hỏi xem bạn đã giải quyết được thắc mắc của mình chưa? Nếu bạn cần bất kỳ sự hỗ trợ trực tiếp nào từ chuyên viên của chúng tôi hoặc cần trao đổi kỹ hơn, vui lòng phản hồi lại email này nhé!</p>
        <p>Đội ngũ của chúng tôi luôn ở đây để giúp đỡ bạn.</p>
      `;
            break;
        case 'ABANDONED':
            subject = `Bạn có cần hỗ trợ hoàn tất đơn hàng của mình?`;
            contentHtml = `
        <h2 style="color: ${brandColor}; margin-top: 0;">Chúng tôi nhận thấy bạn chưa hoàn tất thanh toán</h2>
        <p>Chào <strong>${name}</strong>,</p>
        <p>Hệ thống ghi nhận bạn đang có đơn hàng <strong>#${context.orderNumber}</strong> đang chờ thanh toán.</p>
        
        <div style="background-color: #fff9f6; border: 1px solid #ffdcd0; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center;">
          <p style="margin: 0 0 10px 0;">Đừng bỏ lỡ giải pháp tối ưu hóa Traffic và SEO tốt nhất cho website của bạn.</p>
          <a href="#" style="background-color: ${brandColor}; color: white; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">Hoàn Tất Thanh Toán Ngay</a>
        </div>
        
        <p>Nếu bạn gặp bất kỳ lỗi kỹ thuật hay khó khăn nào trong quá trình chuyển khoản/thanh toán, vui lòng phản hồi lại email này để chúng tôi hỗ trợ bạn ngay lập tức.</p>
      `;
            break;
        case 'INACTIVE':
            subject = `Bí quyết tăng trưởng Traffic đột phá dành cho ${name}`;
            contentHtml = `
        <h2 style="color: ${brandColor}; margin-top: 0;">Đã lâu không gặp bạn!</h2>
        <p>Chào <strong>${name}</strong> ${company},</p>
        <p>Đã lâu chúng tôi chưa thấy bạn đăng nhập vào hệ thống Be Traffic. Chúng tôi hiểu rằng bạn đang rất bận rộn với công việc kinh doanh của mình.</p>
        <p>Để hỗ trợ bạn kéo khách hàng quay trở lại website, chúng tôi xin chia sẻ 3 bí quyết tăng trưởng traffic đột phá trong năm nay:</p>
        <ol style="line-height: 1.6; margin: 20px 0; padding-left: 20px;">
          <li><strong>Tạo Landing Page thu hút Lead:</strong> Tận dụng các mẫu kéo thả có sẵn của chúng tôi để tạo phễu nhanh.</li>
          <li><strong>Tối ưu hóa SEO On-page:</strong> Chạy audit website định kỳ bằng công cụ SEO Audit trong dashboard để tìm lỗi.</li>
          <li><strong>Đặt Pop-up Exit-Intent:</strong> Giữ chân khách hàng chuẩn bị rời đi và tặng họ ưu đãi hấp dẫn.</li>
        </ol>
        <p>Hãy dành ra 5 phút đăng nhập lại hệ thống và bắt đầu tối ưu hóa website của bạn nhé!</p>
      `;
            break;
        default:
            subject = `Tin nhắn chăm sóc khách hàng từ Be Traffic`;
            contentHtml = `
        <h2 style="color: ${brandColor}; margin-top: 0;">Chào ${name},</h2>
        <p>${context.customMessage || 'Cảm ơn bạn đã tin tưởng sử dụng dịch vụ của chúng tôi.'}</p>
        <p>Nếu bạn cần hỗ trợ, xin vui lòng liên hệ bộ phận hỗ trợ khách hàng để được giải đáp nhanh nhất.</p>
      `;
    }
    // Khung template HTML chuẩn, responsive và có màu sắc thương hiệu
    const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body {
          margin: 0;
          padding: 0;
          background-color: #f4f5f7;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .wrapper {
          width: 100%;
          table-layout: fixed;
          background-color: #f4f5f7;
          padding-bottom: 40px;
        }
        .main-card {
          max-width: 600px;
          background-color: #ffffff;
          margin: 40px auto;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          overflow: hidden;
          border-top: 6px solid ${brandColor};
        }
        .header {
          padding: 30px;
          text-align: center;
          background-color: #ffffff;
          border-bottom: 1px solid #f0f0f0;
        }
        .logo {
          font-size: 24px;
          font-weight: 800;
          color: #1a1a1a;
          text-decoration: none;
          letter-spacing: -0.5px;
        }
        .logo span {
          color: ${brandColor};
        }
        .body {
          padding: 40px 30px;
          color: #333333;
          line-height: 1.6;
          font-size: 15px;
        }
        .footer {
          padding: 20px 30px;
          background-color: #fafafa;
          border-top: 1px solid #f0f0f0;
          text-align: center;
          font-size: 12px;
          color: #777777;
        }
        .footer a {
          color: ${brandColor};
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="main-card">
          <div class="header">
            <a href="#" class="logo">BE<span>TRAFFIC</span></a>
          </div>
          <div class="body">
            ${contentHtml}
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Be Traffic. Tất cả quyền được bảo lưu.</p>
            <p>Email này được gửi tự động bởi hệ thống AI Care. <a href="#">Cấu hình cài đặt nhận thư</a></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
    return {
        subject,
        htmlContent: fullHtml
    };
}
