"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchTelegram = dispatchTelegram;
const render_1 = require("./render");
const prisma_1 = __importDefault(require("../../lib/prisma"));
async function dispatchTelegram(payload) {
    const conn = await prisma_1.default.socialConnection.findFirst({
        where: { platform: 'telegram', workspaceId: payload.workspaceId }
    });
    const token = conn?.accessToken || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = conn?.pageId || process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
        return {
            success: false,
            message: 'Chưa cấu hình TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID trong hệ thống',
        };
    }
    const text = (0, render_1.renderContent)(payload.content, {
        urlTarget: payload.urlTarget,
        name: payload.title,
    });
    // Format with bold title for aesthetic layout
    const formattedMessage = `<b>${payload.title}</b>\n\n${text}`;
    try {
        let url = `https://api.telegram.org/bot${token}/sendMessage`;
        const body = {
            chat_id: chatId,
            parse_mode: 'HTML',
        };
        if (payload.imageUrl) {
            url = `https://api.telegram.org/bot${token}/sendPhoto`;
            body.photo = payload.imageUrl;
            body.caption = formattedMessage.slice(0, 1024); // Telegram caption limit is 1024 chars
        }
        else {
            body.text = formattedMessage;
        }
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
            const err = await res.json();
            return {
                success: false,
                message: `Telegram API error: ${err.description || res.status}`,
            };
        }
        return {
            success: true,
            message: `Đã đăng bài lên Telegram Chat/Channel ${chatId}`,
        };
    }
    catch (e) {
        return {
            success: false,
            message: `Lỗi kết nối Telegram: ${e.message || e}`,
        };
    }
}
