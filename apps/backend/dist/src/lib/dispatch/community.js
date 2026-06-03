"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchCommunity = dispatchCommunity;
const render_1 = require("./render");
/** Forum / Community — hướng dẫn đăng tay (Reddit, FB Group, v.v.) */
async function dispatchCommunity(payload) {
    const text = (0, render_1.renderContent)(payload.content, {
        urlTarget: payload.urlTarget,
        name: payload.title,
    });
    const preview = text.length > 280 ? `${text.slice(0, 277)}...` : text;
    return {
        success: true,
        message: `[Community] Sao chép & đăng thủ công: "${payload.title}" — ${preview}`,
    };
}
