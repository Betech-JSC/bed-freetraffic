"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const workspace_1 = require("../middleware/workspace");
const node_1 = __importDefault(require("@payos/node"));
const stripe_1 = __importDefault(require("stripe"));
const router = (0, express_1.Router)();
// Load Payment Config
router.get('/config', auth_1.authenticate, workspace_1.workspaceMiddleware, async (req, res) => {
    try {
        let config = await prisma_1.default.paymentConfig.findUnique({
            where: { workspaceId: req.workspaceId },
        });
        if (!config) {
            config = await prisma_1.default.paymentConfig.create({
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
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi lấy cấu hình thanh toán' });
    }
});
// Save Payment Config
router.post('/config', auth_1.authenticate, workspace_1.workspaceMiddleware, auth_1.requireWrite, async (req, res) => {
    try {
        const { payosClientId, payosApiKey, payosChecksumKey, stripeSecretKey, stripeWebhookSecret } = req.body;
        // Find existing config
        const existing = await prisma_1.default.paymentConfig.findUnique({
            where: { workspaceId: req.workspaceId },
        });
        const data = {};
        if (payosClientId !== undefined && payosClientId !== '***')
            data.payosClientId = payosClientId;
        if (payosApiKey !== undefined && payosApiKey !== '***')
            data.payosApiKey = payosApiKey;
        if (payosChecksumKey !== undefined && payosChecksumKey !== '***')
            data.payosChecksumKey = payosChecksumKey;
        if (stripeSecretKey !== undefined && stripeSecretKey !== '***')
            data.stripeSecretKey = stripeSecretKey;
        if (stripeWebhookSecret !== undefined && stripeWebhookSecret !== '***')
            data.stripeWebhookSecret = stripeWebhookSecret;
        let config;
        if (existing) {
            config = await prisma_1.default.paymentConfig.update({
                where: { id: existing.id },
                data,
            });
        }
        else {
            config = await prisma_1.default.paymentConfig.create({
                data: {
                    workspaceId: req.workspaceId,
                    ...data,
                },
            });
        }
        res.json({ success: true, message: 'Lưu cấu hình thành công' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi lưu cấu hình thanh toán' });
    }
});
// Create PayOS Payment Link
router.post('/payos-link', auth_1.authenticate, workspace_1.workspaceMiddleware, auth_1.requireWrite, async (req, res) => {
    try {
        const { orderId, returnUrl, cancelUrl } = req.body;
        if (!orderId) {
            res.status(400).json({ error: 'orderId là bắt buộc' });
            return;
        }
        // Load PayOS Config for this workspace
        const config = await prisma_1.default.paymentConfig.findUnique({
            where: { workspaceId: req.workspaceId },
        });
        if (!config || !config.payosClientId || !config.payosApiKey || !config.payosChecksumKey) {
            res.status(400).json({ error: 'Cấu hình PayOS chưa được hoàn tất trong Workspace này.' });
            return;
        }
        // Load Order details
        const order = await prisma_1.default.order.findFirst({
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
        const payos = new node_1.default(config.payosClientId, config.payosApiKey, config.payosChecksumKey);
        const paymentData = {
            orderCode,
            amount: Math.round(order.totalAmount),
            description: `Thanh toan don hang ${order.orderNumber}`.substring(0, 25), // PayOS max 25 chars for description
            items: order.items.map((item) => ({
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
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi khi tạo liên kết thanh toán PayOS' });
    }
});
// PayOS Webhook (Public, unauthenticated)
router.post('/payos-webhook', async (req, res) => {
    try {
        const webhookData = req.body;
        if (!webhookData || !webhookData.data) {
            res.status(400).json({ error: 'Dữ liệu webhook không hợp lệ' });
            return;
        }
        const orderCode = webhookData.data.orderCode;
        const signature = webhookData.signature;
        // Find the order
        const order = await prisma_1.default.order.findFirst({
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
        const config = await prisma_1.default.paymentConfig.findUnique({
            where: { workspaceId: order.workspaceId },
        });
        if (!config || !config.payosChecksumKey) {
            res.status(400).json({ error: 'Cấu hình PayOS không hợp lệ cho Workspace này.' });
            return;
        }
        // Verify webhook signature
        const payos = new node_1.default(config.payosClientId || '', config.payosApiKey || '', config.payosChecksumKey);
        try {
            payos.verifyPaymentWebhookData(webhookData);
        }
        catch (verifyError) {
            res.status(400).json({ error: 'Chữ ký webhook PayOS không hợp lệ' });
            return;
        }
        // Process successful payment
        if (webhookData.success || webhookData.desc === 'success') {
            await prisma_1.default.order.update({
                where: { id: order.id },
                data: {
                    status: 'PAID',
                    paymentMethod: 'PAYOS',
                    gatewayTxnId: webhookData.data.reference || String(webhookData.data.paymentLinkId),
                },
            });
            // Update customer CRM status to ACTIVE
            await prisma_1.default.customer.update({
                where: { id: order.customerId },
                data: { status: 'ACTIVE' },
            });
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi xử lý webhook PayOS' });
    }
});
// Stripe Webhook (Public, unauthenticated)
router.post('/stripe-webhook', async (req, res) => {
    try {
        const signature = req.headers['stripe-signature'];
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
        const order = await prisma_1.default.order.findUnique({
            where: { orderNumber },
        });
        if (!order || !order.workspaceId) {
            res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
            return;
        }
        const config = await prisma_1.default.paymentConfig.findUnique({
            where: { workspaceId: order.workspaceId },
        });
        if (!config || !config.stripeWebhookSecret) {
            res.status(400).json({ error: 'Cấu hình Stripe Webhook Secret trống.' });
            return;
        }
        // Verify webhook signature using Stripe SDK
        let event;
        try {
            const stripe = new stripe_1.default(config.stripeSecretKey || '');
            // For proper verification, req.body should be the raw body string.
            // When using express.json(), body is already parsed, so we stringify it back.
            const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
            event = stripe.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
        }
        catch (err) {
            console.error('[Stripe Webhook] Signature verification failed:', err.message);
            res.status(400).json({ error: 'Xác minh chữ ký Stripe webhook thất bại: ' + err.message });
            return;
        }
        // Process verified event
        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object;
            await prisma_1.default.order.update({
                where: { id: order.id },
                data: {
                    status: 'PAID',
                    paymentMethod: 'STRIPE',
                    gatewayTxnId: paymentIntent.id,
                },
            });
            await prisma_1.default.customer.update({
                where: { id: order.customerId },
                data: { status: 'ACTIVE' },
            });
        }
        res.json({ received: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Lỗi xử lý webhook Stripe' });
    }
});
exports.default = router;
