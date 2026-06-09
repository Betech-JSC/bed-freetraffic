import prisma from '../lib/prisma';
import { getAiConfig, fetchWithRetry } from '../lib/ai';


export interface ChatMessageData {
  sender: 'visitor' | 'bot';
  content: string;
  createdAt: Date;
}

export async function sendTelegramAlert(workspaceId: number, text: string): Promise<void> {
  try {
    const conn = await prisma.socialConnection.findFirst({
      where: { platform: 'telegram', workspaceId }
    });
    const token = conn?.accessToken || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = conn?.pageId || process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return;
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    console.error('Lỗi gửi Telegram alert:', e);
  }
}

async function extractNameFromMessage(
  message: string,
  email: string,
  apiKey: string,
  url: string,
  model: string,
  headers: Record<string, string>
): Promise<string> {
  const defaultName = email.split('@')[0];
  try {
    let response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'Bạn là trợ lý AI chuyên trích xuất họ và tên (hoặc tên gọi) của khách hàng từ nội dung tin nhắn trò chuyện bằng tiếng Việt. Chỉ trả về chuỗi tên sạch được viết hoa chữ cái đầu (Ví dụ: "Lê Duy Khanh", "Nguyễn Văn A"), không trả về thêm bất kỳ từ giải thích hay ký tự thừa nào. Nếu không tìm thấy tên trong tin nhắn, chỉ trả về chuỗi rỗng "".'
          },
          { role: 'user', content: `Nội dung tin nhắn: "${message}"` }
        ],
        temperature: 0.1,
        max_tokens: 50,
      }),
      signal: AbortSignal.timeout(15000),
    });

    // Fallback model if primary failed (e.g. rate limit 429)
    if (!response.ok && apiKey.startsWith('sk-or-')) {
      console.warn(`[extractName] Primary model failed (${response.status}). Trying fallback Qwen...`);
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
        model: 'meta-llama/llama-3.2-3b-instruct:free',
        messages: [
            {
              role: 'system',
              content: 'Bạn là trợ lý AI chuyên trích xuất họ và tên (hoặc tên gọi) của khách hàng từ nội dung tin nhắn trò chuyện bằng tiếng Việt. Chỉ trả về chuỗi tên sạch được viết hoa chữ cái đầu (Ví dụ: "Lê Duy Khanh", "Nguyễn Văn A"), không trả về thêm bất kỳ từ giải thích hay ký tự thừa nào. Nếu không tìm thấy tên trong tin nhắn, chỉ trả về chuỗi rỗng "".'
            },
            { role: 'user', content: `Nội dung tin nhắn: "${message}"` }
          ],
          temperature: 0.1,
          max_tokens: 50,
        }),
        signal: AbortSignal.timeout(15000),
      });
    }

    if (response.ok) {
      const data = await response.json() as any;
      const extracted = data.choices?.[0]?.message?.content?.trim();
      if (extracted) {
        const cleanName = extracted.replace(/^["']|["']$/g, '').trim();
        if (cleanName && cleanName.length < 50 && cleanName !== "") {
          return cleanName;
        }
      }
    }
  } catch (err) {
    console.error('Lỗi khi gọi AI trích xuất tên khách hàng:', err);
  }
  return defaultName;
}

async function segmentLeadWithAi(
  workspaceId: number,
  sessionId: string,
  customerId: number
): Promise<void> {
  const ai = getAiConfig('/chat/completions');
  if (!ai.apiKey) return;

  try {
    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' }
    });

    if (messages.length === 0) return;

    const conversationText = messages
      .map(m => `${m.sender === 'visitor' ? 'Khách hàng' : 'Trợ lý AI'}: ${m.content}`)
      .join('\n');

    const systemPrompt = `Bạn là chuyên gia phân tích bán hàng và phân loại khách hàng tiềm năng (Lead Scoring) bằng tiếng Việt.
Dựa trên lịch sử hội thoại trò chuyện trực tuyến dưới đây giữa Khách hàng và Trợ lý AI, hãy thực hiện phân loại mức độ tiềm năng mua hàng.

Các nhóm phân loại:
- HOT: Khách hàng thể hiện nhu cầu mua hàng cực kỳ rõ ràng, muốn thanh toán ngay, đặt lịch ngay hoặc hỏi chi tiết cách giao dịch.
- WARM: Khách hàng quan tâm thực sự, hỏi sâu về tính năng, giá cả, dịch vụ hoặc sản phẩm cụ thể, có khả năng mua hàng nhưng cần tư vấn thêm.
- COLD: Khách hàng chỉ hỏi dạo qua loa, hỏi thông tin ngoài lề không liên quan, hoặc tin nhắn rác, chào hỏi xong im lặng.

Yêu cầu trả về kết quả định dạng JSON với các trường sau (không sử dụng markdown block \`\`\`json, chỉ trả về chuỗi JSON thô):
{
  "status": "HOT" | "WARM" | "COLD",
  "score": number (điểm từ 0 đến 100),
  "reason": "Giải thích ngắn gọn lý do phân loại (dưới 40 từ)"
}`;

    let response = await fetchWithRetry(ai.url, {
      method: 'POST',
      headers: ai.headers,
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Lịch sử hội thoại:\n${conversationText}` }
        ],
        temperature: 0.2,
        max_tokens: 200,
        response_format: { type: 'json_object' }
      }),
      signal: AbortSignal.timeout(25000),
    });

    // Fallback model if primary failed (e.g. rate limit 429)
    if (!response.ok && ai.apiKey.startsWith('sk-or-')) {
      console.warn(`[AI-CRM-Segmentation] Primary model failed (${response.status}). Trying fallback Llama...`);
      response = await fetchWithRetry(ai.url, {
        method: 'POST',
        headers: ai.headers,
        body: JSON.stringify({
          model: 'meta-llama/llama-3.2-3b-instruct:free',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Lịch sử hội thoại:\n${conversationText}` }
          ],
          temperature: 0.2,
          max_tokens: 200,
          response_format: { type: 'json_object' }
        }),
        signal: AbortSignal.timeout(25000),
      });
    }

    if (response.ok) {
      const data = await response.json() as any;
      const resText = data.choices?.[0]?.message?.content?.trim();
      if (resText) {
        const result = JSON.parse(resText) as { status: string; score: number; reason: string };
        if (result.status && ['HOT', 'WARM', 'COLD'].includes(result.status.toUpperCase())) {
          const aiStatus = result.status.toUpperCase();
          const score = result.score || 0;
          const reason = result.reason || '';

          await prisma.customer.update({
            where: { id: customerId },
            data: { status: aiStatus }
          });

          const noteContent = `[AI Phân Loại]: Trạng thái: ${aiStatus} (Điểm: ${score}/100) - Lý do: ${reason}`;
          
          await prisma.customerNote.create({
            data: {
              customerId,
              content: noteContent
            }
          });

          console.log(`[AI-CRM-Segmentation] Đã phân loại Customer #${customerId} là ${aiStatus} (Score: ${score}). Lý do: ${reason}`);
        }
      }
    }
  } catch (err) {
    console.error('[AI-CRM-Segmentation] Lỗi phân loại khách hàng bằng AI:', err);
  }
}


export async function handleVisitorMessage(
  workspaceId: number,
  sessionId: string | undefined,
  message: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ sessionId: string; reply: string; customerId: number | null }> {
  // 1. Get or create session
  let session;
  if (sessionId) {
    session = await prisma.chatSession.findFirst({
      where: { id: sessionId, workspaceId }
    });
  }

  if (!session) {
    session = await prisma.chatSession.create({
      data: {
        workspaceId,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      }
    });
  }

  // 2. Save visitor message
  await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      sender: 'visitor',
      content: message,
    }
  });

  // Check if agent takeover is active (any agent message in the last 30 minutes)
  const lastAgentMsg = await prisma.chatMessage.findFirst({
    where: { sessionId: session.id, sender: 'agent' },
    orderBy: { createdAt: 'desc' },
  });

  const hasAgentTakeover = lastAgentMsg && (Date.now() - new Date(lastAgentMsg.createdAt).getTime() < 30 * 60 * 1000);
  if (hasAgentTakeover) {
    return {
      sessionId: session.id,
      reply: '',
      customerId: session.customerId,
    };
  }

  // 3. Load CSKH Configuration
  const config = await prisma.cskhConfig.findUnique({
    where: { workspaceId }
  });

  const aiEnabled = config?.aiChatbotEnabled ?? false;
  const kbText = config?.knowledgeBaseText ?? '';
  const ai = getAiConfig('/chat/completions');

  let replyText = 'Cảm ơn bạn đã liên hệ. Hiện tại chatbot AI đang bận. Vui lòng để lại số điện thoại hoặc email để chúng tôi liên hệ hỗ trợ sớm nhất!';

  if (aiEnabled && ai.apiKey) {
    try {
      // Load recent message history for context (last 8 messages, sorted descending then reversed)
      const history = await prisma.chatMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: 'desc' },
        take: 8,
      });
      history.reverse();

      const messagesForAi = history.map(msg => ({
        role: msg.sender === 'visitor' ? 'user' as const : 'assistant' as const,
        content: msg.content,
      }));

      const defaultKb = `Be Traffic (Growth OS) là một nền tảng tối ưu hóa traffic và bán hàng tự động All-in-One.
Các tính năng và dịch vụ chính:
1. Đăng bài đa kênh tự động: Lên lịch và xuất bản bài đăng lên Facebook, Zalo, YouTube.
2. SEO Tools: Quét và chấm điểm SEO website (SEO Onpage Auditor), quét và kiểm tra chất lượng backlink.
3. Landing Page & Visual Builder: Thiết kế kéo thả trang đích trực quan không cần code, chèn tracking pixel.
4. Custom Forms & CRM: Thiết kế biểu mẫu thu thập Leads đăng ký, lưu trữ và chăm sóc khách hàng tập trung.
5. Email Drip Campaign: Thiết lập chuỗi email tự động gửi bám đuổi chăm sóc khách hàng.
6. CSKH AI & Chatbot: Hỗ trợ live chat trực tuyến, tự động ghi nhận lead (Email, SĐT) và cảnh báo về Telegram, tự động follow-up sau khi chat kết thúc.
7. Thanh toán đối soát tự động: Tích hợp cổng PayOS VietQR và Stripe quốc tế để nâng hạng khách hàng khi thanh toán thành công.`;

      const effectiveKb = kbText 
        ? `${kbText}\n\nThông tin thêm về hệ thống:\n${defaultKb}` 
        : defaultKb;

      const systemPrompt = `Bạn là chatbot chăm sóc khách hàng tự động thông minh bằng tiếng Việt của chúng tôi.
Dưới đây là tri thức của hệ thống (Knowledge Base):
---
${effectiveKb}
---
Nhiệm vụ của bạn:
1. Trả lời câu hỏi của khách hàng dựa trên thông tin Tri thức trên một cách lịch sự, thân thiện và chuyên nghiệp.
2. Hãy tư vấn linh hoạt và trả lời trực tiếp câu hỏi của khách dựa trên Tri thức. Tránh việc chào hỏi lặp lại nhiều lần nếu khách đã ở trong cuộc hội thoại.
3. Chỉ trả lời dựa trên Tri thức được cung cấp. Nếu thông tin không có trong Tri thức, bạn KHÔNG tự ý bịa đặt thông tin. Thay vào đó, hãy lịch sự đề xuất khách hàng để lại Email hoặc Số điện thoại để chuyên viên của chúng tôi liên hệ hỗ trợ trực tiếp.
4. Luôn giữ thái độ phục vụ chu đáo, xưng hô phù hợp (ví dụ: dạ, em, mình, quý khách).
5. Hãy viết câu trả lời ngắn gọn, rõ ràng, tập trung vào câu hỏi của khách.`;

      let response = await fetchWithRetry(ai.url, {
        method: 'POST',
        headers: ai.headers,
        body: JSON.stringify({
          model: ai.model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messagesForAi
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
        signal: AbortSignal.timeout(15000),
      });

      // Fallback model if primary failed (e.g. rate limit 429 or 502)
      if (!response.ok && ai.apiKey.startsWith('sk-or-')) {
        console.warn(`[cskhChat] Primary model ${ai.model} failed (${response.status}). Trying fallback Qwen...`);
        response = await fetchWithRetry(ai.url, {
          method: 'POST',
          headers: ai.headers,
          body: JSON.stringify({
            model: 'meta-llama/llama-3.2-3b-instruct:free',
            messages: [
              { role: 'system', content: systemPrompt },
              ...messagesForAi
            ],
            temperature: 0.7,
            max_tokens: 500,
          }),
          signal: AbortSignal.timeout(15000),
        });
      }

      if (response.ok) {
        const data = await response.json() as {
          choices?: { message?: { content?: string } }[];
        };
        const generated = data.choices?.[0]?.message?.content?.trim();
        if (generated) {
          replyText = generated;
        }
      } else {
        const errorText = await response.text();
        console.error('OpenAI API error in CSKH:', response.status, errorText);
      }
    } catch (err) {
      console.error('Lỗi khi gọi OpenAI Chatbot CSKH:', err);
    }
  }

  // Save bot response
  await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      sender: 'bot',
      content: replyText,
    }
  });

  // 4. Extract Email & Phone from message
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(?:\+84|0)\d{9,10}/g;

  const emailsFound = message.match(emailRegex);
  const phonesFound = message.match(phoneRegex);

  let customerId = session.customerId;

  if (emailsFound && emailsFound.length > 0) {
    const email = emailsFound[0].toLowerCase();
    const phone = phonesFound && phonesFound.length > 0 ? phonesFound[0] : null;

    // Check if customer exists in the workspace
    let customer = await prisma.customer.findFirst({
      where: { email, workspaceId }
    });

    if (customer) {
      // Update phone if provided
      const updatedData: Record<string, any> = {};
      if (phone && !customer.phone) {
        updatedData.phone = phone;
      }
      // If the current name is default (equals email prefix) and we extracted a better name
      const defaultName = email.split('@')[0];
      if (customer.name === defaultName && ai.apiKey) {
        const extractedName = await extractNameFromMessage(message, email, ai.apiKey, ai.url, ai.model, ai.headers);
        if (extractedName && extractedName !== defaultName) {
          updatedData.name = extractedName;
        }
      }
      updatedData.lastContactAt = new Date();

      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: updatedData,
      });
    } else {
      // Create new customer
      let name = email.split('@')[0];
      if (ai.apiKey) {
        name = await extractNameFromMessage(message, email, ai.apiKey, ai.url, ai.model, ai.headers);
      }

      customer = await prisma.customer.create({
        data: {
          name,
          email,
          phone,
          status: 'NEW',
          workspaceId,
          lastContactAt: new Date(),
        }
      });

      // Send Telegram alert for new lead
      const alertMsg = `🔔 <b>Lead mới từ Live Chat Chatbot!</b>\n\n` +
        `• <b>Email:</b> ${email}\n` +
        `• <b>SĐT:</b> ${phone || 'Chưa cung cấp'}\n` +
        `• <b>Tin nhắn cuối:</b> <i>"${message}"</i>\n\n` +
        `<i>Hệ thống đã tự động lưu khách hàng này vào CRM.</i>`;
      await sendTelegramAlert(workspaceId, alertMsg);
    }

    customerId = customer.id;

    // Link customer to the chat session
    await prisma.chatSession.update({
      where: { id: session.id },
      data: { customerId }
    });
  }

  // 5. Schedule AI Follow-up if Delay configured and customer linked
  if (customerId && config && config.followUpDelayHours && config.followUpDelayHours > 0) {
    const scheduledTime = new Date(Date.now() + config.followUpDelayHours * 60 * 60 * 1000);
    await prisma.chatSession.update({
      where: { id: session.id },
      data: {
        followUpScheduledAt: scheduledTime,
        followUpSent: false, // Reset followUpSent to allow follow-up if they resume chat
      }
    });
  }

  // Gọi AI phân loại lead chạy ngầm ở cuối mỗi lượt chat nếu có khách hàng
  if (customerId) {
    void segmentLeadWithAi(workspaceId, session.id, customerId).catch(err => {
      console.error('Lỗi segmentLeadWithAi:', err);
    });
  }

  return {
    sessionId: session.id,
    reply: replyText,
    customerId,
  };
}
