"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/mailchimp/status', (_req, res) => {
    const key = process.env.MAILCHIMP_API_KEY;
    const server = process.env.MAILCHIMP_SERVER_PREFIX;
    res.json({
        configured: !!(key && server),
        provider: 'Mailchimp',
        message: key && server
            ? 'Mailchimp API key đã cấu hình — gửi email campaign vẫn dùng SMTP mặc định; đồng bộ list đầy đủ sẽ có ở bản sau.'
            : 'Thêm MAILCHIMP_API_KEY và MAILCHIMP_SERVER_PREFIX vào .env để bật tích hợp (OI-02). Hiện dùng SMTP trong Cài đặt.',
    });
});
exports.default = router;
