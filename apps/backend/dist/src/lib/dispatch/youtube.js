"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchYoutube = dispatchYoutube;
const render_1 = require("./render");
/** YouTube — MVP: checklist đăng video / mô tả (API upload cần OAuth riêng) */
async function dispatchYoutube(payload) {
    const description = (0, render_1.renderContent)(payload.content, {
        urlTarget: payload.urlTarget,
        name: payload.title,
    });
    return {
        success: true,
        message: `[YouTube] Dùng mô tả sau khi upload video: Tiêu đề="${payload.title}" | Mô tả (280 ký tự đầu): ${description.slice(0, 280)}`,
    };
}
