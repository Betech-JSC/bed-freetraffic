"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./lib/prisma"));
async function main() {
    const pages = await prisma_1.default.landingPage.findMany({});
    console.log('PAGES IN DB:', JSON.stringify(pages.map(p => ({ id: p.id, title: p.title, slug: p.slug, status: p.status })), null, 2));
}
main().catch(console.error);
