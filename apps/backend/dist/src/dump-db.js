"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./lib/prisma"));
async function main() {
    console.log('--- CAMPAIGNS ---');
    const campaigns = await prisma_1.default.socialListeningCampaign.findMany();
    console.dir(campaigns, { depth: null });
    console.log('--- LOGS COUNT ---');
    const logsCount = await prisma_1.default.socialListeningLog.count();
    console.log('Total logs:', logsCount);
    console.log('--- RECENT LOGS ---');
    const logs = await prisma_1.default.socialListeningLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { campaign: { select: { name: true } } }
    });
    console.dir(logs, { depth: null });
}
main().catch(console.error);
