"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmailCampaign = sendEmailCampaign;
exports.dispatchDueEmailCampaigns = dispatchDueEmailCampaigns;
const prisma_1 = __importDefault(require("../lib/prisma"));
const smtp_1 = require("../lib/smtp");
async function sendEmailCampaign(campaignId) {
    const campaign = await prisma_1.default.emailCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
        throw new Error('Không tìm thấy chiến dịch');
    }
    const transporter = await (0, smtp_1.createSmtpTransporter)();
    if (!transporter) {
        throw new Error('Chưa cấu hình SMTP. Vào Cài đặt → Email hoặc thêm SMTP_USER/SMTP_PASS vào backend .env.');
    }
    const baseUrl = process.env.API_PUBLIC_URL || 'http://localhost:4000';
    const list = campaign.recipients.split(/[,;\s]+/).filter(Boolean);
    if (list.length === 0) {
        throw new Error('Danh sách người nhận trống');
    }
    let sent = 0;
    const errors = [];
    const smtpCfg = await (0, smtp_1.getSmtpConfig)();
    const fromAddress = process.env.SMTP_FROM || smtpCfg?.email || '';
    for (const email of list) {
        const trackOpen = `${baseUrl}/api/email-campaigns/track/open/${campaignId}?r=${encodeURIComponent(email)}`;
        const html = campaign.htmlContent
            // Double curly brackets (compatibility)
            .replace(/\{\{track_open\}\}/g, `<img src="${trackOpen}" width="1" height="1" alt="" />`)
            .replace(/\{\{email\}\}/g, email)
            // Single curly brackets (normal style)
            .replace(/\{track_open\}/g, `<img src="${trackOpen}" width="1" height="1" alt="" />`)
            .replace(/\{email\}/g, email);
        try {
            await transporter.sendMail({
                from: fromAddress,
                to: email,
                subject: campaign.subject,
                html,
            });
            sent++;
            await prisma_1.default.emailEvent.create({
                data: { campaignId, eventType: 'sent', recipient: email },
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[EmailCampaign]', email, msg);
            errors.push(`${email}: ${msg}`);
        }
    }
    const status = sent > 0 ? 'SENT' : 'FAILED';
    await prisma_1.default.emailCampaign.update({
        where: { id: campaignId },
        data: { status, sentAt: sent > 0 ? new Date() : null, sentCount: sent },
    });
    return { sent, total: list.length, errors, status };
}
async function dispatchDueEmailCampaigns(limit = 10) {
    const due = await prisma_1.default.emailCampaign.findMany({
        where: {
            status: 'SCHEDULED',
            scheduledAt: { lte: new Date() },
        },
        orderBy: { scheduledAt: 'asc' },
        take: limit,
    });
    for (const c of due) {
        try {
            const result = await sendEmailCampaign(c.id);
            if (result.status === 'FAILED') {
                console.error(`[EmailCampaignEngine] Campaign ${c.id} failed:`, result.errors[0]);
            }
        }
        catch (err) {
            console.error(`[EmailCampaignEngine] Campaign ${c.id}:`, err);
            await prisma_1.default.emailCampaign.update({
                where: { id: c.id },
                data: { status: 'FAILED' },
            });
        }
    }
    return due.length;
}
