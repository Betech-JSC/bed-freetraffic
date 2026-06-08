"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startBots = void 0;
exports.publishScheduledContent = publishScheduledContent;
exports.executeAutomationTask = executeAutomationTask;
const node_cron_1 = __importDefault(require("node-cron"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const automationTemplate_1 = require("../services/automationTemplate");
const facebookPost_1 = require("../lib/facebookPost");
function renderContent(template, task) {
    return template.content
        .replace(/\{url\}/g, task.urlTarget)
        .replace(/\{name\}/g, task.name)
        .replace(/\{date\}/g, new Date().toLocaleDateString('vi-VN'));
}
// Hàm lấy ngẫu nhiên 1 nội dung mẫu từ DB
async function getRandomTemplate(taskId) {
    const templates = await prisma_1.default.postTemplate.findMany({
        where: {
            isActive: true,
            OR: [
                { taskId: taskId },
                { taskId: null }
            ]
        }
    });
    if (templates.length === 0)
        return null;
    return templates[Math.floor(Math.random() * templates.length)];
}
// Hàm đăng bài thật lên Facebook Page
async function postToFacebook(task) {
    try {
        const resolved = await (0, automationTemplate_1.resolveAutomationPost)(task);
        if (!resolved) {
            return { success: false, message: '⚠️ Chưa có nội dung bài đăng. Vui lòng tạo trong Content Editor hoặc gắn A/B test.' };
        }
        const postContent = renderContent({ content: resolved.content }, { urlTarget: resolved.urlTarget, name: task.name });
        const imagePath = resolveUploadPath(resolved.imageUrl);
        if (!imagePath && !(0, facebookPost_1.isValidPostLink)(resolved.urlTarget) && !postContent.trim()) {
            return {
                success: false,
                message: '⚠️ Thiếu URL đích hợp lệ (https://...) hoặc nội dung/ảnh. Sửa chiến dịch Bot — trường URL không được để trống hoặc "0".',
            };
        }
        const result = await (0, facebookPost_1.publishToFacebookPage)({
            message: postContent,
            link: resolved.urlTarget,
            imagePath,
        });
        if (!result.success)
            return result;
        return {
            success: true,
            message: `${result.message} | Nội dung: "${resolved.title}"`,
        };
    }
    catch (error) {
        return { success: false, message: `❌ Lỗi kết nối: ${error.message}` };
    }
}
async function postToEmail(task) {
    try {
        const emailConn = await prisma_1.default.socialConnection.findFirst({
            where: { platform: 'email', workspaceId: task.workspaceId }
        });
        if (!emailConn || emailConn.status !== 'CONNECTED' || !emailConn.accessToken) {
            return { success: false, message: '⚠️ Chưa kết nối Email SMTP. Vui lòng vào Settings.' };
        }
        const recipients = (task.emailRecipients || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        if (recipients.length === 0) {
            return { success: false, message: '⚠️ Chưa cấu hình danh sách email nhận cho chiến dịch này.' };
        }
        const resolved = await (0, automationTemplate_1.resolveAutomationPost)(task);
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
        const transporter = nodemailer_1.default.createTransport({
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
        const attachments = [];
        const imageUrl = template.imageUrl;
        if (imageUrl) {
            if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                html += `<div style="margin-top:16px;"><img src="${imageUrl}" style="max-width:100%;height:auto;border-radius:8px;display:block;" /></div>`;
            }
            else {
                const imagePath = resolveUploadPath(imageUrl);
                if (imagePath) {
                    html += `<div style="margin-top:16px;"><img src="cid:post_image" style="max-width:100%;height:auto;border-radius:8px;display:block;" /></div>`;
                    attachments.push({
                        filename: path_1.default.basename(imagePath),
                        path: imagePath,
                        cid: 'post_image'
                    });
                }
            }
        }
        html += `
      <p style="margin-top:16px"><a href="${linkTarget}">👉 Xem chi tiết tại đây</a></p>
    `;
        const mailOptions = {
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
    }
    catch (error) {
        return { success: false, message: `❌ Email: ${error.message}` };
    }
}
async function postToZalo(task) {
    try {
        const zaloConn = await prisma_1.default.socialConnection.findFirst({
            where: { platform: 'zalo', workspaceId: task.workspaceId }
        });
        if (!zaloConn || zaloConn.status !== 'CONNECTED' || !zaloConn.accessToken) {
            return { success: false, message: '⚠️ Chưa kết nối Zalo OA. Vui lòng vào Settings.' };
        }
        const resolved = await (0, automationTemplate_1.resolveAutomationPost)(task);
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
    }
    catch (error) {
        return { success: false, message: `❌ Zalo: ${error.message}` };
    }
}
/** @deprecated Dùng lib/dispatch — giữ cho tương thích nội bộ */
async function publishScheduledContent(opts) {
    const { dispatchToPlatform } = await Promise.resolve().then(() => __importStar(require('../lib/dispatch')));
    return dispatchToPlatform(opts.platform, {
        title: opts.title,
        content: opts.content,
        imageUrl: opts.imageUrl,
        urlTarget: opts.urlTarget,
        emailRecipients: opts.emailRecipients,
    });
}
function resolveUploadPath(imageUrl) {
    if (!imageUrl)
        return null;
    const rel = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
    const imagePath = path_1.default.join(__dirname, '../../', rel);
    return fs_1.default.existsSync(imagePath) ? imagePath : null;
}
async function publishFacebookWithTemplate(task, template) {
    const postContent = renderContent(template, { urlTarget: task.urlTarget, name: template.title });
    const result = await (0, facebookPost_1.publishToFacebookPage)({
        message: postContent,
        link: task.urlTarget,
        imagePath: resolveUploadPath(template.imageUrl),
    });
    if (!result.success)
        return result;
    return { success: true, message: 'Đăng Facebook thành công' };
}
async function publishEmailWithTemplate(task, template) {
    const emailConn = await prisma_1.default.socialConnection.findFirst({
        where: { platform: 'email', workspaceId: task.workspaceId || undefined }
    });
    if (!emailConn?.accessToken)
        return { success: false, message: 'Chưa kết nối Email' };
    const recipients = (task.emailRecipients || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    if (!recipients.length) {
        return {
            success: false,
            message: 'Thiếu email nhận — nhập recipients khi tạo lịch hoặc cấu hình SCHEDULE_EMAIL_RECIPIENTS trong backend .env',
        };
    }
    const config = JSON.parse(emailConn.accessToken);
    const transporter = nodemailer_1.default.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: { user: config.email, pass: config.password },
    });
    const postContent = renderContent(template, { urlTarget: task.urlTarget, name: template.title });
    const imageUrl = template.imageUrl;
    let html = `<h2>${template.title}</h2><p>${postContent.replace(/\n/g, '<br>')}</p>`;
    const attachments = [];
    if (imageUrl) {
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            html += `<div style="margin-top:16px;"><img src="${imageUrl}" style="max-width:100%;height:auto;border-radius:8px;display:block;" /></div>`;
        }
        else {
            const imagePath = resolveUploadPath(imageUrl);
            if (imagePath) {
                html += `<div style="margin-top:16px;"><img src="cid:post_image" style="max-width:100%;height:auto;border-radius:8px;display:block;" /></div>`;
                attachments.push({
                    filename: path_1.default.basename(imagePath),
                    path: imagePath,
                    cid: 'post_image'
                });
            }
        }
    }
    const mailOptions = {
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
async function publishZaloWithTemplate(task, template) {
    const zaloConn = await prisma_1.default.socialConnection.findFirst({
        where: { platform: 'zalo', workspaceId: task.workspaceId || undefined }
    });
    if (!zaloConn?.accessToken)
        return { success: false, message: 'Chưa kết nối Zalo' };
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
async function executeAutomationTask(task) {
    console.log(`[BOT] Thực thi: ${task.name} (ID: ${task.id})`);
    let platforms = [];
    try {
        platforms = JSON.parse(task.platforms);
    }
    catch {
        platforms = ['facebook'];
    }
    for (const platform of platforms) {
        let result = { success: false, message: `Nền tảng ${platform} chưa được tích hợp.` };
        if (platform === 'facebook') {
            result = await postToFacebook(task);
        }
        else if (platform === 'email') {
            result = await postToEmail(task);
        }
        else if (platform === 'zalo') {
            result = await postToZalo(task);
        }
        else if (platform === 'youtube' || platform === 'community') {
            const { dispatchToPlatform } = await Promise.resolve().then(() => __importStar(require('../lib/dispatch')));
            const resolved = await (0, automationTemplate_1.resolveAutomationPost)(task);
            if (!resolved) {
                result = { success: false, message: 'Chưa có nội dung' };
            }
            else {
                result = await dispatchToPlatform(platform, {
                    title: resolved.title,
                    content: resolved.content,
                    imageUrl: resolved.imageUrl,
                    urlTarget: resolved.urlTarget,
                });
            }
        }
        await prisma_1.default.botLog.create({
            data: {
                taskId: task.id,
                action: `POST_${platform.toUpperCase()}`,
                message: result.message,
                status: result.success ? 'SUCCESS' : 'ERROR'
            }
        });
        console.log(`  -> [${platform}] ${result.message}`);
    }
    await prisma_1.default.automationTask.update({
        where: { id: task.id },
        data: { lastRunAt: new Date() }
    });
}
const startBots = () => {
    console.log("🤖 Automation Bot Engine Started...");
    node_cron_1.default.schedule('* * * * *', async () => {
        try {
            const activeTasks = await prisma_1.default.automationTask.findMany({
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
        }
        catch (error) {
            console.error("[BOT ENGINE ERROR]:", error);
        }
    });
};
exports.startBots = startBots;
