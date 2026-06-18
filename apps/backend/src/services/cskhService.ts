import prisma from '../lib/prisma';
import { getAiConfig, fetchWithRetry } from '../lib/ai';
import { createSmtpTransporter, getSmtpConfig } from '../lib/smtp';
import { getIo } from '../lib/socket';
import fs from 'fs';
import path from 'path';

function getBase64ImageUrl(imageUrl: string): string | null {
  try {
    if (imageUrl.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '../..', imageUrl);
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase().replace('.', '');
        const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
        return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
      }
    } else if (imageUrl.startsWith('data:')) {
      return imageUrl;
    }
  } catch (err) {
    console.error('[Vision Helper] Error converting image to base64:', err);
  }
  return null;
}

function broadcastSocketMessage(workspaceId: number, sessionId: string, message: any) {
  try {
    const io = getIo();
    if (io) {
      io.to(`session:${sessionId}`).emit('new_message', message);
      io.to(`workspace:${workspaceId}`).emit('new_message', message);
      console.log(`[Socket.io] Broadcasted message ${message.id} to session:${sessionId} and workspace:${workspaceId}`);
    }
  } catch (err) {
    console.error('[Socket.io] Error broadcasting message:', err);
  }
}


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
  const ai = getAiConfig('/chat/completions', 'chatbot');
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
    }, 2, 1200, workspaceId, 'lead_qualifier');

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
      }, 2, 1200, workspaceId, 'lead_qualifier');
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


export function detectTakeoverIntent(message: string): boolean {
  const lowerMsg = message.toLowerCase();
  
  // Danh sách từ khóa thể hiện ý định gặp nhân viên hoặc thái độ bực dọc cần can thiệp khẩn cấp
  const takeoverKeywords = [
    'gặp nhân viên', 'nhân viên', 'người thật', 'gặp người', 'tư vấn viên',
    'hỗ trợ trực tiếp', 'gặp admin', 'nói chuyện với người', 'hotline', 'gặp kỹ thuật',
    'chậm quá', 'lừa đảo', 'tệ hại', 'tệ quá', 'không dùng được', 'lỗi hoài',
    'gọi lại', 'liên hệ lại', 'chăm sóc khách hàng', 'cskh', 'gặp hỗ trợ', 
    'admin đâu', 'ad đâu', 'hỗ trợ đâu'
  ];
  
  return takeoverKeywords.some(kw => lowerMsg.includes(kw));
}

async function sendEmailAlert(workspaceId: number, subject: string, htmlContent: string): Promise<void> {
  try {
    const smtpConfig = await getSmtpConfig(workspaceId);
    const transporter = await createSmtpTransporter(workspaceId);
    
    if (transporter && smtpConfig) {
      await transporter.sendMail({
        from: `"${smtpConfig.email.split('@')[0]}" <${smtpConfig.email}>`,
        to: smtpConfig.email, // Gửi về chính email của admin/doanh nghiệp cấu hình
        subject,
        html: htmlContent,
      });
      console.log(`[EmailAlert] Đã gửi email cảnh báo tới ${smtpConfig.email}`);
    }
  } catch (e: any) {
    console.error('[EmailAlert] Lỗi gửi email cảnh báo:', e.message || e);
  }
}

export interface KnowledgeChunk {
  source: string;
  content: string;
}

export function chunkKnowledgeBase(kbText: string): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  if (!kbText) return chunks;

  const sourceMarkerRegex = /---\s*\[Nguồn\s+(?:tài liệu|URL):\s*([^\]]+)\]\s*---/g;
  const matches: { source: string; index: number; length: number }[] = [];
  let match;
  
  while ((match = sourceMarkerRegex.exec(kbText)) !== null) {
    matches.push({
      source: match[1].trim(),
      index: match.index,
      length: match[0].length,
    });
  }

  const splitIntoParagraphs = (text: string, source: string) => {
    const paragraphs = text
      .split(/\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    let currentChunk = '';
    const maxChunkLength = 1000;

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > maxChunkLength && currentChunk.length > 0) {
        chunks.push({
          source,
          content: currentChunk.trim()
        });
        currentChunk = '';
      }
      currentChunk += (currentChunk ? '\n' : '') + paragraph;
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        source,
        content: currentChunk.trim()
      });
    }
  };

  if (matches.length === 0) {
    splitIntoParagraphs(kbText, 'Hướng dẫn chung');
    return chunks;
  }

  if (matches[0].index > 0) {
    const generalText = kbText.substring(0, matches[0].index).trim();
    if (generalText) {
      splitIntoParagraphs(generalText, 'Hướng dẫn chung');
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    const startIndex = currentMatch.index + currentMatch.length;
    const endIndex = (i + 1 < matches.length) ? matches[i + 1].index : kbText.length;
    const sourceText = kbText.substring(startIndex, endIndex).trim();
    
    if (sourceText) {
      splitIntoParagraphs(sourceText, currentMatch.source);
    }
  }

  return chunks;
}

export function retrieveRelevantChunks(kbText: string, query: string, topN: number = 5): string[] {
  const chunks = chunkKnowledgeBase(kbText);
  if (chunks.length === 0) return [];

  const queryTerms = query
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 1);

  if (queryTerms.length === 0) {
    return chunks.slice(0, topN).map(c => `[Nguồn: ${c.source}]\n${c.content}`);
  }

  const scoredChunks = chunks.map(chunk => {
    const contentLower = chunk.content.toLowerCase();
    let score = 0;
    let termMatches = 0;

    for (const term of queryTerms) {
      const occurrences = contentLower.split(term).length - 1;
      if (occurrences > 0) {
        score += Math.sqrt(occurrences);
        termMatches++;
      }
    }

    if (termMatches > 0) {
      score *= (1 + (termMatches / queryTerms.length) * 0.5);
    }

    for (let i = 0; i < queryTerms.length - 1; i++) {
      const bigram = `${queryTerms[i]} ${queryTerms[i+1]}`;
      if (contentLower.includes(bigram)) {
        score += 2.0;
      }
      if (i < queryTerms.length - 2) {
        const trigram = `${queryTerms[i]} ${queryTerms[i+1]} ${queryTerms[i+2]}`;
        if (contentLower.includes(trigram)) {
          score += 3.5;
        }
      }
    }

    return {
      chunk,
      score
    };
  });

  scoredChunks.sort((a, b) => b.score - a.score);
  const matchingChunks = scoredChunks.filter(sc => sc.score > 0);

  const finalChunks = matchingChunks.length > 0 
    ? matchingChunks.slice(0, topN).map(sc => sc.chunk)
    : chunks.slice(0, Math.min(3, topN));

  console.log(`[RAG-Retriever] Đã xử lý RAG. Tìm thấy ${matchingChunks.length} chunks trùng khớp. Trả về top ${finalChunks.length} chunks liên quan nhất.`);
  
  return finalChunks.map(c => `[Nguồn: ${c.source}]\n${c.content}`);
}

export interface ToolCall {
  toolName: string;
  args: Record<string, string>;
  raw: string;
}

export function parseToolCalls(text: string): ToolCall[] {
  const regex = /<call:([a-zA-Z0-9_]+)(?:\s+([^>]+?))?\s*\/>/g;
  const calls: ToolCall[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const toolName = match[1];
    const argsStr = match[2] || '';
    const args: Record<string, string> = {};
    
    const attrRegex = /([a-zA-Z0-9_]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(argsStr)) !== null) {
      const name = attrMatch[1];
      const val = attrMatch[2] !== undefined ? attrMatch[2] : attrMatch[3];
      args[name] = val;
    }
    calls.push({
      toolName,
      args,
      raw: match[0]
    });
  }
  return calls;
}

export function cleanReplyText(text: string): string {
  return text.replace(/<call:[a-zA-Z0-9_]+(?:\s+[^>]+?)?\s*\/>/g, '').trim();
}

async function executeTool(workspaceId: number, toolName: string, args: Record<string, string>, sessionId?: string): Promise<string> {
  console.log(`[ReAct Tool] Executing tool ${toolName} with args:`, args);
  try {
    switch (toolName) {
      case 'searchProducts': {
        const query = args.query || '';
        if (!query) return JSON.stringify({ error: 'Thiếu từ khóa tìm kiếm (query).' });
        const products = await prisma.product.findMany({
          where: {
            workspaceId,
            name: {
              contains: query,
              mode: 'insensitive'
            }
          },
          take: 5
        });
        return JSON.stringify(products.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          currency: p.currency,
          description: p.description
        })));
      }
      
      case 'checkOrderStatus': {
        const orderNumber = args.orderNumber || '';
        if (!orderNumber) return JSON.stringify({ error: 'Thiếu mã đơn hàng (orderNumber).' });
        const order = await prisma.order.findFirst({
          where: {
            workspaceId,
            orderNumber: {
              equals: orderNumber.trim(),
              mode: 'insensitive'
            }
          },
          include: {
            customer: true,
            items: {
              include: {
                product: true
              }
            }
          }
        });
        if (!order) return JSON.stringify({ error: `Không tìm thấy đơn hàng ${orderNumber}.` });
        return JSON.stringify({
          orderNumber: order.orderNumber,
          customerName: order.customer.name,
          totalAmount: order.totalAmount,
          status: order.status,
          paymentMethod: order.paymentMethod,
          createdAt: order.createdAt,
          items: order.items.map(item => ({
            productName: item.product.name,
            quantity: item.quantity,
            price: item.price
          }))
        });
      }
      
      case 'checkCustomerOrders': {
        const query = args.query || '';
        if (!query) return JSON.stringify({ error: 'Thiếu thông tin khách hàng (email hoặc sđt).' });
        
        const customer = await prisma.customer.findFirst({
          where: {
            workspaceId,
            OR: [
              { email: { equals: query.trim().toLowerCase() } },
              { phone: { contains: query.trim() } }
            ]
          }
        });
        if (!customer) return JSON.stringify({ error: `Không tìm thấy khách hàng ứng với từ khóa: ${query}` });
        
        const orders = await prisma.order.findMany({
          where: {
            workspaceId,
            customerId: customer.id
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 5,
          include: {
            items: {
              include: {
                product: true
              }
            }
          }
        });
        
        return JSON.stringify({
          customer: {
            name: customer.name,
            email: customer.email,
            phone: customer.phone
          },
          orders: orders.map(o => ({
            orderNumber: o.orderNumber,
            totalAmount: o.totalAmount,
            status: o.status,
            createdAt: o.createdAt,
            items: o.items.map(item => ({
              productName: item.product.name,
              quantity: item.quantity,
              price: item.price
            }))
          }))
        });
      }

      case 'generateCheckoutLink': {
        const productIdStr = args.productId || '';
        const email = args.email || '';
        const name = args.name || '';
        
        if (!productIdStr) return JSON.stringify({ error: 'Thiếu mã sản phẩm (productId).' });
        const productId = parseInt(productIdStr, 10);
        if (isNaN(productId)) return JSON.stringify({ error: 'Mã sản phẩm (productId) không hợp lệ.' });
        
        // 1. Find product
        const product = await prisma.product.findUnique({
          where: { id: productId }
        });
        if (!product) return JSON.stringify({ error: `Không tìm thấy sản phẩm với ID ${productId}.` });
        
        // 2. Find or create Customer
        let customer = null;
        if (email.trim()) {
          customer = await prisma.customer.findFirst({
            where: { email: email.trim().toLowerCase(), workspaceId }
          });
          if (!customer) {
            customer = await prisma.customer.create({
              data: {
                workspaceId,
                email: email.trim().toLowerCase(),
                name: name.trim() || email.split('@')[0],
                status: 'NEW',
                trafficSource: 'CSKH Chatbot Sales'
              }
            });
          }
        } else if (sessionId) {
          const sess = await prisma.chatSession.findUnique({
            where: { id: sessionId },
            include: { customer: true }
          });
          if (sess?.customerId) {
            customer = sess.customer;
          }
        }
        
        if (!customer) {
          return JSON.stringify({
            error: "Vui lòng cung cấp email của bạn để em lập đơn hàng thanh toán nhé."
          });
        }
        
        // 3. Create Order
        const orderNumber = `ORD-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
        const order = await prisma.order.create({
          data: {
            orderNumber,
            customerId: customer.id,
            totalAmount: product.price,
            status: 'PENDING',
            paymentMethod: 'PAYOS',
            source: 'CHATBOT',
            workspaceId,
            items: {
              create: [
                {
                  productId: product.id,
                  quantity: 1,
                  price: product.price
                }
              ]
            }
          }
        });
        
        // 4. Generate payment link using Config
        const paymentConfig = await prisma.paymentConfig.findUnique({
          where: { workspaceId }
        });
        
        let checkoutUrl = '';
        let qrCode = '';
        
        if (paymentConfig?.payosClientId && paymentConfig?.payosApiKey && paymentConfig?.payosChecksumKey) {
          try {
            const PayOS = (await import('@payos/node')).default;
            const payos = new (PayOS as any)(paymentConfig.payosClientId, paymentConfig.payosApiKey, paymentConfig.payosChecksumKey);
            const orderCode = parseInt(orderNumber.replace(/[^\d]/g, '')) || Math.floor(100000 + Math.random() * 900000);
            const paymentData = {
              orderCode,
              amount: Math.round(product.price),
              description: `Checkout ${orderNumber}`.substring(0, 25),
              items: [{
                name: product.name.substring(0, 20),
                quantity: 1,
                price: Math.round(product.price)
              }],
              returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/success`,
              cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/cancel`
            };
            const paymentLinkRes = await payos.createPaymentLink(paymentData);
            checkoutUrl = paymentLinkRes.checkoutUrl;
            qrCode = paymentLinkRes.qrCode || '';
          } catch (err: any) {
            console.error('[cskhService] PayOS link creation failed, falling back:', err.message);
          }
        }
        
        if (!checkoutUrl && paymentConfig?.stripeSecretKey) {
          try {
            const Stripe = (await import('stripe')).default;
            const stripe = new Stripe(paymentConfig.stripeSecretKey, { apiVersion: '2023-10-16' as any });
            const stripeSession = await stripe.checkout.sessions.create({
              payment_method_types: ['card'],
              line_items: [{
                price_data: {
                  currency: product.currency.toLowerCase() || 'vnd',
                  product_data: { name: product.name },
                  unit_amount: Math.round(product.price),
                },
                quantity: 1,
              }],
              mode: 'payment',
              success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/success`,
              cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/cancel`,
              customer_email: customer.email
            });
            checkoutUrl = stripeSession.url || '';
          } catch (err: any) {
            console.error('[cskhService] Stripe link creation failed, falling back:', err.message);
          }
        }
        
        // Fallback: VietQR Bank Transfer
        if (!checkoutUrl) {
          const bankCode = paymentConfig?.sepayBankCode || 'MB';
          const accNumber = paymentConfig?.sepayAccountNumber || '0999999999';
          const accName = paymentConfig?.sepayAccountName || 'Be Traffic System';
          checkoutUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout?order=${orderNumber}`;
          qrCode = `https://img.vietqr.io/image/${bankCode}-${accNumber}-compact.png?amount=${product.price}&addInfo=${orderNumber}&accountName=${encodeURIComponent(accName)}`;
        }
        
        return JSON.stringify({
          orderNumber,
          productName: product.name,
          price: product.price,
          currency: product.currency,
          checkoutUrl,
          qrCode,
          message: `Em đã tạo đơn hàng ${orderNumber} cho sản phẩm ${product.name}. Quý khách có thể thanh toán trực tiếp qua link hoặc mã QR này.`
        });
      }
      
      default:
        return JSON.stringify({ error: `Không hỗ trợ công cụ: ${toolName}` });
    }
  } catch (err: any) {
    console.error(`Error executing tool ${toolName}:`, err);
    return JSON.stringify({ error: `Lỗi hệ thống khi thực thi công cụ: ${err.message || err}` });
  }
}

async function analyzeSentiment(
  message: string,
  apiKey: string,
  url: string,
  model: string,
  headers: Record<string, string>
): Promise<{ sentiment: 'HAPPY' | 'NEUTRAL' | 'FRUSTRATED' | 'ANGRY'; score: number; reason: string }> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `Bạn là trợ lý AI chuyên nghiệp phân tích cảm xúc tin nhắn của khách hàng bằng tiếng Việt.
Dựa trên nội dung tin nhắn, hãy xác định cảm xúc chính và chấm điểm cảm xúc của khách hàng.
Các nhóm cảm xúc gồm: "HAPPY" (vui vẻ, cảm ơn), "NEUTRAL" (bình thường, hỏi đáp thông thường), "FRUSTRATED" (khó chịu, sốt ruột), "ANGRY" (tức giận, mắng mỏ, khiếu nại).
Điểm số (score) nằm trong khoảng từ 0 (cực kỳ tức giận/thất vọng) đến 100 (cực kỳ vui vẻ/hài lòng). Tin nhắn bình thường trung tính có điểm khoảng 50.

Trả về duy nhất một đối tượng JSON hợp lệ không bao bọc bởi markdown block, ví dụ:
{"sentiment": "NEUTRAL", "score": 50, "reason": "Lý do ngắn gọn dưới 15 từ"}`
          },
          { role: 'user', content: `Nội dung tin nhắn: "${message}"` }
        ],
        temperature: 0.1,
        max_tokens: 150,
        response_format: { type: 'json_object' }
      }),
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const data = await response.json() as any;
      const resText = data.choices?.[0]?.message?.content?.trim();
      if (resText) {
        const result = JSON.parse(resText) as { sentiment: string; score: number; reason: string };
        const sentiment = (result.sentiment || 'NEUTRAL').toUpperCase() as 'HAPPY' | 'NEUTRAL' | 'FRUSTRATED' | 'ANGRY';
        return {
          sentiment: ['HAPPY', 'NEUTRAL', 'FRUSTRATED', 'ANGRY'].includes(sentiment) ? sentiment : 'NEUTRAL',
          score: result.score !== undefined ? Number(result.score) : 50,
          reason: result.reason || ''
        };
      }
    }
  } catch (err) {
    console.error('Lỗi khi phân tích cảm xúc tin nhắn:', err);
  }
  return { sentiment: 'NEUTRAL', score: 50, reason: 'Lỗi hệ thống' };
}

export async function handleVisitorMessage(
  workspaceId: number,
  sessionId: string | undefined,
  message: string,
  ipAddress?: string,
  userAgent?: string,
  imageUrl?: string
): Promise<{ sessionId: string; reply: string; customerId: number | null; references?: string[] }> {
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
  const visitorMsg = await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      sender: 'visitor',
      content: message,
      imageUrl: imageUrl || null,
    }
  });
  broadcastSocketMessage(workspaceId, session.id, visitorMsg);

  const ai = getAiConfig('/chat/completions', 'chatbot');

  // Check if visitor wants to talk to a human or expresses frustration
  let takeoverIntent = detectTakeoverIntent(message);
  let sentimentResult: { sentiment: 'HAPPY' | 'NEUTRAL' | 'FRUSTRATED' | 'ANGRY'; score: number; reason: string } = {
    sentiment: 'NEUTRAL',
    score: 50,
    reason: ''
  };

  if (ai.apiKey) {
    try {
      sentimentResult = await analyzeSentiment(message, ai.apiKey, ai.url, ai.model, ai.headers);
      console.log(`[Sentiment Analysis] Message: "${message}" -> Sentiment: ${sentimentResult.sentiment} (Score: ${sentimentResult.score})`);
      if (sentimentResult.sentiment === 'ANGRY' || (sentimentResult.sentiment === 'FRUSTRATED' && sentimentResult.score < 40)) {
        takeoverIntent = true;
      }
    } catch (sentErr) {
      console.error('Lỗi phân tích cảm xúc:', sentErr);
    }
  }

  if (takeoverIntent) {
    // Activate agent takeover by creating a system/agent message
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        sender: 'agent',
        content: `[AI Auto-Takeover]: Khách hàng yêu cầu hỗ trợ trực tiếp hoặc phản hồi khẩn cấp. Cảm xúc: ${sentimentResult.sentiment} (${sentimentResult.score}/100) - ${sentimentResult.reason || 'N/A'}`,
      }
    });

    // Send Telegram urgent alert
    const customerInfo = session.customerId 
      ? await prisma.customer.findUnique({ where: { id: session.customerId } })
      : null;
    const name = customerInfo?.name || 'Khách truy cập';
    const email = customerInfo?.email || 'Chưa cung cấp';
    const phone = customerInfo?.phone || 'Chưa cung cấp';
    
    // Ghi nhận cảnh báo khẩn cấp lên Dashboard Alert Logs
    try {
      let liveChatRule = await prisma.alertRule.findFirst({
        where: { workspaceId, name: 'Hệ thống Live Chat' }
      });
      if (!liveChatRule) {
        liveChatRule = await prisma.alertRule.create({
          data: {
            name: 'Hệ thống Live Chat',
            metric: 'live_chat_takeover',
            threshold: 1,
            comparison: 'gt',
            workspaceId,
            enabled: true,
          }
        });
      }
      await prisma.alertLog.create({
        data: {
          ruleId: liveChatRule.id,
          message: `🚨 KHẨN CẤP: Khách hàng "${name}" yêu cầu hỗ trợ trực tiếp! Tin nhắn: "${message}". Cảm xúc: ${sentimentResult.sentiment} (Score: ${sentimentResult.score})`,
          severity: 'CRITICAL'
        }
      });
    } catch (dbErr) {
      console.error('[AlertLogs] Lỗi ghi nhận cảnh báo lên Dashboard:', dbErr);
    }

    // Đọc cấu hình thông báo khẩn cấp
    const cskhConfig = await prisma.cskhConfig.findUnique({
      where: { workspaceId }
    });
    const channels = (cskhConfig?.notificationChannels || 'email,telegram')
      .split(',')
      .map(c => c.trim().toLowerCase())
      .filter(Boolean);

    // Gửi Telegram Alert
    if (channels.includes('telegram')) {
      const sentimentEmoji = sentimentResult.sentiment === 'ANGRY' ? '😡 Cực kỳ giận dữ' :
                             sentimentResult.sentiment === 'FRUSTRATED' ? '😟 Khó chịu/Sốt ruột' :
                             sentimentResult.sentiment === 'HAPPY' ? '😊 Vui vẻ/Hài lòng' : '😐 Bình thường';
      const alertMsg = `🚨 <b>KHẨN CẤP: Khách hàng cần hỗ trợ trực tiếp!</b>\n\n` +
        `• <b>Khách hàng:</b> ${name}\n` +
        `• <b>Email:</b> ${email}\n` +
        `• <b>SĐT:</b> ${phone}\n` +
        `• <b>Cảm xúc phát hiện:</b> ${sentimentEmoji} (Điểm: ${sentimentResult.score}/100)\n` +
        `• <b>Lý do cảm xúc:</b> <i>"${sentimentResult.reason || 'N/A'}"</i>\n` +
        `• <b>Nội dung tin nhắn:</b> <i>"${message}"</i>\n\n` +
        `<i>AI đã tự động tạm dừng chatbot trong 30 phút. Vui lòng vào mục CSKH để hỗ trợ khách hàng ngay!</i>`;
      
      void sendTelegramAlert(workspaceId, alertMsg);
    }

    // Gửi Email Alert
    if (channels.includes('email')) {
      const emailSubject = `🚨 [Khẩn cấp] Khách hàng ${name} yêu cầu hỗ trợ trực tiếp!`;
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const emailHtml = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ffccd5; border-radius: 12px; background-color: #fff5f6; max-width: 600px;">
          <h2 style="color: #d90429; margin-top: 0;">🚨 Khách hàng yêu cầu hỗ trợ trực tiếp!</h2>
          <p>Hệ thống AI Chatbot đã tự động phát hiện ý định khẩn cấp và tạm dừng chatbot trong 30 phút để chuyên viên tiếp quản.</p>
          <hr style="border: 0; border-top: 1px solid #ffccd5; margin: 20px 0;">
          <table style="width: 100%; text-align: left; font-size: 14px;">
            <tr>
              <th style="padding: 5px 0; width: 120px;">Khách hàng:</th>
              <td style="padding: 5px 0;"><strong>${name}</strong></td>
            </tr>
            <tr>
              <th style="padding: 5px 0;">Email:</th>
              <td style="padding: 5px 0;">${email}</td>
            </tr>
            <tr>
              <th style="padding: 5px 0;">Số điện thoại:</th>
              <td style="padding: 5px 0;">${phone}</td>
            </tr>
            <tr>
              <th style="padding: 5px 0; vertical-align: top;">Tin nhắn cuối:</th>
              <td style="padding: 5px 0; background-color: #fff; padding: 10px; border-radius: 6px; border: 1px solid #ffccd5; font-style: italic;">"${message}"</td>
            </tr>
          </table>
          <div style="margin-top: 25px; text-align: center;">
            <a href="${frontendUrl}/dashboard/cskh/settings" style="background-color: #d90429; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; display: inline-block;">Truy cập Live Chat ngay</a>
          </div>
        </div>
      `;
      void sendEmailAlert(workspaceId, emailSubject, emailHtml);
    }

    // Save bot response
    const replyText = 'Dạ em đã ghi nhận yêu cầu của anh/chị và chuyển tiếp ngay đến chuyên viên tư vấn hỗ trợ trực tiếp. Chuyên viên sẽ phản hồi lại anh/chị ngay trong giây lát ạ!';
    const botMsg = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        sender: 'bot',
        content: replyText,
      }
    });
    broadcastSocketMessage(workspaceId, session.id, botMsg);

    return {
      sessionId: session.id,
      reply: replyText,
      customerId: session.customerId,
    };
  }

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

      const messagesForAi = history.map(msg => {
        const role = msg.sender === 'visitor' ? 'user' as const : 'assistant' as const;
        if (msg.imageUrl && role === 'user') {
          const base64Url = getBase64ImageUrl(msg.imageUrl);
          if (base64Url) {
            return {
              role,
              content: [
                { type: 'text', text: msg.content || 'Hãy xem hình ảnh này.' },
                { type: 'image_url', image_url: { url: base64Url } }
              ] as any
            };
          }
        }
        return {
          role,
          content: msg.content,
        };
      });

      const defaultKb = `Be Traffic (Growth OS) là một nền tảng tối ưu hóa traffic và bán hàng tự động All-in-One.
Các tính năng và dịch vụ chính:
1. Đăng bài đa kênh tự động: Lên lịch và xuất bản bài đăng lên Facebook, Zalo, YouTube.
2. SEO Tools: Quét và chấm điểm SEO website (SEO Onpage Auditor), quét và kiểm tra chất lượng backlink.
3. Landing Page & Visual Builder: Thiết kế kéo thả trang đích trực quan không cần code, chèn tracking pixel.
4. Custom Forms & CRM: Thiết kế biểu mẫu thu thập Leads đăng ký, lưu trữ và chăm sóc khách hàng tập trung.
5. Email Drip Campaign: Thiết lập chuỗi email tự động gửi bám đuổi chăm sóc khách hàng.
6. CSKH AI & Chatbot: Hỗ trợ live chat trực tuyến, tự động ghi nhận lead (Email, SĐT) và cảnh báo về Telegram, tự động follow-up sau khi chat kết thúc.
7. Thanh toán đối soát tự động: Tích hợp cổng PayOS VietQR và Stripe quốc tế để nâng hạng khách hàng khi thanh toán thành công.`;

      // RAG Động qua pgvector (Neon Postgres), tự động fallback sang text-matching nếu không có dữ liệu/lỗi
      let structuredChunks: { content: string; source: string; sourceId: number | null }[] = [];
      let relevantChunks: string[] = [];

      let kbTextCombined = kbText;
      try {
        const completedSources = await prisma.knowledgeSource.findMany({
          where: { workspaceId, status: 'COMPLETED' }
        });
        for (const src of completedSources) {
          if (src.extractedText) {
            kbTextCombined += `\n\n--- [Nguồn tài liệu: ${src.name}] ---\n` + src.extractedText;
          }
        }
      } catch (srcErr) {
        console.error('[cskhService] Lỗi đọc các nguồn tri thức bổ sung:', srcErr);
      }

      if (kbTextCombined) {
        try {
          const { retrieveRelevantChunksStructured } = await import('../lib/embeddings');
          structuredChunks = await retrieveRelevantChunksStructured(workspaceId, message, 5);
          relevantChunks = structuredChunks.map(s => `[Nguồn: ${s.source}]\n${s.content}`);
        } catch (err) {
          console.warn('[cskhService] Lỗi khi sử dụng pgvector RAG, tự động chuyển sang fallback:', err);
        }
        
        if (relevantChunks.length === 0) {
          relevantChunks = retrieveRelevantChunks(kbTextCombined, message, 5);
        }
      }
      
      const effectiveKb = relevantChunks.length > 0 
        ? `${relevantChunks.join('\n\n')}\n\nThông tin thêm về hệ thống:\n${defaultKb}` 
        : defaultKb;

      const systemPrompt = `Bạn là chatbot chăm sóc khách hàng tự động thông minh bằng tiếng Việt của chúng tôi.
Dưới đây là tri thức của hệ thống (Knowledge Base):
---
${effectiveKb}
---

Bạn cũng được cung cấp một số công cụ (Tools) dạng thẻ XML để truy vấn thông tin thực tế từ hệ thống. Khi khách hàng hỏi về thông tin sản phẩm, muốn mua hàng hoặc kiểm tra đơn hàng, bạn BẮT BUỘC phải gọi công cụ này để lấy thông tin chính xác thay vì tự bịa ra thông tin.

Các công cụ sẵn có:
1. Tìm kiếm sản phẩm:
   Cú pháp: <call:searchProducts query="tên sản phẩm" />
   Ví dụ: <call:searchProducts query="áo thun" />
2. Kiểm tra trạng thái đơn hàng cụ thể bằng mã đơn hàng:
   Cú pháp: <call:checkOrderStatus orderNumber="mã đơn hàng" />
   Ví dụ: <call:checkOrderStatus orderNumber="ORD-12345" />
3. Kiểm tra danh sách đơn hàng của khách hàng bằng Email hoặc Số điện thoại:
   Cú pháp: <call:checkCustomerOrders query="email hoặc số điện thoại" />
   Ví dụ: <call:checkCustomerOrders query="0987654321" /> hoặc <call:checkCustomerOrders query="khachhang@gmail.com" />
4. Tạo liên kết thanh toán và lập đơn hàng cho sản phẩm:
   Cú pháp: <call:generateCheckoutLink productId="mã sản phẩm" email="email khách hàng" name="tên khách hàng" />
   Ví dụ: <call:generateCheckoutLink productId="5" email="customer@gmail.com" name="Nguyễn Văn A" />
   * Lưu ý quan trọng: Khi khách hàng đồng ý mua một sản phẩm cụ thể, bạn CẦN gọi công cụ này. Nếu khách hàng chưa từng cung cấp email trong lịch sử trò chuyện, hãy lịch sự hỏi xin địa chỉ email của họ trước tiên để tiến hành khởi tạo đơn hàng.

Quy trình sử dụng công cụ:
- Khi nhận được tin nhắn cần thông tin đơn hàng/sản phẩm hoặc khi khách đồng ý chốt đơn, hãy viết thẻ <call:toolName param="value" /> tương ứng trong phản hồi. Hãy kết thúc câu trả lời ngay sau khi gọi công cụ để hệ thống xử lý.
- Sau khi hệ thống trả về kết quả truy vấn, bạn sẽ nhận được thông tin. Lúc này, hãy sử dụng kết quả đó để trả lời khách hàng một cách tự nhiên và chính xác nhất.
- Tuyệt đối không tự bịa đặt mã đơn hàng, sản phẩm hoặc thông tin trạng thái đơn hàng nếu chưa gọi công cụ và nhận được kết quả.
- Khi trả lời khách hàng, hãy trả lời bằng tiếng Việt thân thiện, rõ ràng. Không lặp lại thẻ gọi công cụ nếu đã có kết quả.

Nhiệm vụ của bạn:
1. Trả lời câu hỏi của khách hàng dựa trên thông tin Tri thức hoặc kết quả trả về của các công cụ một cách lịch sự, thân thiện và chuyên nghiệp.
2. Chủ động tư vấn, giới thiệu và đề xuất sản phẩm phù hợp khi khách hàng tìm hiểu giải pháp. Hướng dẫn khách chốt đơn và gửi link thanh toán/mã QR để hoàn tất mua hàng.
3. Tránh việc chào hỏi lặp lại nhiều lần nếu khách đã ở trong cuộc hội thoại.
4. Chỉ trả lời dựa trên Tri thức được cung cấp. Nếu thông tin không có trong Tri thức và không thể truy vấn qua công cụ, bạn KHÔNG tự ý bịa đặt thông tin. Thay vào đó, hãy lịch sự đề xuất khách hàng để lại Email hoặc Số điện thoại để chuyên viên của chúng tôi liên hệ hỗ trợ trực tiếp.
5. Luôn giữ thái độ phục vụ chu đáo, xưng hô phù hợp (ví dụ: dạ, em, mình, quý khách).
6. Hãy viết câu trả lời ngắn gọn, rõ ràng, tập trung vào câu hỏi của khách.`;

      let loopCount = 0;
      const maxLoops = 3;
      let finished = false;

      while (loopCount < maxLoops && !finished) {
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
        }, 2, 1200, workspaceId, 'chatbot');

        // Fallback model if primary failed (e.g. rate limit 429 or 502)
        if (!response.ok && ai.apiKey.startsWith('sk-or-')) {
          console.warn(`[cskhChat] Primary model ${ai.model} failed (${response.status}). Trying fallback Llama...`);
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
          }, 2, 1200, workspaceId, 'chatbot');
        }

        if (response.ok) {
          const data = await response.json() as {
            choices?: { message?: { content?: string } }[];
          };
          const generated = data.choices?.[0]?.message?.content?.trim();
          if (generated) {
            console.log(`[ReAct Loop ${loopCount}] LLM Output:`, generated);
            const toolCalls = parseToolCalls(generated);
            if (toolCalls.length > 0) {
              messagesForAi.push({
                role: 'assistant' as const,
                content: generated
              });

              const results: string[] = [];
              for (const call of toolCalls) {
                const result = await executeTool(workspaceId, call.toolName, call.args, session.id);
                results.push(`[Kết quả ${call.toolName}]: ${result}`);
              }

              const toolResponseText = results.join('\n');
              messagesForAi.push({
                role: 'user' as const,
                content: `Hệ thống trả về thông tin truy vấn sau đây cho các công cụ bạn vừa gọi:\n${toolResponseText}\nHãy dựa vào dữ liệu thực tế này để trả lời cho khách hàng. Không lặp lại các thẻ <call:... /> đã chạy.`
              });

              loopCount++;
            } else {
              replyText = cleanReplyText(generated);
              finished = true;
            }
          } else {
            finished = true;
          }
        } else {
          const errorText = await response.text();
          console.error('OpenAI API error in CSKH:', response.status, errorText);
          finished = true;
        }
      }
    } catch (err) {
      console.error('Lỗi khi gọi OpenAI Chatbot CSKH:', err);
    }
  }

  // Save bot response
  const botMsg = await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      sender: 'bot',
      content: replyText,
    }
  });
  broadcastSocketMessage(workspaceId, session.id, botMsg);

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

      // Kích hoạt gửi email chào mừng cho khách hàng mới từ chatbot
      const { triggerEmailEvent } = await import('./emailEventTrigger');
      void triggerEmailEvent('WELCOME', {
        customerId: customer.id,
        workspaceId
      }).catch(e => console.error('Error triggering welcome email from chatbot:', e));

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

  let references: string[] = [];
  const citationMatch = replyText.match(/\*\(Tham khảo từ:\s*([^\)]+)\)\*/);
  if (citationMatch) {
    references = citationMatch[1].split(',').map(s => s.trim()).filter(Boolean);
  }

  return {
    sessionId: session.id,
    reply: replyText,
    customerId,
    references,
  };
}
