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
exports.syncSourceEmbeddings = syncSourceEmbeddings;
exports.syncKnowledgeBaseEmbeddings = syncKnowledgeBaseEmbeddings;
exports.retrieveRelevantChunksStructured = retrieveRelevantChunksStructured;
exports.retrieveRelevantChunksVector = retrieveRelevantChunksVector;
exports.cosineSimilarity = cosineSimilarity;
const ai_1 = require("./ai");
const prisma_1 = __importDefault(require("./prisma"));
const cache_1 = require("./cache");
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
        // Attempt to create HNSW index (pgvector >= 0.5.0)
        try {
            await prisma_1.default.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_hnsw_idx" ON "KnowledgeChunk" USING hnsw (embedding vector_cosine_ops);');
            console.log('[pgvector] Khởi tạo chỉ mục HNSW vector thành công.');
        }
        catch (hnswErr) {
            console.warn('[pgvector] HNSW không được hỗ trợ hoặc có lỗi, thử chuyển qua IVFFlat:', hnswErr.message || hnswErr);
            // Fallback: Attempt to create IVFFlat index (pgvector < 0.5.0)
            try {
                await prisma_1.default.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_ivfflat_idx" ON "KnowledgeChunk" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);');
                console.log('[pgvector] Khởi tạo chỉ mục IVFFlat vector thành công.');
            }
            catch (ivfflatErr) {
                console.warn('[pgvector] Không thể tự động tạo chỉ mục vector. Hệ thống sẽ quét tuần tự (Sequential Scan):', ivfflatErr.message || ivfflatErr);
            }
        }
        isInitialized = true;
        console.log('[pgvector] Khởi tạo extension vector thành công.');
    }
    catch (err) {
        console.warn('[pgvector] Không thể khởi tạo extension vector. Có thể cơ sở dữ liệu không hỗ trợ vector:', err);
    }
}
const embeddingCache = new Map();
const MAX_CACHE_SIZE = 1000;
/**
 * Fetches text embeddings from the LLM provider (1536 dimensions).
 * Falls back to a deterministic vector based on string hashing if the API request fails.
 *
 * @param text Content to embed.
 * @returns Embeddings vector.
 */
async function getEmbedding(text, allowFallback = true, workspaceId) {
    const cacheKey = text.trim();
    if (embeddingCache.has(cacheKey)) {
        console.log('[Embedding Cache] Hit for:', cacheKey.slice(0, 40));
        return embeddingCache.get(cacheKey);
    }
    const ai = (0, ai_1.getAiConfig)('/embeddings');
    let resultVector = null;
    if (ai.apiKey) {
        try {
            const requestBody = {
                input: text,
                model: ai.model || 'text-embedding-3-small',
            };
            // Force 1536 dimensions for models supporting MRL (gemini-embedding-001 or text-embedding-3-small) to match the postgres schema vector(1536)
            if (ai.model === 'gemini-embedding-001' || ai.model === 'text-embedding-3-small') {
                requestBody.dimensions = 1536;
            }
            const res = await (0, ai_1.fetchWithRetry)(ai.url, {
                method: 'POST',
                headers: ai.headers,
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(10000),
            }, 2, 1200, workspaceId, 'rag_embedding');
            if (res.ok) {
                const json = await res.json();
                if (json.data && json.data[0] && json.data[0].embedding) {
                    resultVector = json.data[0].embedding;
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
    if (!resultVector) {
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
        resultVector = vector.map(v => v / (norm || 1));
    }
    // Cache the generated/fetched vector
    if (embeddingCache.size >= MAX_CACHE_SIZE) {
        const firstKey = embeddingCache.keys().next().value;
        if (firstKey !== undefined) {
            embeddingCache.delete(firstKey);
        }
    }
    embeddingCache.set(cacheKey, resultVector);
    return resultVector;
}
/**
 * Truncates and rebuilds the KnowledgeChunk vector records for a specific KnowledgeSource.
 *
 * @param sourceId ID of the KnowledgeSource.
 */
async function syncSourceEmbeddings(sourceId) {
    await initVectorDb();
    try {
        const source = await prisma_1.default.knowledgeSource.findUnique({
            where: { id: sourceId }
        });
        if (!source) {
            console.warn(`[RAG-Source-Sync] Không tìm thấy KnowledgeSource #${sourceId}`);
            return;
        }
        // Set status to PROCESSING
        await prisma_1.default.knowledgeSource.update({
            where: { id: sourceId },
            data: { status: 'PROCESSING', errorMessage: null }
        });
        // Delete existing chunks for this specific source
        await prisma_1.default.$executeRawUnsafe('DELETE FROM "KnowledgeChunk" WHERE "sourceId" = $1', sourceId);
        const text = source.extractedText || '';
        if (!text.trim()) {
            console.log(`[RAG-Source-Sync] Nội dung của nguồn #${sourceId} rỗng. Đã xóa các chunks cũ.`);
            await prisma_1.default.knowledgeSource.update({
                where: { id: sourceId },
                data: { status: 'COMPLETED' }
            });
            return;
        }
        // Simple text chunking
        const paragraphs = text
            .split(/\n+/)
            .map(p => p.trim())
            .filter(p => p.length > 0);
        const textChunks = [];
        let currentChunk = '';
        const maxChunkLength = 1000;
        for (const paragraph of paragraphs) {
            if (currentChunk.length + paragraph.length > maxChunkLength && currentChunk.length > 0) {
                textChunks.push(currentChunk.trim());
                currentChunk = '';
            }
            currentChunk += (currentChunk ? '\n' : '') + paragraph;
        }
        if (currentChunk.trim().length > 0) {
            textChunks.push(currentChunk.trim());
        }
        console.log(`[RAG-Source-Sync] Đang sinh embedding cho ${textChunks.length} chunks của nguồn #${sourceId} ("${source.name}")...`);
        let successCount = 0;
        for (const content of textChunks) {
            const embedding = await getEmbedding(content);
            if (!embedding)
                continue;
            const embeddingString = `[${embedding.join(',')}]`;
            await prisma_1.default.$executeRawUnsafe('INSERT INTO "KnowledgeChunk" ("workspaceId", "sourceId", "source", "content", "embedding") VALUES ($1, $2, $3, $4, CAST($5 AS vector))', source.workspaceId, source.id, source.name, content, embeddingString);
            successCount++;
        }
        await prisma_1.default.knowledgeSource.update({
            where: { id: sourceId },
            data: { status: 'COMPLETED' }
        });
        void (0, cache_1.invalidateWorkspaceCache)(source.workspaceId, ['rag', 'knowledge-sources']).catch(err => {
            console.error('[embeddings] Lỗi xóa RAG cache:', err);
        });
        console.log(`[RAG-Source-Sync] Đã nạp thành công ${successCount}/${textChunks.length} chunks cho nguồn #${sourceId} ("${source.name}")`);
    }
    catch (err) {
        console.error(`[RAG-Source-Sync] Lỗi đồng bộ hóa nguồn #${sourceId}:`, err);
        await prisma_1.default.knowledgeSource.update({
            where: { id: sourceId },
            data: { status: 'FAILED', errorMessage: err.message || String(err) }
        }).catch(updateErr => console.error('[RAG-Source-Sync] Lỗi cập nhật trạng thái FAILED:', updateErr));
        try {
            const source = await prisma_1.default.knowledgeSource.findUnique({ where: { id: sourceId } });
            if (source) {
                void (0, cache_1.invalidateWorkspaceCache)(source.workspaceId, ['rag', 'knowledge-sources']).catch(() => { });
            }
        }
        catch (ignore) { }
    }
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
        // Delete existing chunks for this workspace that do not belong to any KnowledgeSource
        await prisma_1.default.$executeRawUnsafe('DELETE FROM "KnowledgeChunk" WHERE "workspaceId" = $1 AND "sourceId" IS NULL', workspaceId);
        if (!kbText || !kbText.trim()) {
            console.log(`[RAG-Sync] Tri thức rỗng. Đã xóa các chunks thủ công cho workspace #${workspaceId}`);
            void (0, cache_1.invalidateWorkspaceCache)(workspaceId, ['rag']).catch(() => { });
            return;
        }
        // Dynamically import chunking function to prevent circular dependency
        const { chunkKnowledgeBase } = await Promise.resolve().then(() => __importStar(require('../services/cskhService')));
        const chunks = chunkKnowledgeBase(kbText);
        console.log(`[RAG-Sync] Đang sinh embedding cho ${chunks.length} chunks tri thức thủ công của workspace #${workspaceId}...`);
        for (const chunk of chunks) {
            const embedding = await getEmbedding(chunk.content);
            if (!embedding)
                continue;
            const embeddingString = `[${embedding.join(',')}]`;
            await prisma_1.default.$executeRawUnsafe('INSERT INTO "KnowledgeChunk" ("workspaceId", "source", "content", "embedding") VALUES ($1, $2, $3, CAST($4 AS vector))', workspaceId, chunk.source, chunk.content, embeddingString);
        }
        console.log(`[RAG-Sync] Đã nạp thành công ${chunks.length} chunks tri thức thủ công vào Postgres cho workspace #${workspaceId}`);
        void (0, cache_1.invalidateWorkspaceCache)(workspaceId, ['rag']).catch(err => {
            console.error('[embeddings] Lỗi xóa RAG cache:', err);
        });
    }
    catch (err) {
        console.error(`[RAG-Sync] Lỗi đồng bộ hóa vector DB cho workspace #${workspaceId}:`, err);
    }
}
/**
 * Queries pgvector matching top N closest chunks for semantic search.
 */
async function retrieveRelevantChunksStructured(workspaceId, query, topN = 5) {
    const normalizedQuery = query.trim().toLowerCase();
    const base64Query = Buffer.from(normalizedQuery).toString('base64').slice(0, 100);
    const cacheKey = `ws:${workspaceId}:rag:q:${base64Query}:top:${topN}`;
    try {
        const cached = await cache_1.cache.get(cacheKey);
        if (cached) {
            console.log(`[RAG Semantic Cache] Hit for query: "${query.slice(0, 40)}"`);
            return cached;
        }
    }
    catch (cacheErr) {
        console.warn('[RAG Semantic Cache] Lỗi đọc cache:', cacheErr);
    }
    try {
        await initVectorDb();
        // Check if any chunks exist for this workspace first using an optimized LIMIT 1 check
        const existResult = await prisma_1.default.$queryRawUnsafe('SELECT 1 FROM "KnowledgeChunk" WHERE "workspaceId" = $1 LIMIT 1', workspaceId);
        if (!existResult || existResult.length === 0) {
            return [];
        }
        // Generate query embedding
        const queryVector = await getEmbedding(query, false);
        if (!queryVector) {
            console.log(`[RAG-Vector-Structured] Embedding failed or not supported. Falling back to SQL + TF-IDF keyword search for workspace #${workspaceId}...`);
            const queryTerms = query
                .toLowerCase()
                .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ')
                .split(/\s+/)
                .map(t => t.trim())
                .filter(t => t.length > 1);
            if (queryTerms.length === 0) {
                // If query is empty or too short, return the first topN chunks
                const results = await prisma_1.default.$queryRawUnsafe(`SELECT "source", "sourceId", "content"
           FROM "KnowledgeChunk"
           WHERE "workspaceId" = $1
           LIMIT $2`, workspaceId, topN);
                return results.map(r => ({
                    content: r.content,
                    source: r.source,
                    sourceId: r.sourceId
                }));
            }
            // Query database for chunks that contain any of the query terms
            const clauses = queryTerms.map((_, idx) => `"content" ILIKE $${idx + 2}`);
            const sql = `
        SELECT "source", "sourceId", "content"
        FROM "KnowledgeChunk"
        WHERE "workspaceId" = $1 AND (${clauses.join(' OR ')})
      `;
            const params = [workspaceId, ...queryTerms.map(t => `%${t}%`)];
            const dbChunks = await prisma_1.default.$queryRawUnsafe(sql, ...params);
            // Score and rank the fetched chunks in memory
            const scoredChunks = dbChunks.map(chunk => {
                const contentLower = chunk.content.toLowerCase();
                let score = 0;
                let termMatches = 0;
                for (const term of queryTerms) {
                    const occurrences = contentLower.split(term).length - 1;
                    if (occurrences > 0) {
                        score += Math.sqrt(occurrences);
                        termMatches++;
                    }
                }
                if (termMatches > 0) {
                    score *= (1 + (termMatches / queryTerms.length) * 0.5);
                }
                // Add extra weight for exact bigram or trigram matches
                for (let i = 0; i < queryTerms.length - 1; i++) {
                    const bigram = `${queryTerms[i]} ${queryTerms[i + 1]}`;
                    if (contentLower.includes(bigram)) {
                        score += 2.0;
                    }
                    if (i < queryTerms.length - 2) {
                        const trigram = `${queryTerms[i]} ${queryTerms[i + 1]} ${queryTerms[i + 2]}`;
                        if (contentLower.includes(trigram)) {
                            score += 3.5;
                        }
                    }
                }
                return {
                    chunk,
                    score
                };
            });
            // Sort by score descending
            scoredChunks.sort((a, b) => b.score - a.score);
            // Filter out zero scores, fall back to first N if nothing matched
            const matched = scoredChunks.filter(sc => sc.score > 0).map(sc => sc.chunk);
            const finalChunks = matched.length > 0
                ? matched.slice(0, topN)
                : dbChunks.slice(0, topN);
            // If we still have nothing, get any chunks from the workspace
            if (finalChunks.length === 0) {
                const anyChunks = await prisma_1.default.$queryRawUnsafe(`SELECT "source", "sourceId", "content"
           FROM "KnowledgeChunk"
           WHERE "workspaceId" = $1
           LIMIT $2`, workspaceId, topN);
                return anyChunks.map(r => ({
                    content: r.content,
                    source: r.source,
                    sourceId: r.sourceId
                }));
            }
            return finalChunks.map(r => ({
                content: r.content,
                source: r.source,
                sourceId: r.sourceId
            }));
        }
        const vectorString = `[${queryVector.join(',')}]`;
        // Query Neon PostgreSQL pgvector
        const results = await prisma_1.default.$queryRawUnsafe(`SELECT "source", "sourceId", "content", ("embedding" <=> CAST($1 AS vector)) as distance
       FROM "KnowledgeChunk"
       WHERE "workspaceId" = $2
       ORDER BY distance ASC
       LIMIT $3`, vectorString, workspaceId, topN);
        if (results && results.length > 0) {
            const parsedResults = results.map(r => ({
                content: r.content,
                source: r.source,
                sourceId: r.sourceId
            }));
            try {
                // Cache results for 30 minutes
                await cache_1.cache.set(cacheKey, parsedResults, 1800);
                console.log(`[RAG Semantic Cache] Cached results for query: "${query.slice(0, 40)}"`);
            }
            catch (cacheErr) {
                console.warn('[RAG Semantic Cache] Lỗi ghi cache:', cacheErr);
            }
            return parsedResults;
        }
    }
    catch (err) {
        console.error('[RAG-Vector-Structured] Lỗi truy vấn vector database:', err);
    }
    return [];
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
    const structured = await retrieveRelevantChunksStructured(workspaceId, query, topN);
    return structured.map(s => `[Nguồn: ${s.source}]\n${s.content}`);
}
/**
 * Calculates cosine similarity between two numeric vectors.
 */
function cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length)
        return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0)
        return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
