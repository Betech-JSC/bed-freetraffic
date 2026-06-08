"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchDueCskhFollowUps = dispatchDueCskhFollowUps;
exports.dispatchDueCskhAutoCare = dispatchDueCskhAutoCare;
exports.startCskhFollowupWorker = startCskhFollowupWorker;
const prisma_1 = __importDefault(require("../lib/prisma"));
const smtp_1 = require("../lib/smtp");
const ai_1 = require("../lib/ai");
const TICK_MS = 60_000; // Quét mỗi 60 giây
/**
 * Xử lý email follow-up cho một phiên chat đơn lẻ.
 * Được bọc trong try-catch độc lập để đảm bảo nếu một phiên chat bị lỗi,
 * nó sẽ không làm gián đoạn toàn bộ tiến trình quét hoặc gây crash server.
 */
async function processSession(session) {
    const workspaceId = session.workspaceId;
    // 1. Kiểm tra Cấu hình CSKH của Workspace
    const cskhConfig = await prisma_1.default.cskhConfig.findUnique({
        where: { workspaceId }
    });
    // Nếu không bật tính năng follow-up (delay = 0 hoặc null) thì đánh dấu đã xử lý và bỏ qua
    if (!cskhConfig || !cskhConfig.followUpDelayHours || cskhConfig.followUpDelayHours <= 0) {
        await prisma_1.default.chatSession.update({
            where: { id: session.id },
            data: { followUpSent: true }
        });
        return;
    }
    // 2. Kiểm tra thông tin khách hàng nhận thư
    if (!session.customer || !session.customer.email) {
        await prisma_1.default.chatSession.update({
            where: { id: session.id },
            data: { followUpSent: true }
        });
        return;
    }
    // 3. Tạo văn bản lịch sử cuộc hội thoại
    const conversationText = session.messages
        .map((m) => `${m.sender === 'visitor' ? 'Khách hàng' : 'Trợ lý ảo AI'}: ${m.content}`)
        .join('\n');
    const ai = (0, ai_1.getAiConfig)('/chat/completions');
    let emailBody = '';
    // 4. Gọi OpenAI soạn thảo thư cá nhân hóa (nếu có API Key)
    if (ai.apiKey) {
        const systemPrompt = `Bạn là chuyên viên chăm sóc khách hàng bằng tiếng Việt.
Nhiệm vụ của bạn là viết một email hỏi han thân thiện, chu đáo gửi tới khách hàng dựa trên lịch sử cuộc trò chuyện trực tuyến của họ với chatbot hỗ trợ của chúng tôi.
Dưới đây là định hướng phong cách và nội dung thư của quản trị viên:
---
${cskhConfig.followUpEmailBody || 'Hỏi thăm khách hàng xem họ có cần hỗ trợ thêm thông tin gì từ cuộc trò chuyện trước không.'}
---
Chi tiết cuộc hội thoại của khách hàng với chatbot:
${conversationText}

Quy tắc:
1. Viết email lịch sự, chân thành, tự nhiên, không sáo rỗng. Hãy xưng hô thân mật phù hợp (ví dụ: chào anh/chị, xưng em hoặc tên thương hiệu).
2. Email cần tóm tắt ngắn gọn mối quan tâm hoặc thắc mắc trước đó của khách hàng, hỏi han xem họ đã giải quyết được vấn đề chưa, hoặc có cần hỗ trợ thêm thông tin gì không.
3. Hãy đưa ra giải pháp/định hướng rõ ràng và mời họ phản hồi lại thư này nếu cần hỗ trợ trực tiếp.
4. Chỉ trả về NỘI DUNG EMAIL DƯỚI DẠNG HTML (sử dụng các thẻ cơ bản như <p>, <strong>, <br> để định dạng, KHÔNG dùng markdown hay thẻ html/head/body toàn trang). KHÔNG bao bọc bằng thẻ \`\`\`html.`;
        try {
            const response = await fetch(ai.url, {
                method: 'POST',
                headers: ai.headers,
                body: JSON.stringify({
                    model: ai.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `Hãy viết email chăm sóc gửi đến khách hàng ${session.customer.name || 'Quý khách'}.` }
                    ],
                    temperature: 0.7,
                    max_tokens: 800,
                }),
                signal: AbortSignal.timeout(15000),
            });
            if (response.ok) {
                const data = await response.json();
                emailBody = data.choices?.[0]?.message?.content?.trim() || '';
            }
            else {
                const errorText = await response.text();
                console.error('[CskhFollowupWorker] Lỗi OpenAI API:', response.status, errorText);
            }
        }
        catch (err) {
            console.error('[CskhFollowupWorker] Lỗi kết nối OpenAI:', err);
        }
    }
    // 5. Thư mẫu dự phòng nếu không dùng/không gọi được AI
    if (!emailBody) {
        emailBody = `<p>Chào ${session.customer.name || 'quý khách'},</p>
<p>Cảm ơn bạn đã liên hệ và trò chuyện với chatbot của chúng tôi gần đây.</p>
<p>Chúng tôi gửi thư này để hỏi xem bạn đã giải quyết được thắc mắc của mình chưa? Nếu bạn cần bất kỳ sự hỗ trợ trực tiếp nào từ chuyên viên của chúng tôi, vui lòng phản hồi lại email này nhé!</p>
<p>Trân trọng,<br>Đội ngũ hỗ trợ khách hàng</p>`;
    }
    // 6. Xử lý tiêu đề thư
    let subject = cskhConfig.followUpEmailSubject || 'Cảm ơn quý khách đã quan tâm hỗ trợ từ chúng tôi';
    subject = subject.replace(/{{name}}/g, session.customer.name || 'Quý khách');
    // 7. Gửi email qua SMTP
    const transporter = await (0, smtp_1.createSmtpTransporter)(workspaceId);
    const smtpConfig = await (0, smtp_1.getSmtpConfig)(workspaceId);
    if (transporter && smtpConfig) {
        await transporter.sendMail({
            from: `"${smtpConfig.email.split('@')[0]}" <${smtpConfig.email}>`,
            to: session.customer.email,
            subject,
            html: emailBody,
        });
        // Lưu nhật ký vào CRM
        await prisma_1.default.customerEmailLog.create({
            data: {
                customerId: session.customer.id,
                subject,
                body: emailBody,
                status: 'SENT',
                sentAt: new Date(),
            },
        });
        console.log(`[CskhFollowupWorker] Đã gửi email follow-up thành công đến ${session.customer.email}`);
    }
    else {
        console.warn(`[CskhFollowupWorker] SMTP chưa được cấu hình hoặc thiếu email khách hàng cho session ${session.id}`);
    }
    // 8. Đánh dấu gửi thành công
    await prisma_1.default.chatSession.update({
        where: { id: session.id },
        data: { followUpSent: true }
    });
}
async function dispatchDueCskhFollowUps() {
    try {
        const now = new Date();
        // Lấy các phiên chat đã đến lịch gửi follow-up nhưng chưa gửi, và có liên kết khách hàng
        const dueSessions = await prisma_1.default.chatSession.findMany({
            where: {
                followUpScheduledAt: { lte: now },
                followUpSent: false,
                customerId: { not: null },
            },
            include: {
                customer: true,
                messages: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        if (dueSessions.length === 0)
            return;
        console.log(`[CskhFollowupWorker] Tìm thấy ${dueSessions.length} phiên chat đến hạn gửi follow-up.`);
        for (const session of dueSessions) {
            try {
                await processSession(session);
            }
            catch (err) {
                console.error(`[CskhFollowupWorker] Lỗi xử lý phiên chat ${session.id}:`, err);
                // Để tránh loop vô tận khi lỗi liên tục, lùi lịch gửi 30 phút.
                // Bọc trong try-catch riêng biệt để đảm bảo không crash app nếu truy cập DB thất bại.
                try {
                    await prisma_1.default.chatSession.update({
                        where: { id: session.id },
                        data: {
                            followUpScheduledAt: new Date(Date.now() + 30 * 60 * 1000)
                        }
                    });
                }
                catch (dbErr) {
                    console.error(`[CskhFollowupWorker] Không thể lùi lịch gửi cho session ${session.id}:`, dbErr);
                }
            }
        }
    }
    catch (error) {
        console.error('[CskhFollowupWorker] Lỗi quét tiến trình gửi email chăm sóc:', error);
    }
}
async function dispatchDueCskhAutoCare() {
    try {
        const now = new Date();
        // 1. Lấy tất cả CskhConfig mà autoCareEnabled là true
        const activeConfigs = await prisma_1.default.cskhConfig.findMany({
            where: { autoCareEnabled: true }
        });
        for (const config of activeConfigs) {
            const workspaceId = config.workspaceId;
            if (!workspaceId)
                continue;
            // Đọc các kênh được cấu hình để gửi chăm sóc tự động
            const channels = (config.autoCareChannels || 'email')
                .split(',')
                .map(c => c.trim().toLowerCase())
                .filter(Boolean);
            if (channels.length === 0)
                continue;
            // 2. Tìm danh sách khách hàng cần gửi chăm sóc tự động
            let dueCustomers = [];
            if (config.autoCareScheduleType === 'AFTER_CREATION') {
                const threshold = new Date(Date.now() - config.autoCareDelayHours * 60 * 60 * 1000);
                dueCustomers = await prisma_1.default.customer.findMany({
                    where: {
                        workspaceId,
                        createdAt: { lte: threshold },
                        lastAiCareSentAt: null,
                        status: { not: 'INACTIVE' },
                    },
                    include: {
                        notes: { orderBy: { createdAt: 'desc' } },
                        orders: { orderBy: { createdAt: 'desc' } },
                    }
                });
            }
            else if (config.autoCareScheduleType === 'PERIODIC') {
                const threshold = new Date(Date.now() - config.autoCareIntervalDays * 24 * 60 * 60 * 1000);
                dueCustomers = await prisma_1.default.customer.findMany({
                    where: {
                        workspaceId,
                        status: { not: 'INACTIVE' },
                        OR: [
                            { lastAiCareSentAt: null },
                            { lastAiCareSentAt: { lte: threshold } }
                        ]
                    },
                    include: {
                        notes: { orderBy: { createdAt: 'desc' } },
                        orders: { orderBy: { createdAt: 'desc' } },
                    }
                });
            }
            if (dueCustomers.length === 0)
                continue;
            console.log(`[CskhAutoCare] Workspace ${workspaceId} tìm thấy ${dueCustomers.length} khách hàng cần gửi chăm sóc tự động.`);
            // Hoist connection/config loading for the workspace before customer loop
            let transporter = null;
            let smtpConfig = null;
            if (channels.includes('email')) {
                transporter = await (0, smtp_1.createSmtpTransporter)(workspaceId);
                smtpConfig = await (0, smtp_1.getSmtpConfig)(workspaceId);
            }
            let zaloConn = null;
            if (channels.includes('zalo')) {
                zaloConn = await prisma_1.default.socialConnection.findFirst({
                    where: { platform: 'zalo', workspaceId }
                });
            }
            // 3. Xử lý từng khách hàng
            for (const customer of dueCustomers) {
                try {
                    // Với mỗi khách hàng, gửi tin nhắn chăm sóc qua các kênh được cấu hình
                    for (const channel of channels) {
                        // Kiểm tra điều kiện từng kênh
                        if (channel === 'email' && !customer.email)
                            continue;
                        if (channel === 'zalo' && !customer.zaloUserId && !customer.phone)
                            continue;
                        // 4. Tạo prompt cá nhân hóa dựa trên dữ liệu khách hàng
                        const notesText = customer.notes.map((n) => `- Ghi chú lúc ${n.createdAt.toLocaleDateString('vi-VN')}: ${n.content}`).join('\n');
                        const ordersText = customer.orders.map((o) => `- Đơn hàng ${o.orderNumber}: ${o.totalAmount} VND (Trạng thái: ${o.status})`).join('\n');
                        const ai = (0, ai_1.getAiConfig)('/chat/completions');
                        let messageBody = '';
                        if (ai.apiKey) {
                            const systemPrompt = `Bạn là trợ lý ảo AI chăm sóc khách hàng tự động thông minh bằng tiếng Việt.
Nhiệm vụ của bạn là viết một tin nhắn chăm sóc khách hàng cá nhân hóa dựa trên hồ sơ khách hàng dưới đây.

Hồ sơ khách hàng:
- Họ tên: ${customer.name}
- Email: ${customer.email || 'Chưa cung cấp'}
- Số điện thoại: ${customer.phone || 'Chưa cung cấp'}
- Công ty: ${customer.company || 'Chưa cung cấp'}
- Trạng thái chăm sóc hiện tại: ${customer.status}

Lịch sử ghi chú chăm sóc của nhân viên:
${notesText || '(Chưa có ghi chú nào)'}

Lịch sử đơn hàng:
${ordersText || '(Chưa có đơn hàng nào)'}

Định hướng nội dung từ Quản trị viên:
---
${config.autoCareEmailBody || 'Hỏi thăm khách hàng xem họ có cần hỗ trợ thêm thông tin gì không.'}
---

Quy tắc:
1. Viết tin nhắn lịch sự, chân thành, tự nhiên, không sáo rỗng. Cá nhân hóa theo thông tin công ty, ghi chú hoặc đơn hàng của họ.
2. Xưng hô thân mật phù hợp (ví dụ: chào anh/chị, xưng em hoặc tên thương hiệu).
3. Chỉ trả về NỘI DUNG DƯỚI DẠNG HTML (sử dụng các thẻ cơ bản như <p>, <strong>, <br>, <ul>, <li> để định dạng, KHÔNG dùng markdown hay thẻ html/head/body toàn trang). KHÔNG bao bọc bằng thẻ \`\`\`html.`;
                            try {
                                const response = await fetch(ai.url, {
                                    method: 'POST',
                                    headers: ai.headers,
                                    body: JSON.stringify({
                                        model: ai.model,
                                        messages: [
                                            { role: 'system', content: systemPrompt },
                                            { role: 'user', content: `Hãy viết tin nhắn chăm sóc gửi qua kênh ${channel} cho khách hàng ${customer.name}.` }
                                        ],
                                        temperature: 0.7,
                                        max_tokens: 800,
                                    }),
                                    signal: AbortSignal.timeout(15000),
                                });
                                if (response.ok) {
                                    const data = await response.json();
                                    messageBody = data.choices?.[0]?.message?.content?.trim() || '';
                                }
                                else {
                                    console.error(`[CskhAutoCare] Lỗi OpenAI API:`, response.status);
                                }
                            }
                            catch (err) {
                                console.error(`[CskhAutoCare] Lỗi kết nối OpenAI:`, err);
                            }
                        }
                        // Nếu không dùng OpenAI hoặc gọi lỗi, dùng bản mẫu dự phòng
                        if (!messageBody) {
                            messageBody = `<p>Chào ${customer.name || 'quý khách'},</p>
<p>Chúng tôi liên hệ từ bộ phận hỗ trợ khách hàng tự động để gửi lời chúc tốt đẹp nhất tới bạn và công ty ${customer.company || 'của bạn'}.</p>
<p>Chúng tôi luôn sẵn sàng đồng hành cùng bạn để tối ưu hóa lưu lượng truy cập và cải thiện hiệu quả SEO. Nếu bạn cần bất kỳ sự hỗ trợ nào, đừng ngần ngại liên hệ nhé!</p>
<p>Trân trọng,<br>Đội ngũ hỗ trợ</p>`;
                        }
                        // Xử lý tiêu đề
                        let subject = config.autoCareEmailSubject || 'Tin nhắn chăm sóc khách hàng';
                        subject = subject.replace(/{{name}}/g, customer.name || 'Quý khách')
                            .replace(/{{company}}/g, customer.company || 'Doanh nghiệp')
                            .replace(/{{email}}/g, customer.email || '');
                        // Thực thi gửi theo kênh
                        let success = false;
                        let errorMsg = null;
                        if (channel === 'email') {
                            if (transporter && smtpConfig) {
                                try {
                                    await transporter.sendMail({
                                        from: `"${smtpConfig.email.split('@')[0]}" <${smtpConfig.email}>`,
                                        to: customer.email,
                                        subject,
                                        html: messageBody,
                                    });
                                    success = true;
                                }
                                catch (sendErr) {
                                    errorMsg = sendErr.message || 'Lỗi gửi email SMTP';
                                }
                            }
                            else {
                                errorMsg = 'SMTP chưa được cấu hình cho Workspace';
                            }
                        }
                        else if (channel === 'zalo') {
                            try {
                                if (!zaloConn || zaloConn.status !== 'CONNECTED' || !zaloConn.accessToken) {
                                    throw new Error('Chưa kết nối Zalo OA. Vui lòng kết nối Zalo OA trong Cài đặt trước.');
                                }
                                const plainText = messageBody.replace(/<[^>]+>/g, '');
                                const plainSubject = subject.replace(/<[^>]+>/g, '');
                                if (customer.zaloUserId) {
                                    const zaloRes = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
                                        method: 'POST',
                                        headers: {
                                            'access_token': zaloConn.accessToken,
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({
                                            recipient: {
                                                user_id: customer.zaloUserId
                                            },
                                            message: {
                                                text: `${plainSubject}\n\n${plainText}`
                                            }
                                        })
                                    });
                                    const zaloData = await zaloRes.json();
                                    if (zaloData.error !== 0 && zaloData.error !== undefined) {
                                        throw new Error(zaloData.message || `Zalo OA API Error code ${zaloData.error}`);
                                    }
                                    success = true;
                                }
                                else if (customer.phone) {
                                    let phoneFormatted = customer.phone.replace(/[^0-9]/g, '');
                                    if (phoneFormatted.startsWith('0')) {
                                        phoneFormatted = '84' + phoneFormatted.substring(1);
                                    }
                                    const znsTemplateId = process.env.ZALO_ZNS_TEMPLATE_ID || 'default';
                                    const znsRes = await fetch('https://business.openapi.zalo.me/message/template', {
                                        method: 'POST',
                                        headers: {
                                            'access_token': zaloConn.accessToken,
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({
                                            phone: phoneFormatted,
                                            template_id: znsTemplateId,
                                            template_data: {
                                                name: customer.name,
                                                subject: plainSubject,
                                                content: plainText.substring(0, 100)
                                            }
                                        })
                                    });
                                    const znsData = await znsRes.json();
                                    if (znsData.error !== 0 && znsData.error !== undefined) {
                                        throw new Error(`Zalo API error: ${znsData.message || 'Không gửi được tin nhắn'}. Bạn cần liên kết Zalo User ID hoặc đăng ký ZNS Template.`);
                                    }
                                    success = true;
                                }
                                else {
                                    throw new Error('Khách hàng này không có Zalo User ID hoặc Số điện thoại để gửi Zalo.');
                                }
                            }
                            catch (zaloErr) {
                                errorMsg = zaloErr.message || 'Lỗi gửi tin nhắn Zalo';
                            }
                        }
                        else if (channel === 'messenger') {
                            // Mock Messenger sending
                            console.log(`[CskhAutoCare Messenger] Gửi tin nhắn đến khách hàng ${customer.name}: ${messageBody.slice(0, 100)}...`);
                            success = true;
                        }
                        // Ghi nhận nhật ký chăm sóc
                        await prisma_1.default.customerEmailLog.create({
                            data: {
                                customerId: customer.id,
                                subject,
                                body: messageBody,
                                status: success ? 'SENT' : 'FAILED',
                                errorMessage: errorMsg,
                                channel,
                            }
                        });
                        if (success) {
                            console.log(`[CskhAutoCare] Đã gửi tin nhắn chăm sóc qua ${channel} thành công cho khách hàng ${customer.name}`);
                        }
                        else {
                            console.error(`[CskhAutoCare] Gửi tin nhắn chăm sóc qua ${channel} thất bại cho khách hàng ${customer.name}: ${errorMsg}`);
                        }
                    }
                    // Cập nhật mốc thời gian đã gửi chăm sóc tự động cho khách hàng
                    await prisma_1.default.customer.update({
                        where: { id: customer.id },
                        data: { lastAiCareSentAt: new Date() }
                    });
                }
                catch (custErr) {
                    console.error(`[CskhAutoCare] Lỗi xử lý khách hàng ${customer.id}:`, custErr);
                }
            }
        }
    }
    catch (error) {
        console.error('[CskhAutoCare] Lỗi quét tiến trình chăm sóc tự động:', error);
    }
}
function startCskhFollowupWorker() {
    setInterval(() => {
        void dispatchDueCskhFollowUps().catch((err) => {
            console.error('[CskhFollowupWorker] Lỗi tiến trình follow-up:', err);
        });
        void dispatchDueCskhAutoCare().catch((err) => {
            console.error('[CskhFollowupWorker] Lỗi tiến trình auto-care:', err);
        });
    }, TICK_MS);
    console.log('✅ CSKH Follow-up & AI Auto-Care Worker — quét và gửi tin nhắn tự động mỗi 60 giây');
}
