"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchZalo = dispatchZalo;
const prisma_1 = __importDefault(require("../prisma"));
const render_1 = require("./render");
async function dispatchZalo(payload) {
    const zaloConn = await prisma_1.default.socialConnection.findFirst({
        where: { platform: 'zalo', workspaceId: payload.workspaceId }
    });
    if (!zaloConn?.accessToken || zaloConn.status !== 'CONNECTED') {
        return { success: false, message: 'Chưa kết nối Zalo OA (Cài đặt)' };
    }
    const postContent = (0, render_1.renderContent)(payload.content, {
        urlTarget: payload.urlTarget,
        name: payload.title,
    });
    try {
        const response = await fetch('https://openapi.zalo.me/v2.0/article/create', {
            method: 'POST',
            headers: {
                access_token: zaloConn.accessToken,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'normal',
                title: payload.title,
                author: zaloConn.pageName || 'OA',
                description: postContent.slice(0, 300),
                body: [
                    { type: 'text', content: postContent },
                    ...(payload.urlTarget ? [{ type: 'text', content: `\n👉 ${payload.urlTarget}` }] : []),
                ],
            }),
        });
        const data = await response.json();
        if (data.error !== 0 && data.error !== undefined) {
            return { success: false, message: data.message || 'Zalo API lỗi' };
        }
        return { success: true, message: 'Đăng bài Zalo OA thành công' };
    }
    catch (err) {
        return { success: false, message: err instanceof Error ? err.message : 'Lỗi Zalo' };
    }
}
