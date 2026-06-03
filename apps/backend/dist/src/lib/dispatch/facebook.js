"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchFacebook = dispatchFacebook;
const render_1 = require("./render");
const facebookPost_1 = require("../facebookPost");
async function dispatchFacebook(payload) {
    const postContent = (0, render_1.renderContent)(payload.content, {
        urlTarget: payload.urlTarget,
        name: payload.title,
    });
    const result = await (0, facebookPost_1.publishToFacebookPage)({
        message: postContent,
        link: payload.urlTarget,
        imagePath: (0, render_1.resolveUploadPath)(payload.imageUrl),
        workspaceId: payload.workspaceId,
    });
    if (!result.success)
        return { success: false, message: result.message };
    return { success: true, message: 'Đăng Fanpage thành công' };
}
