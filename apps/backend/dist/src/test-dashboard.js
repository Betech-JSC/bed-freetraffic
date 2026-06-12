"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./lib/prisma"));
const google_1 = require("./lib/google");
async function test() {
    const workspaceId = 1;
    const days = 7;
    console.log("=== RUNNING DIAGNOSTIC TEST ON getLiveDashboard ===");
    const integration = await prisma_1.default.googleIntegration.findFirst({ where: { workspaceId } });
    console.log("Integration in DB:", integration);
    console.log("Fetching GSC summary...");
    const gsc = await (0, google_1.fetchGscSummary)(days, workspaceId);
    console.log("GSC Result:", gsc);
    console.log("Getting GA4 client...");
    const analyticsDataClient = await (0, google_1.getGa4Client)(workspaceId);
    console.log("GA4 Client created:", !!analyticsDataClient);
    if (analyticsDataClient && integration) {
        const ga4PropertyId = integration.ga4PropertyId || (0, google_1.getGa4PropertyId)();
        console.log("Property ID to query:", ga4PropertyId);
        try {
            const [response] = await analyticsDataClient.runReport({
                property: `properties/${ga4PropertyId}`,
                dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
                metrics: [{ name: 'activeUsers' }],
            });
            console.log("GA4 runReport response rows count:", response?.rows?.length);
            console.log("Full response rows:", JSON.stringify(response?.rows, null, 2));
        }
        catch (err) {
            console.error("GA4 runReport ERROR:", err.message || err);
        }
    }
}
test()
    .catch(e => console.error(e))
    .finally(() => prisma_1.default.$disconnect());
