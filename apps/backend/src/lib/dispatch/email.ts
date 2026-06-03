import path from 'path';
import { createSmtpTransporter, getSmtpConfig } from '../smtp';
import { renderContent, resolveUploadPath } from './render';
import type { DispatchPayload, DispatchResult } from './types';

export async function dispatchEmail(payload: DispatchPayload): Promise<DispatchResult> {
  const smtp = await getSmtpConfig(payload.workspaceId);
  const transporter = await createSmtpTransporter(payload.workspaceId);
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

  const postContent = renderContent(payload.content, {
    urlTarget: payload.urlTarget,
    name: payload.title,
  });
  const imagePath = resolveUploadPath(payload.imageUrl);

  try {
    const mailOptions: Parameters<typeof transporter.sendMail>[0] = {
      from: smtp.email,
      to: recipients.join(', '),
      subject: payload.title,
      html: `<h2>${payload.title}</h2><p>${postContent.replace(/\n/g, '<br>')}</p>`,
    };
    if (imagePath) {
      mailOptions.attachments = [{ filename: path.basename(imagePath), path: imagePath }];
    }
    await transporter.sendMail(mailOptions);
    return { success: true, message: `Đã gửi email tới ${recipients.length} người nhận` };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : 'Lỗi gửi email' };
  }
}
