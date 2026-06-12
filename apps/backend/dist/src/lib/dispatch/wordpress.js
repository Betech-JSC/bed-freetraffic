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
exports.dispatchWordPress = dispatchWordPress;
const prisma_1 = __importDefault(require("../../lib/prisma"));
async function dispatchWordPress(payload) {
    const conn = payload.connectionId
        ? await prisma_1.default.socialConnection.findFirst({
            where: { id: payload.connectionId, platform: 'wordpress' },
        })
        : await prisma_1.default.socialConnection.findFirst({
            where: { platform: 'wordpress', workspaceId: payload.workspaceId },
        });
    let siteUrl = conn?.pageId || process.env.WORDPRESS_SITE_URL;
    let username = conn?.pageName || process.env.WORDPRESS_USERNAME;
    let password = conn?.accessToken || process.env.WORDPRESS_APP_PASSWORD;
    // If accessToken is stored as a JSON string, try to parse it
    if (conn?.accessToken && conn.accessToken.trim().startsWith('{')) {
        try {
            const parsed = JSON.parse(conn.accessToken);
            if (parsed.siteUrl)
                siteUrl = parsed.siteUrl;
            if (parsed.username)
                username = parsed.username;
            if (parsed.password)
                password = parsed.password;
            if (parsed.appPassword)
                password = parsed.appPassword;
        }
        catch {
            // ignore parsing error
        }
    }
    if (!siteUrl || !username || !password) {
        return {
            success: false,
            message: 'Chưa cấu hình tài khoản WordPress (URL trang web, Tên đăng nhập, Mật khẩu ứng dụng)',
        };
    }
    // Ensure siteUrl starts with http/https and strip trailing slash
    siteUrl = siteUrl.trim();
    if (!/^https?:\/\//i.test(siteUrl)) {
        siteUrl = `https://${siteUrl}`;
    }
    siteUrl = siteUrl.replace(/\/+$/, '');
    const authHeader = `Basic ${Buffer.from(`${username.trim()}:${password.trim()}`).toString('base64')}`;
    try {
        let featuredMediaId;
        // 1. If imageUrl is provided, attempt to upload it to WordPress Media Library
        if (payload.imageUrl) {
            try {
                let imageBuffer = null;
                let filename = 'featured-image.jpg';
                let contentType = 'image/jpeg';
                if (/^https?:\/\//i.test(payload.imageUrl)) {
                    // Fetch remote image
                    const imgRes = await fetch(payload.imageUrl, { signal: AbortSignal.timeout(10000) });
                    if (imgRes.ok) {
                        const arrayBuffer = await imgRes.arrayBuffer();
                        imageBuffer = Buffer.from(arrayBuffer);
                        const contentTypeHeader = imgRes.headers.get('content-type');
                        if (contentTypeHeader) {
                            contentType = contentTypeHeader;
                        }
                        // Extract filename from URL if possible
                        const urlPath = new URL(payload.imageUrl).pathname;
                        const urlFile = urlPath.substring(urlPath.lastIndexOf('/') + 1);
                        if (urlFile)
                            filename = urlFile;
                    }
                }
                else {
                    // Local image relative path, but since we are in backend service, we might need fs to read it.
                    // In monorepos, local images are often in a public uploads folder.
                    // Let's import fs dynamically to read local file if it exists.
                    const fs = await Promise.resolve().then(() => __importStar(require('fs')));
                    const path = await Promise.resolve().then(() => __importStar(require('path')));
                    // Assuming uploaded images are in a public or upload directory, let's try to resolve it.
                    // Typically: path.join(process.cwd(), payload.imageUrl) or similar
                    const localPath = path.isAbsolute(payload.imageUrl)
                        ? payload.imageUrl
                        : path.join(process.cwd(), payload.imageUrl);
                    if (fs.existsSync(localPath)) {
                        imageBuffer = fs.readFileSync(localPath);
                        const ext = path.extname(localPath).toLowerCase();
                        filename = path.basename(localPath);
                        if (ext === '.png')
                            contentType = 'image/png';
                        else if (ext === '.gif')
                            contentType = 'image/gif';
                        else if (ext === '.webp')
                            contentType = 'image/webp';
                    }
                }
                if (imageBuffer) {
                    const mediaUrl = `${siteUrl}/wp-json/wp/v2/media`;
                    const mediaRes = await fetch(mediaUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': authHeader,
                            'Content-Type': contentType,
                            'Content-Disposition': `attachment; filename="${filename}"`,
                        },
                        body: imageBuffer,
                        signal: AbortSignal.timeout(15000),
                    });
                    if (mediaRes.ok) {
                        const mediaData = (await mediaRes.json());
                        if (mediaData && mediaData.id) {
                            featuredMediaId = mediaData.id;
                        }
                    }
                    else {
                        console.error('Failed to upload media to WordPress:', await mediaRes.text());
                    }
                }
            }
            catch (mediaErr) {
                console.error('WordPress Media upload error:', mediaErr);
                // Continue creating the post even if media upload fails
            }
        }
        // 2. Publish the post
        const postsUrl = `${siteUrl}/wp-json/wp/v2/posts`;
        const postBody = {
            title: payload.title,
            // Format content: convert newlines to paragraph tags or keep raw html
            content: payload.content.includes('<p>') ? payload.content : payload.content.split('\n').map(p => `<p>${p}</p>`).join(''),
            status: 'publish', // Publish immediately
        };
        if (featuredMediaId) {
            postBody.featured_media = featuredMediaId;
        }
        const res = await fetch(postsUrl, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(postBody),
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
            const errText = await res.text();
            let errMessage = res.statusText;
            try {
                const errJson = JSON.parse(errText);
                if (errJson.message)
                    errMessage = errJson.message;
            }
            catch { }
            return {
                success: false,
                message: `WordPress API error: ${errMessage} (${res.status})`,
            };
        }
        const postData = (await res.json());
        return {
            success: true,
            message: `Đăng WordPress thành công: ${postData.link || siteUrl}`,
        };
    }
    catch (e) {
        return {
            success: false,
            message: `Lỗi kết nối WordPress: ${e.message || e}`,
        };
    }
}
