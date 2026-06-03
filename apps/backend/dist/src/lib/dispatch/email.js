"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchEmail = dispatchEmail;
const path_1 = __importDefault(require("path"));
const smtp_1 = require("../smtp");
const render_1 = require("./render");
async function dispatchEmail(payload) {
    const smtp = await (0, smtp_1.getSmtpConfig)(payload.workspaceId);
    const transporter = await (0, smtp_1.createSmtpTransporter)(payload.workspaceId);
    if (!smtp || !transporter) {
        return { success: false, message: 'Chưa cấu hình SMTP (Cài đặt → Email)' };
    }
    const recipients = (payload.emailRecipients || process.env.SCHEDULE_EMAIL_RECIPIENTS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    if (!recipients.length) {
        return {
            success: false,
            message: 'Thiếu email nhận — nhập khi tạo lịch hoặc SCHEDULE_EMAIL_RECIPIENTS trong .env',
        };
    }
    const postContent = (0, render_1.renderContent)(payload.content, {
        urlTarget: payload.urlTarget,
        name: payload.title,
    });
    const imagePath = (0, render_1.resolveUploadPath)(payload.imageUrl);
    try {
        const mailOptions = {
            from: smtp.email,
            to: recipients.join(', '),
            subject: payload.title,
            html: `<h2>${payload.title}</h2><p>${postContent.replace(/\n/g, '<br>')}</p>`,
        };
        if (imagePath) {
            mailOptions.attachments = [{ filename: path_1.default.basename(imagePath), path: imagePath }];
        }
        await transporter.sendMail(mailOptions);
        return { success: true, message: `Đã gửi email tới ${recipients.length} người nhận` };
    }
    catch (err) {
        return { success: false, message: err instanceof Error ? err.message : 'Lỗi gửi email' };
    }
}
