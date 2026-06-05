import prisma from '../lib/prisma';
import { getAiConfig } from '../lib/ai';


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
      // Load recent message history for context (last 8 messages)
      const history = await prisma.chatMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: 'asc' },
        take: 8,
      });

      const messagesForAi = history.map(msg => ({
        role: msg.sender === 'visitor' ? 'user' as const : 'assistant' as const,
        content: msg.content,
      }));

      const systemPrompt = `Bạn là chatbot chăm sóc khách hàng tự động thông minh bằng tiếng Việt của chúng tôi.
Dưới đây là tri thức của hệ thống (Knowledge Base):
---
${kbText || 'Hiện chưa có thông tin tri thức cụ thể.'}
---
Nhiệm vụ của bạn:
1. Trả lời câu hỏi của khách hàng dựa trên thông tin Tri thức trên một cách lịch sự, thân thiện và chuyên nghiệp.
2. Chỉ trả lời dựa trên Tri thức được cung cấp. Nếu thông tin không có trong Tri thức, bạn KHÔNG tự ý bịa đặt thông tin. Thay vào đó, hãy lịch sự từ chối trả lời trực tiếp và đề xuất khách hàng để lại Email hoặc Số điện thoại để chuyên viên của chúng tôi liên hệ hỗ trợ trực tiếp.
3. Luôn giữ thái độ phục vụ chu đáo, xưng hô phù hợp (ví dụ: dạ, em, mình, quý khách).
4. Hãy viết câu trả lời ngắn gọn, rõ ràng, tập trung vào câu hỏi của khách.`;

      const response = await fetch(ai.url, {
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
      updatedData.lastContactAt = new Date();

      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: updatedData,
      });
    } else {
      // Create new customer
      customer = await prisma.customer.create({
        data: {
          name: email.split('@')[0],
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

  return {
    sessionId: session.id,
    reply: replyText,
    customerId,
  };
}
