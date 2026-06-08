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
const prisma_1 = __importDefault(require("../lib/prisma"));
const automationTemplate_1 = require("../services/automationTemplate");
function parsePlatforms(platformsStr) {
    if (!platformsStr)
        return ['facebook'];
    const trimmed = platformsStr.trim();
    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.map((p) => String(p).trim().toLowerCase()).filter(Boolean);
            }
        }
        catch (err) {
            // ignore and fall through
        }
    }
    return trimmed
        .split(',')
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean);
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
async function executeAutomationTask(task) {
    console.log(`[BOT] Thực thi: ${task.name} (ID: ${task.id})`);
    const platforms = parsePlatforms(task.platforms);
    if (platforms.length === 0) {
        console.log(`[BOT] Tác vụ ${task.name} không cấu hình kênh đăng nào.`);
        await prisma_1.default.automationTask.update({
            where: { id: task.id },
            data: { lastRunAt: new Date() }
        });
        return;
    }
    const resolved = await (0, automationTemplate_1.resolveAutomationPost)(task);
    if (!resolved) {
        const errorMsg = '⚠️ Chưa có nội dung bài đăng. Vui lòng tạo trong Content Editor hoặc gắn A/B test.';
        for (const platform of platforms) {
            await prisma_1.default.botLog.create({
                data: {
                    taskId: task.id,
                    action: `POST_${platform.toUpperCase()}`,
                    message: errorMsg,
                    status: 'ERROR'
                }
            });
            console.log(`  -> [${platform}] ${errorMsg}`);
        }
        await prisma_1.default.automationTask.update({
            where: { id: task.id },
            data: { lastRunAt: new Date() }
        });
        return;
    }
    const { dispatchToPlatform } = await Promise.resolve().then(() => __importStar(require('../lib/dispatch')));
    for (const platform of platforms) {
        let result;
        try {
            result = await dispatchToPlatform(platform, {
                title: resolved.title,
                content: resolved.content,
                imageUrl: resolved.imageUrl,
                urlTarget: resolved.urlTarget,
                emailRecipients: task.emailRecipients || undefined,
                workspaceId: task.workspaceId || undefined,
            });
        }
        catch (err) {
            result = { success: false, message: `Lỗi thực thi: ${err.message}` };
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
