"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CARE_EMAIL_TEMPLATE_DEFAULT = void 0;
exports.renderCareEmail = renderCareEmail;
function renderCareEmail(template, customer, latestNote) {
    const noteText = latestNote ||
        customer.notes?.[0]?.content ||
        '—';
    return template
        // Double brackets support
        .replace(/\{\{ten\}\}/gi, customer.name)
        .replace(/\{\{name\}\}/gi, customer.name)
        .replace(/\{\{email\}\}/gi, customer.email)
        .replace(/\{\{phone\}\}/gi, customer.phone || '')
        .replace(/\{\{cong_ty\}\}/gi, customer.company || '')
        .replace(/\{\{company\}\}/gi, customer.company || '')
        .replace(/\{\{ghi_chu\}\}/gi, noteText)
        .replace(/\{\{note\}\}/gi, noteText)
        .replace(/\{\{trang_thai\}\}/gi, customer.status)
        .replace(/\{\{status\}\}/gi, customer.status)
        .replace(/\{\{date\}\}/gi, new Date().toLocaleDateString('vi-VN'))
        // Single brackets support (normal style)
        .replace(/\{ten\}/gi, customer.name)
        .replace(/\{name\}/gi, customer.name)
        .replace(/\{email\}/gi, customer.email)
        .replace(/\{phone\}/gi, customer.phone || '')
        .replace(/\{cong_ty\}/gi, customer.company || '')
        .replace(/\{company\}/gi, customer.company || '')
        .replace(/\{ghi_chu\}/gi, noteText)
        .replace(/\{note\}/gi, noteText)
        .replace(/\{trang_thai\}/gi, customer.status)
        .replace(/\{status\}/gi, customer.status)
        .replace(/\{date\}/gi, new Date().toLocaleDateString('vi-VN'));
}
exports.CARE_EMAIL_TEMPLATE_DEFAULT = `<p>Xin chào {ten},</p>
<p>Chúng tôi liên hệ để chăm sóc và hỗ trợ bạn.</p>
<p><em>Ghi chú nội bộ: {ghi_chu}</em></p>
<p>Trân trọng,<br/>Đội ngũ Be Traffic</p>`;
