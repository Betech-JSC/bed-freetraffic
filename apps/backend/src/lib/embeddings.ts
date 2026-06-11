import { getAiConfig } from './ai';
import prisma from './prisma';

let isInitialized = false;

/**
 * Initializes the PostgreSQL vector extension (pgvector) and creates the KnowledgeChunk table.
 */
export async function initVectorDb(): Promise<void> {
  if (isInitialized) return;
  try {
    // Enable extension pgvector
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');
    
    isInitialized = true;
    console.log('[pgvector] Khởi tạo extension vector thành công.');
  } catch (err) {
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
export async function getEmbedding(text: string, allowFallback: boolean = true): Promise<number[] | null> {
  const ai = getAiConfig('/embeddings');
  
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
        const json = await res.json() as any;
        if (json.data && json.data[0] && json.data[0].embedding) {
          return json.data[0].embedding;
        }
      } else {
        console.warn(`[Embedding API] Failed with status ${res.status}:`, await res.text().catch(() => ''));
      }
    } catch (err) {
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
export async function syncKnowledgeBaseEmbeddings(workspaceId: number, kbText: string): Promise<void> {
  await initVectorDb();
  
  try {
    // Delete existing chunks for this workspace
    await prisma.$executeRawUnsafe(
      'DELETE FROM "KnowledgeChunk" WHERE "workspaceId" = $1',
      workspaceId
    );
    
    if (!kbText || !kbText.trim()) {
      console.log(`[RAG-Sync] Tri thức rỗng. Đã xóa toàn bộ chunks cho workspace #${workspaceId}`);
      return;
    }
    
    // Dynamically import chunking function to prevent circular dependency
    const { chunkKnowledgeBase } = await import('../services/cskhService');
    const chunks = chunkKnowledgeBase(kbText);
    
    console.log(`[RAG-Sync] Đang sinh embedding cho ${chunks.length} chunks tri thức của workspace #${workspaceId}...`);
    
    for (const chunk of chunks) {
      const embedding = await getEmbedding(chunk.content);
      if (!embedding) continue;
      const embeddingString = `[${embedding.join(',')}]`;
      
      await prisma.$executeRawUnsafe(
        'INSERT INTO "KnowledgeChunk" ("workspaceId", "source", "content", "embedding") VALUES ($1, $2, $3, CAST($4 AS vector))',
        workspaceId,
        chunk.source,
        chunk.content,
        embeddingString
      );
    }
    
    console.log(`[RAG-Sync] Đã nạp thành công ${chunks.length} chunks tri thức vào Postgres cho workspace #${workspaceId}`);
  } catch (err) {
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
export async function retrieveRelevantChunksVector(
  workspaceId: number,
  query: string,
  topN: number = 5
): Promise<string[]> {
  try {
    await initVectorDb();
    
    // Check if any chunks exist for this workspace first
    const countResult = await prisma.$queryRawUnsafe<any[]>(
      'SELECT COUNT(*)::integer as count FROM "KnowledgeChunk" WHERE "workspaceId" = $1',
      workspaceId
    );
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
    const results = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "source", "content", ("embedding" <=> CAST($1 AS vector)) as distance
       FROM "KnowledgeChunk"
       WHERE "workspaceId" = $2
       ORDER BY distance ASC
       LIMIT $3`,
      vectorString,
      workspaceId,
      topN
    );

    if (results && results.length > 0) {
      console.log(`[RAG-Vector] Đã truy vấn thành công ${results.length} chunks thông qua pgvector (Neon).`);
      return results.map(r => `[Nguồn: ${r.source}]\n${r.content}`);
    }
  } catch (err) {
    console.error('[RAG-Vector] Lỗi khi truy vấn vector database pgvector. Sẽ dùng RAG text-matching fallback:', err);
  }
  return [];
}
