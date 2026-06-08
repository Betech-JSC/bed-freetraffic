import cron from 'node-cron';
import nodemailer from 'nodemailer';
import prisma from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import { resolveAutomationPost } from '../services/automationTemplate';
import { isValidPostLink, publishToFacebookPage } from '../lib/facebookPost';

function renderContent(template: { content: string }, task: { urlTarget: string; name: string }) {
  return template.content
    .replace(/\{url\}/g, task.urlTarget)
    .replace(/\{name\}/g, task.name)
    .replace(/\{date\}/g, new Date().toLocaleDateString('vi-VN'));
}

// Hàm lấy ngẫu nhiên 1 nội dung mẫu từ DB
async function getRandomTemplate(taskId: number) {
  const templates = await prisma.postTemplate.findMany({
    where: {
      isActive: true,
      OR: [
        { taskId: taskId },
        { taskId: null }
      ]
    }
  });

  if (templates.length === 0) return null;
  return templates[Math.floor(Math.random() * templates.length)];
}

// Hàm đăng bài thật lên Facebook Page
async function postToFacebook(task: any): Promise<{ success: boolean; message: string }> {
  try {
    const resolved = await resolveAutomationPost(task);
    if (!resolved) {
      return { success: false, message: '⚠️ Chưa có nội dung bài đăng. Vui lòng tạo trong Content Editor hoặc gắn A/B test.' };
    }

    const postContent = renderContent(
      { content: resolved.content },
      { urlTarget: resolved.urlTarget, name: task.name }
    );
    const imagePath = resolveUploadPath(resolved.imageUrl);

    if (!imagePath && !isValidPostLink(resolved.urlTarget) && !postContent.trim()) {
      return {
        success: false,
        message:
          '⚠️ Thiếu URL đích hợp lệ (https://...) hoặc nội dung/ảnh. Sửa chiến dịch Bot — trường URL không được để trống hoặc "0".',
      };
    }

    const result = await publishToFacebookPage({
      message: postContent,
      link: resolved.urlTarget,
      imagePath,
    });

    if (!result.success) return result;
    return {
      success: true,
      message: `${result.message} | Nội dung: "${resolved.title}"`,
    };
  } catch (error: any) {
    return { success: false, message: `❌ Lỗi kết nối: ${error.message}` };
  }
}

async function postToEmail(task: any): Promise<{ success: boolean; message: string }> {
  try {
    const emailConn = await prisma.socialConnection.findFirst({
      where: { platform: 'email', workspaceId: task.workspaceId }
    });

    if (!emailConn || emailConn.status !== 'CONNECTED' || !emailConn.accessToken) {
      return { success: false, message: '⚠️ Chưa kết nối Email SMTP. Vui lòng vào Settings.' };
    }

    const recipients = (task.emailRecipients || '')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      return { success: false, message: '⚠️ Chưa cấu hình danh sách email nhận cho chiến dịch này.' };
    }

    const resolved = await resolveAutomationPost(task);
    if (!resolved) {
      return { success: false, message: '⚠️ Chưa có nội dung email hoặc A/B test.' };
    }
    const template = {
      title: resolved.title,
      content: resolved.content,
      imageUrl: resolved.imageUrl,
    };
    const linkTarget = resolved.urlTarget;

    const config = JSON.parse(emailConn.accessToken);
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.email, pass: config.password }
    });

    const postContent = renderContent(template, { urlTarget: linkTarget, name: task.name });
    let html = `
      <h2>${template.title}</h2>
      <div style="white-space:pre-line;line-height:1.6">${postContent.replace(/\n/g, '<br>')}</div>
    `;

    const attachments: any[] = [];
    const imageUrl = template.imageUrl;
    if (imageUrl) {
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        html += `<div style="margin-top:16px;"><img src="${imageUrl}" style="max-width:100%;height:auto;border-radius:8px;display:block;" /></div>`;
      } else {
        const imagePath = resolveUploadPath(imageUrl);
        if (imagePath) {
          html += `<div style="margin-top:16px;"><img src="cid:post_image" style="max-width:100%;height:auto;border-radius:8px;display:block;" /></div>`;
          attachments.push({
            filename: path.basename(imagePath),
            path: imagePath,
            cid: 'post_image'
          });
        }
      }
    }

    html += `
      <p style="margin-top:16px"><a href="${linkTarget}">👉 Xem chi tiết tại đây</a></p>
    `;

    const mailOptions: any = {
      from: config.email,
      to: recipients.join(', '),
      subject: template.title,
      html
    };

    if (attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    await transporter.sendMail(mailOptions);

    return {
      success: true,
      message: `✅ Đã gửi email tới ${recipients.length} người nhận | "${template.title}"`
    };
  } catch (error: any) {
    return { success: false, message: `❌ Email: ${error.message}` };
  }
}

async function postToZalo(task: any): Promise<{ success: boolean; message: string }> {
  try {
    const zaloConn = await prisma.socialConnection.findFirst({
      where: { platform: 'zalo', workspaceId: task.workspaceId }
    });

    if (!zaloConn || zaloConn.status !== 'CONNECTED' || !zaloConn.accessToken) {
      return { success: false, message: '⚠️ Chưa kết nối Zalo OA. Vui lòng vào Settings.' };
    }

    const resolved = await resolveAutomationPost(task);
    if (!resolved) {
      return { success: false, message: '⚠️ Chưa có nội dung hoặc A/B test.' };
    }
    const template = {
      title: resolved.title,
      content: resolved.content,
      imageUrl: resolved.imageUrl,
    };
    const linkTarget = resolved.urlTarget;

    const postContent = renderContent(template, { urlTarget: linkTarget, name: task.name });
    const accessToken = zaloConn.accessToken;

    const response = await fetch('https://openapi.zalo.me/v2.0/article/create', {
      method: 'POST',
      headers: {
        access_token: accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'normal',
        title: template.title,
        author: zaloConn.pageName || 'Official Account',
        description: postContent.slice(0, 300),
        body: [
          { type: 'text', content: postContent },
          { type: 'text', content: `\n👉 ${linkTarget}` }
        ]
      })
    });

    const data = await response.json();

    if (data.error !== 0 && data.error !== undefined) {
      return { success: false, message: `❌ Zalo API: ${data.message || JSON.stringify(data)}` };
    }

    return {
      success: true,
      message: `✅ Đăng bài Zalo OA thành công | "${template.title}"`
    };
  } catch (error: any) {
    return { success: false, message: `❌ Zalo: ${error.message}` };
  }
}

/** @deprecated Dùng lib/dispatch — giữ cho tương thích nội bộ */
export async function publishScheduledContent(opts: {
  title: string;
  content: string;
  imageUrl?: string | null;
  urlTarget?: string;
  platform: string;
  emailRecipients?: string;
}): Promise<{ success: boolean; message: string }> {
  const { dispatchToPlatform } = await import('../lib/dispatch');
  return dispatchToPlatform(opts.platform, {
    title: opts.title,
    content: opts.content,
    imageUrl: opts.imageUrl,
    urlTarget: opts.urlTarget,
    emailRecipients: opts.emailRecipients,
  });
}

function resolveUploadPath(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  const rel = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
  const imagePath = path.join(__dirname, '../../', rel);
  return fs.existsSync(imagePath) ? imagePath : null;
}

async function publishFacebookWithTemplate(
  task: { urlTarget: string },
  template: { title: string; content: string; imageUrl: string | null }
): Promise<{ success: boolean; message: string }> {
  const postContent = renderContent(template, { urlTarget: task.urlTarget, name: template.title });
  const result = await publishToFacebookPage({
    message: postContent,
    link: task.urlTarget,
    imagePath: resolveUploadPath(template.imageUrl),
  });
  if (!result.success) return result;
  return { success: true, message: 'Đăng Facebook thành công' };
}

async function publishEmailWithTemplate(
  task: { urlTarget: string; emailRecipients?: string; workspaceId?: number | null },
  template: { title: string; content: string; imageUrl?: string | null }
): Promise<{ success: boolean; message: string }> {
  const emailConn = await prisma.socialConnection.findFirst({
    where: { platform: 'email', workspaceId: task.workspaceId || undefined }
  });
  if (!emailConn?.accessToken) return { success: false, message: 'Chưa kết nối Email' };
  const recipients = (task.emailRecipients || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!recipients.length) {
    return {
      success: false,
      message:
        'Thiếu email nhận — nhập recipients khi tạo lịch hoặc cấu hình SCHEDULE_EMAIL_RECIPIENTS trong backend .env',
    };
  }

  const config = JSON.parse(emailConn.accessToken);
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.email, pass: config.password },
  });
  const postContent = renderContent(template, { urlTarget: task.urlTarget, name: template.title });
  const imageUrl = template.imageUrl;
  let html = `<h2>${template.title}</h2><p>${postContent.replace(/\n/g, '<br>')}</p>`;
  const attachments: any[] = [];

  if (imageUrl) {
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      html += `<div style="margin-top:16px;"><img src="${imageUrl}" style="max-width:100%;height:auto;border-radius:8px;display:block;" /></div>`;
    } else {
      const imagePath = resolveUploadPath(imageUrl);
      if (imagePath) {
        html += `<div style="margin-top:16px;"><img src="cid:post_image" style="max-width:100%;height:auto;border-radius:8px;display:block;" /></div>`;
        attachments.push({
          filename: path.basename(imagePath),
          path: imagePath,
          cid: 'post_image'
        });
      }
    }
  }

  const mailOptions: nodemailer.SendMailOptions = {
    from: config.email,
    to: recipients.join(', '),
    subject: template.title,
    html
  };

  if (attachments.length > 0) {
    mailOptions.attachments = attachments;
  }

  await transporter.sendMail(mailOptions);
  return { success: true, message: 'Gửi email thành công' };
}

async function publishZaloWithTemplate(
  task: { urlTarget: string; workspaceId?: number | null },
  template: { title: string; content: string; imageUrl?: string | null }
): Promise<{ success: boolean; message: string }> {
  const zaloConn = await prisma.socialConnection.findFirst({
    where: { platform: 'zalo', workspaceId: task.workspaceId || undefined }
  });
  if (!zaloConn?.accessToken) return { success: false, message: 'Chưa kết nối Zalo' };
  const postContent = renderContent(template, { urlTarget: task.urlTarget, name: template.title });
  const response = await fetch('https://openapi.zalo.me/v2.0/article/create', {
    method: 'POST',
    headers: { access_token: zaloConn.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'normal',
      title: template.title,
      author: zaloConn.pageName || 'OA',
      description: postContent.slice(0, 300),
      body: [
        { type: 'text', content: postContent },
        { type: 'text', content: `\n👉 ${task.urlTarget}` },
      ],
    }),
  });
  const data = await response.json();
  if (data.error !== 0 && data.error !== undefined) {
    return { success: false, message: data.message || 'Zalo error' };
  }
  return { success: true, message: 'Đăng Zalo thành công' };
}

export async function executeAutomationTask(task: any) {
  console.log(`[BOT] Thực thi: ${task.name} (ID: ${task.id})`);

  let platforms: string[] = [];
  try {
    platforms = JSON.parse(task.platforms);
  } catch {
    platforms = ['facebook'];
  }

  for (const platform of platforms) {
    let result = { success: false, message: `Nền tảng ${platform} chưa được tích hợp.` };

    if (platform === 'facebook') {
      result = await postToFacebook(task);
    } else if (platform === 'email') {
      result = await postToEmail(task);
    } else if (platform === 'zalo') {
      result = await postToZalo(task);
    } else if (platform === 'youtube' || platform === 'community') {
      const { dispatchToPlatform } = await import('../lib/dispatch');
      const resolved = await resolveAutomationPost(task);
      if (!resolved) {
        result = { success: false, message: 'Chưa có nội dung' };
      } else {
        result = await dispatchToPlatform(platform, {
          title: resolved.title,
          content: resolved.content,
          imageUrl: resolved.imageUrl,
          urlTarget: resolved.urlTarget,
        });
      }
    }

    await prisma.botLog.create({
      data: {
        taskId: task.id,
        action: `POST_${platform.toUpperCase()}`,
        message: result.message,
        status: result.success ? 'SUCCESS' : 'ERROR'
      }
    });

    console.log(`  -> [${platform}] ${result.message}`);
  }

  await prisma.automationTask.update({
    where: { id: task.id },
    data: { lastRunAt: new Date() }
  });
}

export const startBots = () => {
  console.log("🤖 Automation Bot Engine Started...");

  cron.schedule('* * * * *', async () => {
    try {
      const activeTasks = await prisma.automationTask.findMany({
        where: { status: 'RUNNING' }
      });

      const now = new Date();

      for (const task of activeTasks) {
        const lastRun = task.lastRunAt?.getTime() || 0;
        const intervalMs = task.interval * 60 * 1000;

        if (now.getTime() - lastRun >= intervalMs) {
          await executeAutomationTask(task);
        }
      }
    } catch (error) {
      console.error("[BOT ENGINE ERROR]:", error);
    }
  });
};
