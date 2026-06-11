import { Router, Response, Request } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, requireWrite } from '../middleware/auth';
import { workspaceMiddleware, WorkspaceRequest } from '../middleware/workspace';
import PayOS from '@payos/node';
import Stripe from 'stripe';
import crypto from 'crypto';
import { logActivity } from '../lib/auditLogger';

const router = Router();

// Load Payment Config
router.get('/config', authenticate, workspaceMiddleware, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    let config = await prisma.paymentConfig.findUnique({
      where: { workspaceId: req.workspaceId },
    });
    if (!config) {
      config = await prisma.paymentConfig.create({
        data: { workspaceId: req.workspaceId },
      });
    }
    // Return config with sensitive keys partially masked for security
    res.json({
      id: config.id,
      payosClientId: config.payosClientId ? '***' + config.payosClientId.slice(-4) : '',
      payosApiKey: config.payosApiKey ? '***' : '',
      payosChecksumKey: config.payosChecksumKey ? '***' : '',
      stripeSecretKey: config.stripeSecretKey ? '***' : '',
      stripeWebhookSecret: config.stripeWebhookSecret ? '***' : '',
      sepayBankCode: config.sepayBankCode || '',
      sepayAccountNumber: config.sepayAccountNumber || '',
      sepayAccountName: config.sepayAccountName || '',
      sepayApikey: config.sepayApikey ? '***' : '',
      sepayWebhookSecret: config.sepayWebhookSecret ? '***' : '',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lấy cấu hình thanh toán' });
  }
});

// Save Payment Config
router.post('/config', authenticate, workspaceMiddleware, requireWrite, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const { 
      payosClientId, 
      payosApiKey, 
      payosChecksumKey, 
      stripeSecretKey, 
      stripeWebhookSecret,
      sepayBankCode,
      sepayAccountNumber,
      sepayAccountName,
      sepayApikey,
      sepayWebhookSecret
    } = req.body;
    
    // Find existing config
    const existing = await prisma.paymentConfig.findUnique({
      where: { workspaceId: req.workspaceId },
    });

    const data: any = {};
    if (payosClientId !== undefined && payosClientId !== '***') data.payosClientId = payosClientId;
    if (payosApiKey !== undefined && payosApiKey !== '***') data.payosApiKey = payosApiKey;
    if (payosChecksumKey !== undefined && payosChecksumKey !== '***') data.payosChecksumKey = payosChecksumKey;
    if (stripeSecretKey !== undefined && stripeSecretKey !== '***') data.stripeSecretKey = stripeSecretKey;
    if (stripeWebhookSecret !== undefined && stripeWebhookSecret !== '***') data.stripeWebhookSecret = stripeWebhookSecret;
    if (sepayBankCode !== undefined) data.sepayBankCode = sepayBankCode;
    if (sepayAccountNumber !== undefined) data.sepayAccountNumber = sepayAccountNumber;
    if (sepayAccountName !== undefined) data.sepayAccountName = sepayAccountName;
    if (sepayApikey !== undefined && sepayApikey !== '***') data.sepayApikey = sepayApikey;
    if (sepayWebhookSecret !== undefined && sepayWebhookSecret !== '***') data.sepayWebhookSecret = sepayWebhookSecret;

    let config;
    if (existing) {
      config = await prisma.paymentConfig.update({
        where: { id: existing.id },
        data,
      });
    } else {
      config = await prisma.paymentConfig.create({
        data: {
          workspaceId: req.workspaceId,
          ...data,
        },
      });
    }

    // Ghi audit log
    await logActivity({
      userId: req.user!.userId,
      workspaceId: req.workspaceId!,
      action: 'UPDATE_GATEWAY_CONFIG',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        updatedFields: Object.keys(data)
      }
    });

    res.json({ success: true, message: 'Lưu cấu hình thành công' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi lưu cấu hình thanh toán' });
  }
});

// Create PayOS Payment Link
router.post('/payos-link', authenticate, workspaceMiddleware, requireWrite, async (req: WorkspaceRequest, res: Response): Promise<void> => {
  try {
    const { orderId, returnUrl, cancelUrl } = req.body;
    if (!orderId) {
      res.status(400).json({ error: 'orderId là bắt buộc' });
      return;
    }

    // Load PayOS Config for this workspace
    const config = await prisma.paymentConfig.findUnique({
      where: { workspaceId: req.workspaceId },
    });

    if (!config || !config.payosClientId || !config.payosApiKey || !config.payosChecksumKey) {
      res.status(400).json({ error: 'Cấu hình PayOS chưa được hoàn tất trong Workspace này.' });
      return;
    }

    // Load Order details
    const order = await prisma.order.findFirst({
      where: { id: parseInt(orderId), workspaceId: req.workspaceId },
      include: { customer: true, items: { include: { product: true } } },
    });

    if (!order) {
      res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
      return;
    }

    // PayOS requires numeric order code
    // Let's generate a numeric code based on order.id or parse existing orderNumber
    const orderCode = parseInt(order.orderNumber.replace(/[^\d]/g, '')) || Math.floor(100000 + Math.random() * 900000);

    const payos = new (PayOS as any)(config.payosClientId, config.payosApiKey, config.payosChecksumKey);

    const paymentData = {
      orderCode,
      amount: Math.round(order.totalAmount),
      description: `Thanh toan don hang ${order.orderNumber}`.substring(0, 25), // PayOS max 25 chars for description
      items: order.items.map((item: any) => ({
        name: item.product.name.substring(0, 20),
        quantity: item.quantity,
        price: Math.round(item.price),
      })),
      returnUrl: returnUrl || 'http://localhost:3000/checkout/success',
      cancelUrl: cancelUrl || 'http://localhost:3000/checkout/cancel',
    };

    const paymentLinkRes = await payos.createPaymentLink(paymentData);

    res.json({
      success: true,
      paymentLink: paymentLinkRes.checkoutUrl,
      qrCode: paymentLinkRes.qrCode,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi khi tạo liên kết thanh toán PayOS' });
  }
});

// PayOS Webhook (Public, unauthenticated)
router.post('/payos-webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const webhookData = req.body;
    if (!webhookData || !webhookData.data) {
      res.status(400).json({ error: 'Dữ liệu webhook không hợp lệ' });
      return;
    }

    const orderCode = webhookData.data.orderCode;
    const signature = webhookData.signature;

    // Find the order
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { orderNumber: `BT-${orderCode}` },
          { orderNumber: { endsWith: String(orderCode) } }
        ]
      },
      include: { workspace: true }
    });

    if (!order || !order.workspaceId) {
      res.status(404).json({ error: 'Không tìm thấy đơn hàng tương ứng với orderCode.' });
      return;
    }

    const config = await prisma.paymentConfig.findUnique({
      where: { workspaceId: order.workspaceId },
    });

    if (!config || !config.payosChecksumKey) {
      res.status(400).json({ error: 'Cấu hình PayOS không hợp lệ cho Workspace này.' });
      return;
    }

    // Verify webhook signature
    const payos = new (PayOS as any)(config.payosClientId || '', config.payosApiKey || '', config.payosChecksumKey);
    try {
      payos.verifyPaymentWebhookData(webhookData);
    } catch (verifyError) {
      res.status(400).json({ error: 'Chữ ký webhook PayOS không hợp lệ' });
      return;
    }

    // Process successful payment
    if (webhookData.success || webhookData.desc === 'success') {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          paymentMethod: 'PAYOS',
          gatewayTxnId: webhookData.data.reference || String(webhookData.data.paymentLinkId),
        },
      });

      // Update customer CRM status to ACTIVE
      await prisma.customer.update({
        where: { id: order.customerId },
        data: { status: 'ACTIVE' },
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi xử lý webhook PayOS' });
  }
});

// Stripe Webhook (Public, unauthenticated)
router.post('/stripe-webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      res.status(400).json({ error: 'Thiếu stripe-signature' });
      return;
    }

    const payload = req.body;
    const orderNumber = payload?.data?.object?.metadata?.orderNumber;
    if (!orderNumber) {
      res.status(400).json({ error: 'Thiếu orderNumber trong metadata Stripe' });
      return;
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber },
    });

    if (!order || !order.workspaceId) {
      res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
      return;
    }

    const config = await prisma.paymentConfig.findUnique({
      where: { workspaceId: order.workspaceId },
    });

    if (!config || !config.stripeWebhookSecret) {
      res.status(400).json({ error: 'Cấu hình Stripe Webhook Secret trống.' });
      return;
    }

    // Verify webhook signature using Stripe SDK
    let event: any;
    try {
      const stripe = new Stripe(config.stripeSecretKey || '');
      // For proper verification, req.body should be the raw body string.
      // When using express.json(), body is already parsed, so we stringify it back.
      const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
      event = stripe.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
    } catch (err: any) {
      console.error('[Stripe Webhook] Signature verification failed:', err.message);
      res.status(400).json({ error: 'Xác minh chữ ký Stripe webhook thất bại: ' + err.message });
      return;
    }

    // Process verified event
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as any;
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          paymentMethod: 'STRIPE',
          gatewayTxnId: paymentIntent.id,
        },
      });

      await prisma.customer.update({
        where: { id: order.customerId },
        data: { status: 'ACTIVE' },
      });
    }

    res.json({ received: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Lỗi xử lý webhook Stripe' });
  }
});

// SePay Webhook (Public, unauthenticated)
router.post('/sepay-webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const transaction = req.body;
    if (!transaction || !transaction.content) {
      res.status(400).json({ error: 'Dữ liệu giao dịch không hợp lệ' });
      return;
    }

    const { content, transferAmount, referenceCode } = transaction;

    // 1. Extract order number (BT-xxxxxx) from transfer content
    const match = /BT-\d{6}/i.exec(content);
    if (!match) {
      console.log(`[SePay Webhook] Không tìm thấy mã đơn hàng BT-xxxxxx trong nội dung: "${content}"`);
      res.status(200).json({ success: false, message: 'Nội dung chuyển khoản không chứa mã đơn hàng.' });
      return;
    }

    const orderNumber = match[0].toUpperCase();

    // 2. Find the order in database
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: { workspace: true }
    });

    if (!order || !order.workspaceId) {
      console.warn(`[SePay Webhook] Không tìm thấy đơn hàng: ${orderNumber}`);
      res.status(404).json({ error: `Không tìm thấy đơn hàng tương ứng với mã ${orderNumber}` });
      return;
    }

    // 3. Load Payment Config for the workspace
    const config = await prisma.paymentConfig.findUnique({
      where: { workspaceId: order.workspaceId },
    });

    if (!config) {
      res.status(400).json({ error: 'Cấu hình thanh toán không tồn tại cho Workspace này.' });
      return;
    }

    // 4. Verify signature (HMAC-SHA256 or API Key)
    const signature = req.headers['x-sepay-signature'] as string;
    const timestamp = req.headers['x-sepay-timestamp'] as string;
    const authHeader = req.headers['authorization'];

    if (config.sepayWebhookSecret && signature && timestamp) {
      // HMAC-SHA256 signature verification
      const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(transaction));
      const hmac = crypto.createHmac('sha256', config.sepayWebhookSecret);
      const dataToSign = Buffer.concat([
        Buffer.from(`${timestamp}.`),
        rawBody instanceof Buffer ? rawBody : Buffer.from(rawBody)
      ]);
      const calculatedDigest = hmac.update(dataToSign).digest('hex');
      const receivedSignature = signature.replace('sha256=', '');

      if (calculatedDigest !== receivedSignature) {
        console.error(`[SePay Webhook] Sai chữ ký HMAC. Nhận: ${receivedSignature}, Tính: ${calculatedDigest}`);
        res.status(401).json({ error: 'Chữ ký webhook SePay không hợp lệ.' });
        return;
      }
    } else if (config.sepayApikey) {
      // Authorization key verification
      const expectedKey = config.sepayApikey;
      const receivedKey = authHeader ? authHeader.replace(/^(Bearer|Apikey)\s+/i, '') : null;
      if (receivedKey !== expectedKey) {
        console.error(`[SePay Webhook] Sai API Key xác thực.`);
        res.status(401).json({ error: 'API Key SePay không hợp lệ.' });
        return;
      }
    } else {
      console.warn(`[SePay Webhook] Chấp nhận webhook không có xác thực vì Workspace chưa cấu hình Secret Key/API Key.`);
    }

    // 5. Verify transferAmount matches order amount
    const expectedAmount = Math.round(order.totalAmount);
    const actualAmount = Math.round(Number(transferAmount));

    if (actualAmount < expectedAmount) {
      console.warn(`[SePay Webhook] Số tiền thanh toán (${actualAmount}) nhỏ hơn số tiền đơn hàng (${expectedAmount}).`);
      res.status(400).json({ error: 'Số tiền thanh toán không đủ.' });
      return;
    }

    // 6. Process payment
    if (order.status !== 'PAID') {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          paymentMethod: 'SEPAY',
          gatewayTxnId: referenceCode || String(transaction.id),
        },
      });

      // Update customer CRM status to ACTIVE
      await prisma.customer.update({
        where: { id: order.customerId },
        data: { status: 'ACTIVE' },
      });

      console.log(`[SePay Webhook] Đơn hàng ${orderNumber} đã thanh toán thành công qua SePay! Số tiền: ${actualAmount}`);
    } else {
      console.log(`[SePay Webhook] Đơn hàng ${orderNumber} đã ở trạng thái ĐÃ THANH TOÁN (PAID) trước đó.`);
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[SePay Webhook Error]:', error);
    res.status(500).json({ error: error.message || 'Lỗi xử lý webhook SePay' });
  }
});

export default router;
