"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAiConfig = getAiConfig;
exports.parseAiJson = parseAiJson;
exports.logAiUsage = logAiUsage;
exports.fetchWithRetry = fetchWithRetry;
/**
 * AI Service Utilities for Growth OS.
 * Handles API URL configuration, robust JSON parsing, and retry mechanics for LLM providers
 * (OpenAI, DeepSeek, Google Gemini, OpenRouter).
 */
const prisma_1 = __importDefault(require("./prisma"));
/**
 * Resolves the AI endpoint configuration based on environment variables and keys.
 *
 * Supports:
 * - OpenAI (default API endpoint)
 * - DeepSeek (sk-... key with deepseek model)
 * - Google Gemini (AIzaSy... key with OpenAI compatibility endpoint)
 * - OpenRouter (sk-or-... key)
 *
 * @param path The API endpoint path, defaults to '/chat/completions'.
 * @returns An object containing the configured API Key, Request URL, Model Name, and Headers.
 */
function getAiConfig(path = '/chat/completions', feature) {
    let apiKey = process.env.OPENAI_API_KEY || '';
    let model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    // 1. Feature-specific model selection & API key routing
    if (feature === 'chatbot') {
        if (process.env.AI_MODEL_CHATBOT) {
            model = process.env.AI_MODEL_CHATBOT;
        }
        else if (process.env.GEMINI_API_KEY) {
            apiKey = process.env.GEMINI_API_KEY;
            model = 'gemini-2.5-flash';
        }
    }
    else if (feature === 'lead_qualifier') {
        if (process.env.AI_MODEL_LEAD_QUALIFIER) {
            model = process.env.AI_MODEL_LEAD_QUALIFIER;
        }
    }
    else if (feature === 'content_generation') {
        if (process.env.AI_MODEL_CONTENT) {
            model = process.env.AI_MODEL_CONTENT;
        }
    }
    // 2. Custom routing for embeddings
    if (path === '/embeddings') {
        if (process.env.AI_MODEL_EMBEDDING) {
            model = process.env.AI_MODEL_EMBEDDING;
        }
        else if (process.env.GEMINI_API_KEY) {
            apiKey = process.env.GEMINI_API_KEY;
            model = 'gemini-embedding-001';
        }
    }
    // If the model is a gemini model and the key is not already a gemini key, use GEMINI_API_KEY if present
    if (model.includes('gemini') && !apiKey.startsWith('AIzaSy') && process.env.GEMINI_API_KEY) {
        apiKey = process.env.GEMINI_API_KEY;
    }
    let url = `https://api.openai.com/v1${path}`;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
    };
    if (apiKey.startsWith('sk-or-')) {
        // OpenRouter integration
        url = `https://openrouter.ai/api/v1${path}`;
        headers['HTTP-Referer'] = 'http://localhost:4000';
        headers['X-Title'] = 'Growth OS';
    }
    else if (apiKey.startsWith('AIzaSy')) {
        // Google Gemini OpenAI compatibility integration
        url = `https://generativelanguage.googleapis.com/v1beta/openai${path}`;
        if (path === '/embeddings') {
            model = 'gemini-embedding-001';
        }
        else if (model === 'gpt-4o-mini' ||
            model.includes('free') ||
            model.includes('gemma') ||
            model === 'gpt-4o' ||
            model.includes('gemini')) {
            model = 'gemini-2.5-flash';
        }
    }
    else if (model.includes('deepseek') && !apiKey.startsWith('sk-or-')) {
        // Direct DeepSeek integration
        url = `https://api.deepseek.com${path}`;
    }
    return { apiKey, url, model, headers };
}
/**
 * A highly resilient JSON parsing utility that extracts structured JSON data from raw text.
 * Uses 5 progressive strategies to resolve parsing errors, including code block removal,
 * substring parsing, and brace-counting extraction for truncated responses.
 *
 * @template T Expected JSON return shape.
 * @param text The raw text string returned by the LLM.
 * @returns The parsed object/array of type T.
 * @throws SyntaxError if all parsing strategies fail.
 */
function parseAiJson(text) {
    const cleaned = text.trim();
    // Strategy 1: Direct JSON parsing
    try {
        return JSON.parse(cleaned);
    }
    catch (err) {
        // Strategy 2: Find and extract JSON object bounded by outermost curly braces { }
        // Only apply if the input is not intended to be a JSON array (i.e. does not start with '[')
        const isArrayStr = cleaned.startsWith('[');
        if (!isArrayStr) {
            const startIdx = cleaned.indexOf('{');
            const endIdx = cleaned.lastIndexOf('}');
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                const jsonSub = cleaned.slice(startIdx, endIdx + 1);
                try {
                    return JSON.parse(jsonSub);
                }
                catch (innerErr) {
                    // Fall through
                }
            }
        }
        // Strategy 3: Find and extract JSON array bounded by outermost brackets [ ]
        const startArrIdx = cleaned.indexOf('[');
        const endArrIdx = cleaned.lastIndexOf(']');
        if (startArrIdx !== -1 && endArrIdx !== -1 && endArrIdx > startArrIdx) {
            const jsonSub = cleaned.slice(startArrIdx, endArrIdx + 1);
            try {
                return JSON.parse(jsonSub);
            }
            catch (innerErr) {
                // Fall through
            }
        }
        // Strategy 4: Strip markdown code blocks (```json ... ```)
        let fallbackClean = cleaned;
        if (fallbackClean.startsWith('```')) {
            fallbackClean = fallbackClean.replace(/^```(?:json)?/i, '');
            fallbackClean = fallbackClean.replace(/```$/, '');
            fallbackClean = fallbackClean.trim();
            try {
                return JSON.parse(fallbackClean);
            }
            catch (innerErr) {
                // Fall through
            }
        }
        // Strategy 5: Advanced brace-counting extraction (Rescue truncated JSON arrays of objects)
        const results = [];
        let braceCount = 0;
        let objStartIdx = -1;
        for (let i = 0; i < cleaned.length; i++) {
            if (cleaned[i] === '{') {
                if (braceCount === 0) {
                    objStartIdx = i;
                }
                braceCount++;
            }
            else if (cleaned[i] === '}') {
                braceCount--;
                if (braceCount === 0 && objStartIdx !== -1) {
                    const objStr = cleaned.slice(objStartIdx, i + 1);
                    try {
                        results.push(JSON.parse(objStr));
                    }
                    catch { }
                    objStartIdx = -1;
                }
                else if (braceCount < 0) {
                    braceCount = 0;
                    objStartIdx = -1;
                }
            }
        }
        if (results.length > 0) {
            return results;
        }
        throw err;
    }
}
/**
 * Performs a network request via fetch with automatic retry mechanics.
 * Retries on transient network disconnects or 503 Service Unavailable errors.
 *
 * @param url Request target URL.
 * @param init Request configurations.
 * @param retries Maximum number of retries, defaults to 2.
 * @param delayMs Delay before retrying in milliseconds, defaults to 1200ms.
 * @returns Fetch Response object.
 */
async function logAiUsage({ model, promptTokens, completionTokens, totalTokens, feature, workspaceId }) {
    try {
        await prisma_1.default.aiUsage.create({
            data: {
                model,
                promptTokens,
                completionTokens,
                totalTokens,
                feature: feature || 'unknown',
                workspaceId
            }
        });
    }
    catch (err) {
        console.error('[AI USAGE LOG ERROR]', err);
    }
}
async function fetchWithRetry(url, init, retries = 2, delayMs = 1200, workspaceId, feature) {
    let lastRes = null;
    for (let i = 0; i <= retries; i++) {
        try {
            const res = await fetch(url, init);
            lastRes = res;
            // Retry if service is temporarily overloaded (503) or rate limited (429)
            if ((res.status === 503 || res.status === 429) && i < retries) {
                const retryDelay = res.status === 429 ? delayMs * 2 : delayMs;
                console.warn(`⚠️ [AI API ${res.status}] ${res.status === 429 ? 'Rate limited' : 'Model quá tải'}. Đang thử lại lần ${i + 1}/${retries} sau ${retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue;
            }
            if (res.ok) {
                const cloned = res.clone();
                cloned.json().then(async (data) => {
                    try {
                        const usage = data.usage;
                        let modelName = data.model;
                        if (!modelName && init.body) {
                            try {
                                modelName = JSON.parse(init.body).model;
                            }
                            catch { }
                        }
                        if (!modelName)
                            modelName = 'unknown-model';
                        if (usage) {
                            const promptTokens = usage.prompt_tokens || 0;
                            const completionTokens = usage.completion_tokens || 0;
                            const totalTokens = usage.total_tokens || 0;
                            let wsId = workspaceId;
                            let feat = feature;
                            // Fallback to headers
                            if (!wsId && init.headers) {
                                const headersObj = new Headers(init.headers);
                                const hWsId = headersObj.get('x-workspace-id');
                                if (hWsId)
                                    wsId = parseInt(hWsId, 10);
                                const hFeat = headersObj.get('x-feature');
                                if (hFeat)
                                    feat = hFeat;
                            }
                            await logAiUsage({
                                model: modelName,
                                promptTokens,
                                completionTokens,
                                totalTokens,
                                feature: feat || 'unknown',
                                workspaceId: wsId,
                            });
                        }
                    }
                    catch (err) {
                        console.error('Error logging AI usage in fetchWithRetry:', err);
                    }
                }).catch(() => {
                    // ignore if response wasn't JSON
                });
            }
            return res;
        }
        catch (err) {
            if (i < retries) {
                console.warn(`⚠️ [AI API Error] Lỗi kết nối (${err.message}). Đang thử lại lần ${i + 1}/${retries} sau ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                continue;
            }
            throw err;
        }
    }
    // lastRes is guaranteed non-null here because the loop always assigns it or throws
    return lastRes;
}
