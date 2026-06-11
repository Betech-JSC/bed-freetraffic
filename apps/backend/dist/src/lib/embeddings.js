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
exports.initVectorDb = initVectorDb;
exports.getEmbedding = getEmbedding;
exports.syncKnowledgeBaseEmbeddings = syncKnowledgeBaseEmbeddings;
exports.retrieveRelevantChunksVector = retrieveRelevantChunksVector;
const ai_1 = require("./ai");
const prisma_1 = __importDefault(require("./prisma"));
let isInitialized = false;
/**
 * Initializes the PostgreSQL vector extension (pgvector) and creates the KnowledgeChunk table.
 */
async function initVectorDb() {
    if (isInitialized)
        return;
    try {
        // Enable extension pgvector
        await prisma_1.default.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');
        isInitialized = true;
        console.log('[pgvector] Khởi tạo extension vector thành công.');
    }
    catch (err) {
        console.warn('[pgvector] Không thể khởi tạo extension vector. Có thể cơ sở dữ liệu không hỗ trợ vector:', err);
    }
}
/**
 * Fetches text embeddings from the LLM provider (1536 dimensions).
 * Falls back to a deterministic vector based on string hashing if the API request fails.
 *
 * @param text Content to embed.
 * @returns Embeddings vector.
 */
async function getEmbedding(text, allowFallback = true) {
    const ai = (0, ai_1.getAiConfig)('/embeddings');
    if (ai.apiKey) {
        try {
            const res = await fetch(ai.url, {
                method: 'POST',
                headers: ai.headers,
                body: JSON.stringify({
                    input: text,
                    model: 'text-embedding-3-small',
                }),
                signal: AbortSignal.timeout(10000),
            });
            if (res.ok) {
                const json = await res.json();
                if (json.data && json.data[0] && json.data[0].embedding) {
                    return json.data[0].embedding;
                }
            }
            else {
                console.warn(`[Embedding API] Failed with status ${res.status}:`, await res.text().catch(() => ''));
            }
        }
        catch (err) {
            console.error('[Embedding API] Error generating embedding:', err);
        }
    }
    if (!allowFallback) {
        console.log('[Embedding] Không cho phép fallback, trả về null.');
        return null;
    }
    // Fallback: Deterministic vector of 1536 dimensions using simple hash
    console.log('[Embedding] Sử dụng fallback vector sinh lập trình cho content:', text.slice(0, 30));
    const vector = new Array(1536).fill(0);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    for (let i = 0; i < 1536; i++) {
        vector[i] = Math.sin(hash + i) * 0.1;
    }
    // Normalize vector
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(v => v / (norm || 1));
}
/**
 * Truncates and rebuilds the KnowledgeChunk vector database records for a given workspace.
 * Performs chunks generation, gets embedding vectors, and inserts them using pgvector syntax.
 *
 * @param workspaceId ID of the workspace.
 * @param kbText Full text contents of the knowledge base.
 */
async function syncKnowledgeBaseEmbeddings(workspaceId, kbText) {
    await initVectorDb();
    try {
        // Delete existing chunks for this workspace
        await prisma_1.default.$executeRawUnsafe('DELETE FROM "KnowledgeChunk" WHERE "workspaceId" = $1', workspaceId);
        if (!kbText || !kbText.trim()) {
            console.log(`[RAG-Sync] Tri thức rỗng. Đã xóa toàn bộ chunks cho workspace #${workspaceId}`);
            return;
        }
        // Dynamically import chunking function to prevent circular dependency
        const { chunkKnowledgeBase } = await Promise.resolve().then(() => __importStar(require('../services/cskhService')));
        const chunks = chunkKnowledgeBase(kbText);
        console.log(`[RAG-Sync] Đang sinh embedding cho ${chunks.length} chunks tri thức của workspace #${workspaceId}...`);
        for (const chunk of chunks) {
            const embedding = await getEmbedding(chunk.content);
            if (!embedding)
                continue;
            const embeddingString = `[${embedding.join(',')}]`;
            await prisma_1.default.$executeRawUnsafe('INSERT INTO "KnowledgeChunk" ("workspaceId", "source", "content", "embedding") VALUES ($1, $2, $3, CAST($4 AS vector))', workspaceId, chunk.source, chunk.content, embeddingString);
        }
        console.log(`[RAG-Sync] Đã nạp thành công ${chunks.length} chunks tri thức vào Postgres cho workspace #${workspaceId}`);
    }
    catch (err) {
        console.error(`[RAG-Sync] Lỗi đồng bộ hóa vector DB cho workspace #${workspaceId}:`, err);
    }
}
/**
 * Queries pgvector matching top N closest chunks for semantic search.
 * Cosine distance operator <=> is used.
 *
 * @param workspaceId ID of the workspace.
 * @param query Chat query content.
 * @param topN Number of records to return.
 * @returns Array of source-annotated chunk contents.
 */
async function retrieveRelevantChunksVector(workspaceId, query, topN = 5) {
    try {
        await initVectorDb();
        // Check if any chunks exist for this workspace first
        const countResult = await prisma_1.default.$queryRawUnsafe('SELECT COUNT(*)::integer as count FROM "KnowledgeChunk" WHERE "workspaceId" = $1', workspaceId);
        const count = countResult?.[0]?.count || 0;
        if (count === 0) {
            console.log(`[RAG-Vector] Không tìm thấy chunks nào cho workspace #${workspaceId}. Bỏ qua tìm kiếm vector.`);
            return [];
        }
        // Generate query embedding
        const queryVector = await getEmbedding(query, false);
        if (!queryVector) {
            console.log('[RAG-Vector] API Embedding trả về null (không hỗ trợ hoặc lỗi). Sử dụng local text-matching.');
            return [];
        }
        const vectorString = `[${queryVector.join(',')}]`;
        // Query Neon PostgreSQL pgvector
        const results = await prisma_1.default.$queryRawUnsafe(`SELECT "source", "content", ("embedding" <=> CAST($1 AS vector)) as distance
       FROM "KnowledgeChunk"
       WHERE "workspaceId" = $2
       ORDER BY distance ASC
       LIMIT $3`, vectorString, workspaceId, topN);
        if (results && results.length > 0) {
            console.log(`[RAG-Vector] Đã truy vấn thành công ${results.length} chunks thông qua pgvector (Neon).`);
            return results.map(r => `[Nguồn: ${r.source}]\n${r.content}`);
        }
    }
    catch (err) {
        console.error('[RAG-Vector] Lỗi khi truy vấn vector database pgvector. Sẽ dùng RAG text-matching fallback:', err);
    }
    return [];
}
