"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cskhFollowupWorker = exports.cskhFollowupQueue = void 0;
const bullmq_1 = require("bullmq");
const connection_1 = require("./connection");
const prisma_1 = __importDefault(require("../lib/prisma"));
const smtp_1 = require("../lib/smtp");
const ai_1 = require("../lib/ai");
exports.cskhFollowupQueue = connection_1.useRedis ? new bullmq_1.Queue('cskh-ai-followup-queue', { connection: connection_1.connection }) : null;
exports.cskhFollowupWorker = connection_1.useRedis
    ? new bullmq_1.Worker('cskh-ai-followup-queue', async (job) => {
        // 1. Repeatable Cron Job: Quét các chat session và customer cần chăm sóc
        if (job.name === 'cskh-scanner') {
            const now = new Date();
            const claimTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes lock
            // 1a. Quét các ChatSession cần follow-up
            const claimedSessionIds = await prisma_1.default.$transaction(async (tx) => {
                const due = await tx.$queryRawUnsafe(`SELECT id FROM "ChatSession"
               WHERE "followUpScheduledAt" <= $1
                 AND "followUpSent" = false
                 AND "customerId" IS NOT NULL
               FOR UPDATE SKIP LOCKED
               LIMIT 20`, now);
                if (due.length === 0)
                    return [];
                const ids = due.map((s) => s.id);
                await tx.chatSession.updateMany({
                    where: { id: { in: ids } },
                    data: { followUpScheduledAt: claimTime },
                });
                return ids;
            });
            if (claimedSessionIds.length > 0) {
                console.log(`[cskh-scanner] Khóa thành công ${claimedSessionIds.length} chat sessions. Đang đẩy vào hàng đợi...`);
                for (const sessionId of claimedSessionIds) {
                    if (exports.cskhFollowupQueue) {
                        await exports.cskhFollowupQueue.add(`followup-${sessionId}`, {
                            type: 'follow-up',
                            sessionId,
                        });
                    }
                }
            }
            // 1b. Quét các Customer cần auto-care
            const activeConfigs = await prisma_1.default.cskhConfig.findMany({
                where: { autoCareEnabled: true },
            });
            let enqueuedAutoCares = 0;
            for (const config of activeConfigs) {
                const workspaceId = config.workspaceId;
                if (!workspaceId)
                    continue;
                let dueCustomerIds = [];
                await prisma_1.default.$transaction(async (tx) => {
                    if (config.autoCareScheduleType === 'AFTER_CREATION') {
                        const threshold = new Date(Date.now() - config.autoCareDelayHours * 60 * 60 * 1000);
                        const rows = await tx.$queryRawUnsafe(`SELECT id FROM "Customer"
                   WHERE "workspaceId" = $1
                     AND "createdAt" <= $2
                     AND "lastAiCareSentAt" IS NULL
                     AND "status" <> 'INACTIVE'
                   FOR UPDATE SKIP LOCKED
                   LIMIT 50`, workspaceId, threshold);
                        dueCustomerIds = rows.map((r) => r.id);
                    }
                    else if (config.autoCareScheduleType === 'PERIODIC') {
                        const threshold = new Date(Date.now() - config.autoCareIntervalDays * 24 * 60 * 60 * 1000);
                        const rows = await tx.$queryRawUnsafe(`SELECT id FROM "Customer"
                   WHERE "workspaceId" = $1
                     AND "status" <> 'INACTIVE'
                     AND ("lastAiCareSentAt" IS NULL OR "lastAiCareSentAt" <= $2)
                   FOR UPDATE SKIP LOCKED
                   LIMIT 50`, workspaceId, threshold);
                        dueCustomerIds = rows.map((r) => r.id);
                    }
                    if (dueCustomerIds.length > 0) {
                        await tx.customer.updateMany({
                            where: { id: { in: dueCustomerIds } },
                            data: { lastAiCareSentAt: now },
                        });
                    }
                });
                if (dueCustomerIds.length > 0) {
                    console.log(`[cskh-scanner] Workspace ${workspaceId}: Khóa thành công ${dueCustomerIds.length} khách hàng để chăm sóc tự động.`);
                    for (const customerId of dueCustomerIds) {
                        if (exports.cskhFollowupQueue) {
                            await exports.cskhFollowupQueue.add(`autocare-${workspaceId}-${customerId}`, {
                                type: 'auto-care',
                                customerId,
                                workspaceId,
                                configId: config.id,
                            });
                        }
                        enqueuedAutoCares++;
                    }
                }
            }
            return { followUps: claimedSessionIds.length, autoCares: enqueuedAutoCares };
        }
        // 2. Individual Job Handling
        const payload = job.data;
        if (payload.type === 'follow-up') {
            const sessionId = payload.sessionId;
            console.log(`[Worker: cskh-followup] Xử lý email follow-up cho session ${sessionId}`);
            const session = await prisma_1.default.chatSession.findUnique({
                where: { id: sessionId },
                include: {
                    customer: true,
                    messages: {
                        orderBy: { createdAt: 'asc' },
                    },
                },
            });
            if (!session) {
                console.warn(`[Worker: cskh-followup] Không tìm thấy session ${sessionId}`);
                return;
            }
            const workspaceId = session.workspaceId;
            // Đọc cấu hình CSKH
            const cskhConfig = await prisma_1.default.cskhConfig.findUnique({
                where: { workspaceId },
            });
            if (!cskhConfig || !cskhConfig.followUpDelayHours || cskhConfig.followUpDelayHours <= 0) {
                await prisma_1.default.chatSession.update({
                    where: { id: sessionId },
                    data: { followUpSent: true },
                });
                return;
            }
            if (!session.customer || !session.customer.email) {
                await prisma_1.default.chatSession.update({
                    where: { id: sessionId },
                    data: { followUpSent: true },
                });
                return;
            }
            // Tạo văn bản hội thoại
            const conversationText = session.messages
                .map((m) => `${m.sender === 'visitor' ? 'Khách hàng' : 'Trợ lý ảo AI'}: ${m.content}`)
                .join('\n');
            // Lấy tin nhắn của khách hàng làm query truy vấn RAG
            const visitorMessages = session.messages
                .filter((m) => m.sender === 'visitor')
                .map((m) => m.content);
            let relevantChunks = [];
            if (workspaceId) {
                let kbTextCombined = cskhConfig.knowledgeBaseText || '';
                try {
                    const completedSources = await prisma_1.default.knowledgeSource.findMany({
                        where: { workspaceId, status: 'COMPLETED' }
                    });
                    for (const src of completedSources) {
                        if (src.extractedText) {
                            kbTextCombined += `\n\n--- [Nguồn tài liệu: ${src.name}] ---\n` + src.extractedText;
                        }
                    }
                }
                catch (srcErr) {
                    console.error('[cskhFollowupWorker-followup] Lỗi đọc các nguồn tri thức bổ sung:', srcErr);
                }
                const queryStr = visitorMessages.join('\n') || cskhConfig.followUpEmailBody || '';
                if (queryStr) {
                    try {
                        const { retrieveRelevantChunksStructured } = await Promise.resolve().then(() => __importStar(require('../lib/embeddings')));
                        const structuredChunks = await retrieveRelevantChunksStructured(workspaceId, queryStr, 5);
                        relevantChunks = structuredChunks.map(s => `[Nguồn: ${s.source}]\n${s.content}`);
                    }
                    catch (err) {
                        console.warn('[cskhFollowupWorker-followup] Lỗi khi sử dụng pgvector RAG, tự động chuyển sang fallback:', err);
                    }
                    if (relevantChunks.length === 0 && kbTextCombined) {
                        try {
                            const { retrieveRelevantChunks } = await Promise.resolve().then(() => __importStar(require('../services/cskhService')));
                            relevantChunks = retrieveRelevantChunks(kbTextCombined, queryStr, 5);
                        }
                        catch (err) {
                            console.warn('[cskhFollowupWorker-followup] Lỗi khi sử dụng fallback text RAG:', err);
                        }
                    }
                }
            }
            const ragContext = relevantChunks.length > 0
                ? `\nTri thức sản phẩm/doanh nghiệp tham khảo để soạn email:\n---\n${relevantChunks.join('\n\n')}\n---\n`
                : '';
            const ai = (0, ai_1.getAiConfig)('/chat/completions');
            let emailBody = '';
            if (ai.apiKey) {
                const systemPrompt = `Bạn là chuyên viên chăm sóc khách hàng bằng tiếng Việt.
Nhiệm vụ của bạn là viết một email hỏi han thân thiện, chu đáo gửi tới khách hàng dựa trên lịch sử cuộc trò chuyện trực tuyến của họ với chatbot hỗ trợ của chúng tôi.
Dưới đây là định hướng phong cách và nội dung thư của quản trị viên:
---
${cskhConfig.followUpEmailBody || 'Hỏi thăm khách hàng xem họ có cần hỗ trợ thêm thông tin gì từ cuộc trò chuyện trước không.'}
---
${ragContext}
Chi tiết cuộc hội thoại của khách hàng với chatbot:
${conversationText}

Quy tắc:
1. Viết email lịch sự, chân thành, tự nhiên, không sáo rỗng. Hãy xưng hô thân mật phù hợp (ví dụ: chào anh/chị, xưng em hoặc tên thương hiệu).
2. Email cần tóm tắt ngắn gọn mối quan tâm hoặc thắc mắc trước đó của khách hàng, hỏi han xem họ đã giải quyết được vấn đề chưa, hoặc có cần hỗ trợ thêm thông tin gì không. Sử dụng thông tin trong phần Tri thức sản phẩm/doanh nghiệp ở trên (nếu có) để đưa ra thông tin tư vấn chính xác.
3. Hãy đưa ra giải pháp/định hướng rõ ràng và mời họ phản hồi lại thư này nếu cần hỗ trợ trực tiếp.
4. Chỉ trả về NỘI DUNG EMAIL DƯỚI DẠNG HTML (sử dụng các thẻ cơ bản như <p>, <strong>, <br> để định dạng, KHÔNG dùng markdown hay thẻ html/head/body toàn trang). KHÔNG bao bọc bằng thẻ \`\`\`html.`;
                try {
                    const response = await (0, ai_1.fetchWithRetry)(ai.url, {
                        method: 'POST',
                        headers: ai.headers,
                        body: JSON.stringify({
                            model: ai.model,
                            messages: [
                                { role: 'system', content: systemPrompt },
                                { role: 'user', content: `Hãy viết email chăm sóc gửi đến khách hàng ${session.customer.name || 'Quý khách'}.` },
                            ],
                            temperature: 0.7,
                            max_tokens: 800,
                        }),
                        signal: AbortSignal.timeout(15000),
                    });
                    if (response.ok) {
                        const data = (await response.json());
                        emailBody = data.choices?.[0]?.message?.content?.trim() || '';
                    }
                    else {
                        console.error('[Worker: cskh-followup] OpenAI API Error:', response.status);
                    }
                }
                catch (err) {
                    console.error('[Worker: cskh-followup] Lỗi OpenAI:', err);
                }
            }
            if (!emailBody) {
                emailBody = `<p>Chào ${session.customer.name || 'quý khách'},</p>
<p>Cảm ơn bạn đã liên hệ và trò chuyện với chatbot của chúng tôi gần đây.</p>
<p>Chúng tôi gửi thư này để hỏi xem bạn đã giải quyết được thắc mắc của mình chưa? Nếu bạn cần bất kỳ sự hỗ trợ trực tiếp nào từ chuyên viên của chúng tôi, vui lòng phản hồi lại email này nhé!</p>
<p>Trân trọng,<br>Đội ngũ hỗ trợ khách hàng</p>`;
            }
            let subject = cskhConfig.followUpEmailSubject || 'Cảm ơn quý khách đã quan tâm hỗ trợ từ chúng tôi';
            subject = subject.replace(/{{name}}/g, session.customer.name || 'Quý khách');
            const transporter = await (0, smtp_1.createSmtpTransporter)(workspaceId);
            const smtpConfig = await (0, smtp_1.getSmtpConfig)(workspaceId);
            if (transporter && smtpConfig) {
                await transporter.sendMail({
                    from: `"${smtpConfig.email.split('@')[0]}" <${smtpConfig.email}>`,
                    to: session.customer.email,
                    subject,
                    html: emailBody,
                });
                await prisma_1.default.customerEmailLog.create({
                    data: {
                        customerId: session.customer.id,
                        subject,
                        body: emailBody,
                        status: 'SENT',
                        sentAt: new Date(),
                    },
                });
                console.log(`[Worker: cskh-followup] Đã gửi email follow-up thành công đến ${session.customer.email}`);
            }
            else {
                console.warn(`[Worker: cskh-followup] SMTP chưa được cấu hình hoặc thiếu email cho session ${session.id}`);
            }
            await prisma_1.default.chatSession.update({
                where: { id: sessionId },
                data: { followUpSent: true },
            });
        }
        if (payload.type === 'auto-care') {
            const { customerId, workspaceId, configId } = payload;
            console.log(`[Worker: cskh-autocare] Xử lý AI auto-care cho customer #${customerId} tại workspace #${workspaceId}`);
            const customer = await prisma_1.default.customer.findUnique({
                where: { id: customerId },
                include: {
                    notes: { orderBy: { createdAt: 'desc' } },
                    orders: { orderBy: { createdAt: 'desc' } },
                },
            });
            const config = await prisma_1.default.cskhConfig.findUnique({
                where: { id: configId },
            });
            if (!customer || !config || !workspaceId) {
                console.warn(`[Worker: cskh-autocare] Thiếu thông tin customer/config để gửi auto-care.`);
                return;
            }
            const channels = (config.autoCareChannels || 'email')
                .split(',')
                .map((c) => c.trim().toLowerCase())
                .filter(Boolean);
            if (channels.length === 0)
                return;
            let transporter = null;
            let smtpConfig = null;
            if (channels.includes('email')) {
                transporter = await (0, smtp_1.createSmtpTransporter)(workspaceId);
                smtpConfig = await (0, smtp_1.getSmtpConfig)(workspaceId);
            }
            let zaloConn = null;
            if (channels.includes('zalo')) {
                zaloConn = await prisma_1.default.socialConnection.findFirst({
                    where: { platform: 'zalo', workspaceId },
                });
            }
            const channelsToTry = [...channels];
            if (channelsToTry.includes('zalo') && !channelsToTry.includes('email') && customer.email) {
                channelsToTry.push('email');
            }
            let sentSuccessfully = false;
            for (const channel of channelsToTry) {
                if (channel === 'email' && !customer.email)
                    continue;
                if (channel === 'zalo' && !customer.zaloUserId && !customer.phone)
                    continue;
                const notesText = customer.notes
                    .map((n) => `- Ghi chú lúc ${n.createdAt.toLocaleDateString('vi-VN')}: ${n.content}`)
                    .join('\n');
                const ordersText = customer.orders
                    .map((o) => `- Đơn hàng ${o.orderNumber}: ${o.totalAmount} VND (Trạng thái: ${o.status})`)
                    .join('\n');
                // Lấy thông tin ghi chú & đơn hàng làm query truy vấn RAG
                let relevantChunks = [];
                if (workspaceId) {
                    let kbTextCombined = config.knowledgeBaseText || '';
                    try {
                        const completedSources = await prisma_1.default.knowledgeSource.findMany({
                            where: { workspaceId, status: 'COMPLETED' }
                        });
                        for (const src of completedSources) {
                            if (src.extractedText) {
                                kbTextCombined += `\n\n--- [Nguồn tài liệu: ${src.name}] ---\n` + src.extractedText;
                            }
                        }
                    }
                    catch (srcErr) {
                        console.error('[cskhFollowupWorker-autocare] Lỗi đọc các nguồn tri thức bổ sung:', srcErr);
                    }
                    const queryParts = [];
                    if (customer.notes && customer.notes.length > 0) {
                        queryParts.push(customer.notes.map(n => n.content).join(' '));
                    }
                    if (customer.orders && customer.orders.length > 0) {
                        queryParts.push(customer.orders.map(o => o.orderNumber).join(' '));
                    }
                    if (config.autoCareEmailBody) {
                        queryParts.push(config.autoCareEmailBody);
                    }
                    const queryStr = queryParts.join(' ').trim() || 'chăm sóc khách hàng';
                    if (queryStr) {
                        try {
                            const { retrieveRelevantChunksStructured } = await Promise.resolve().then(() => __importStar(require('../lib/embeddings')));
                            const structuredChunks = await retrieveRelevantChunksStructured(workspaceId, queryStr, 5);
                            relevantChunks = structuredChunks.map(s => `[Nguồn: ${s.source}]\n${s.content}`);
                        }
                        catch (err) {
                            console.warn('[cskhFollowupWorker-autocare] Lỗi khi sử dụng pgvector RAG, tự động chuyển sang fallback:', err);
                        }
                        if (relevantChunks.length === 0 && kbTextCombined) {
                            try {
                                const { retrieveRelevantChunks } = await Promise.resolve().then(() => __importStar(require('../services/cskhService')));
                                relevantChunks = retrieveRelevantChunks(kbTextCombined, queryStr, 5);
                            }
                            catch (err) {
                                console.warn('[cskhFollowupWorker-autocare] Lỗi khi sử dụng fallback text RAG:', err);
                            }
                        }
                    }
                }
                const ragContext = relevantChunks.length > 0
                    ? `\nTri thức sản phẩm/doanh nghiệp tham khảo để soạn email:\n---\n${relevantChunks.join('\n\n')}\n---\n`
                    : '';
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
${ragContext}

Quy tắc:
1. Viết tin nhắn lịch sự, chân thành, tự nhiên, không sáo rỗng. Cá nhân hóa theo thông tin công ty, ghi chú hoặc đơn hàng của họ. Sử dụng thông tin trong phần Tri thức sản phẩm/doanh nghiệp ở trên (nếu có) để đưa ra nội dung tư vấn chính xác.
2. Xưng hô thân mật phù hợp (ví dụ: chào anh/chị, xưng em hoặc tên thương hiệu).
3. Chỉ trả về NỘI DUNG DƯỚI DẠNG HTML (sử dụng các thẻ cơ bản như <p>, <strong>, <br>, <ul>, <li> để định dạng, KHÔNG dùng markdown hay thẻ html/head/body toàn trang). KHÔNG bao bọc bằng thẻ \`\`\`html.`;
                    try {
                        const response = await (0, ai_1.fetchWithRetry)(ai.url, {
                            method: 'POST',
                            headers: ai.headers,
                            body: JSON.stringify({
                                model: ai.model,
                                messages: [
                                    { role: 'system', content: systemPrompt },
                                    { role: 'user', content: `Hãy viết tin nhắn chăm sóc gửi qua kênh ${channel} cho khách hàng ${customer.name}.` },
                                ],
                                temperature: 0.7,
                                max_tokens: 800,
                            }),
                            signal: AbortSignal.timeout(15000),
                        });
                        if (response.ok) {
                            const data = (await response.json());
                            messageBody = data.choices?.[0]?.message?.content?.trim() || '';
                        }
                        else {
                            console.error(`[Worker: cskh-autocare] OpenAI API Error:`, response.status);
                        }
                    }
                    catch (err) {
                        console.error(`[Worker: cskh-autocare] Lỗi kết nối OpenAI:`, err);
                    }
                }
                if (!messageBody) {
                    messageBody = `<p>Chào ${customer.name || 'quý khách'},</p>
<p>Chúng tôi liên hệ từ bộ phận hỗ trợ khách hàng tự động để gửi lời chúc tốt đẹp nhất tới bạn và công ty ${customer.company || 'của bạn'}.</p>
<p>Chúng tôi luôn sẵn sàng đồng hành cùng bạn để tối ưu hóa lưu lượng truy cập và cải thiện hiệu quả SEO. Nếu bạn cần bất kỳ sự hỗ trợ nào, đừng ngần ngại liên hệ nhé!</p>
<p>Trân trọng,<br>Đội ngũ hỗ trợ</p>`;
                }
                let subject = config.autoCareEmailSubject || 'Tin nhắn chăm sóc khách hàng';
                subject = subject
                    .replace(/{{name}}/g, customer.name || 'Quý khách')
                    .replace(/{{company}}/g, customer.company || 'Doanh nghiệp')
                    .replace(/{{email}}/g, customer.email || '');
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
                                    access_token: zaloConn.accessToken,
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    recipient: {
                                        user_id: customer.zaloUserId,
                                    },
                                    message: {
                                        text: `${plainSubject}\n\n${plainText}`,
                                    },
                                }),
                            });
                            const zaloData = (await zaloRes.json());
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
                                    access_token: zaloConn.accessToken,
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    phone: phoneFormatted,
                                    template_id: znsTemplateId,
                                    template_data: {
                                        name: customer.name,
                                        subject: plainSubject,
                                        content: plainText.substring(0, 100),
                                    },
                                }),
                            });
                            const znsData = (await znsRes.json());
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
                    console.log(`[Worker: cskh-autocare Messenger] Gửi tin nhắn đến khách hàng ${customer.name}: ${messageBody.slice(0, 100)}...`);
                    success = true;
                }
                await prisma_1.default.customerEmailLog.create({
                    data: {
                        customerId: customer.id,
                        subject,
                        body: messageBody,
                        status: success ? 'SENT' : 'FAILED',
                        errorMessage: errorMsg,
                        channel,
                    },
                });
                if (success) {
                    console.log(`[Worker: cskh-autocare] Đã gửi tin nhắn chăm sóc qua ${channel} thành công cho khách hàng ${customer.name}`);
                    sentSuccessfully = true;
                    break; // Fallback thành công, dừng lại không gửi kênh tiếp theo
                }
                else {
                    console.error(`[Worker: cskh-autocare] Gửi qua ${channel} thất bại cho khách hàng ${customer.name}: ${errorMsg}. Đang thử kênh fallback tiếp theo...`);
                }
            }
        }
    }, {
        connection: connection_1.connection,
        concurrency: 3,
    })
    : null;
if (exports.cskhFollowupQueue) {
    exports.cskhFollowupQueue.on('error', (err) => {
        (0, connection_1.logRedisError)('Queue: cskh-followup', err);
    });
}
if (exports.cskhFollowupWorker) {
    exports.cskhFollowupWorker.on('failed', (job, err) => {
        console.error(`[Worker: cskh-followup] Job ${job?.id} thất bại:`, err.message);
    });
    exports.cskhFollowupWorker.on('error', (err) => {
        (0, connection_1.logRedisError)('Worker: cskh-followup', err);
    });
}
