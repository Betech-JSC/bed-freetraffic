"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleNextOccurrence = scheduleNextOccurrence;
const prisma_1 = __importDefault(require("../lib/prisma"));
const cron_parser_1 = __importDefault(require("cron-parser"));
async function scheduleNextOccurrence(item, publishStatus) {
    if (!item.repeatRule)
        return;
    if (publishStatus !== 'PUBLISHED' && publishStatus !== 'PARTIAL')
        return;
    const rule = item.repeatRule.toLowerCase();
    let next = new Date(item.scheduledAt);
    if (rule === 'daily') {
        next.setDate(next.getDate() + 1);
    }
    else if (rule === 'weekly') {
        next.setDate(next.getDate() + 7);
    }
    else if (rule === 'cron') {
        if (!item.cronExpression) {
            await prisma_1.default.contentSchedule.update({
                where: { id: item.id },
                data: { repeatRule: null },
            });
            return;
        }
        try {
            const interval = cron_parser_1.default.parse(item.cronExpression, { currentDate: item.scheduledAt });
            next = interval.next().toDate();
        }
        catch (err) {
            console.error('[Recurrence] Loi parse cron expression:', err);
            await prisma_1.default.contentSchedule.update({
                where: { id: item.id },
                data: {
                    repeatRule: null,
                    errorMessage: 'Quy tac lap Cron khong hop le: ' + (err instanceof Error ? err.message : String(err))
                },
            });
            return;
        }
    }
    else {
        return;
    }
    if (item.repeatUntil && next > item.repeatUntil) {
        await prisma_1.default.contentSchedule.update({
            where: { id: item.id },
            data: { repeatRule: null },
        });
        return;
    }
    await prisma_1.default.contentSchedule.update({
        where: { id: item.id },
        data: {
            status: 'PENDING',
            scheduledAt: next,
            publishedAt: null,
            errorMessage: null,
            channelResults: null,
        },
    });
}
