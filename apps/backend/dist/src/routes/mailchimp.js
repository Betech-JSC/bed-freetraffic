"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../middleware/auth");
const mailchimpService_1 = require("../services/mailchimpService");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// 1. Get all lists (audiences)
router.get('/lists', async (req, res) => {
    try {
        const lists = await (0, mailchimpService_1.getMailchimpLists)(req.workspaceId ?? 0);
        res.json(lists);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Không thể tải danh sách Mailchimp' });
    }
});
// 2. Sync CRM Customers to Mailchimp
router.post('/sync', auth_1.requireWrite, async (req, res) => {
    const { listId } = req.body;
    if (!listId) {
        res.status(400).json({ error: 'listId là bắt buộc' });
        return;
    }
    try {
        const customers = await prisma_1.default.customer.findMany({
            where: { workspaceId: req.workspaceId },
            select: { name: true, email: true },
        });
        if (customers.length === 0) {
            res.status(400).json({ error: 'Không có khách hàng nào trong CRM để đồng bộ.' });
            return;
        }
        const result = await (0, mailchimpService_1.syncCustomersToMailchimp)(listId, customers, req.workspaceId ?? 0);
        res.json({
            message: `Đã hoàn tất đồng bộ: Thành công ${result.successCount} / ${result.total} khách hàng.`,
            ...result,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Đồng bộ Mailchimp thất bại.' });
    }
});
// 3. Send Campaign to Mailchimp list
router.post('/campaign', auth_1.requireWrite, async (req, res) => {
    const { listId, subject, htmlContent } = req.body;
    if (!listId || !subject || !htmlContent) {
        res.status(400).json({ error: 'Các trường listId, subject, htmlContent là bắt buộc' });
        return;
    }
    try {
        const result = await (0, mailchimpService_1.sendMailchimpCampaign)(listId, subject, htmlContent, req.workspaceId ?? 0);
        // Save to local EmailCampaign log for reporting
        await prisma_1.default.emailCampaign.create({
            data: {
                name: `Mailchimp: ${subject}`,
                subject,
                htmlContent,
                recipients: `Mailchimp List ID: ${listId}`,
                status: 'SENT',
                sentAt: new Date(),
                sentCount: 0, // Mailchimp handles tracking
                workspaceId: req.workspaceId,
            },
        });
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Gửi chiến dịch Mailchimp thất bại.' });
    }
});
exports.default = router;
