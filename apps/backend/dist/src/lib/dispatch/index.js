"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DISPATCH_PLATFORMS = void 0;
exports.dispatchToPlatform = dispatchToPlatform;
exports.parsePlatforms = parsePlatforms;
exports.dispatchToAllPlatforms = dispatchToAllPlatforms;
exports.summarizeChannelResults = summarizeChannelResults;
const community_1 = require("./community");
const email_1 = require("./email");
const facebook_1 = require("./facebook");
const youtube_1 = require("./youtube");
const zalo_1 = require("./zalo");
const telegram_1 = require("./telegram");
const reddit_1 = require("./reddit");
const tiktok_1 = require("./tiktok");
const wordpress_1 = require("./wordpress");
var types_1 = require("./types");
Object.defineProperty(exports, "DISPATCH_PLATFORMS", { enumerable: true, get: function () { return types_1.DISPATCH_PLATFORMS; } });
async function dispatchToPlatform(platform, payload) {
    const p = platform.trim().toLowerCase();
    if (p === 'facebook')
        return (0, facebook_1.dispatchFacebook)(payload);
    if (p === 'email')
        return (0, email_1.dispatchEmail)(payload);
    if (p === 'zalo')
        return (0, zalo_1.dispatchZalo)(payload);
    if (p === 'youtube')
        return (0, youtube_1.dispatchYoutube)(payload);
    if (p === 'community')
        return (0, community_1.dispatchCommunity)(payload);
    if (p === 'telegram')
        return (0, telegram_1.dispatchTelegram)(payload);
    if (p === 'reddit')
        return (0, reddit_1.dispatchReddit)(payload);
    if (p === 'tiktok')
        return (0, tiktok_1.dispatchTiktok)(payload);
    if (p === 'wordpress')
        return (0, wordpress_1.dispatchWordPress)(payload);
    return { success: false, message: `Kênh "${platform}" chưa hỗ trợ` };
}
function parsePlatforms(platforms) {
    if (!platforms)
        return [];
    const trimmed = platforms.trim();
    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.map((p) => String(p).trim().toLowerCase()).filter(Boolean);
            }
        }
        catch {
            // ignore and fall through
        }
    }
    return trimmed
        .split(',')
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean);
}
async function dispatchToAllPlatforms(platforms, payload) {
    const list = parsePlatforms(platforms);
    const results = [];
    for (const platform of list) {
        const r = await dispatchToPlatform(platform, {
            ...payload,
            emailRecipients: platform === 'email' ? payload.emailRecipients : undefined,
        });
        results.push({
            platform,
            success: r.success,
            message: r.message,
            at: new Date().toISOString(),
        });
    }
    return results;
}
function summarizeChannelResults(results) {
    if (results.length === 0) {
        return { status: 'FAILED', errorMessage: 'Không có kênh nào' };
    }
    const ok = results.filter((r) => r.success).length;
    if (ok === results.length)
        return { status: 'PUBLISHED', errorMessage: null };
    if (ok === 0) {
        return {
            status: 'FAILED',
            errorMessage: results.map((r) => `${r.platform}: ${r.message}`).join(' | '),
        };
    }
    return {
        status: 'PARTIAL',
        errorMessage: results
            .filter((r) => !r.success)
            .map((r) => `${r.platform}: ${r.message}`)
            .join(' | '),
    };
}
