"use strict";
/**
 * AI Service Utilities for Growth OS.
 * Handles API URL configuration, robust JSON parsing, and retry mechanics for LLM providers
 * (OpenAI, DeepSeek, Google Gemini, OpenRouter).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAiConfig = getAiConfig;
exports.parseAiJson = parseAiJson;
exports.fetchWithRetry = fetchWithRetry;
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
function getAiConfig(path = '/chat/completions') {
    let apiKey = process.env.OPENAI_API_KEY || '';
    let model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    // Custom routing for embeddings if GEMINI_API_KEY is configured
    if (path === '/embeddings' && process.env.GEMINI_API_KEY) {
        apiKey = process.env.GEMINI_API_KEY;
        model = 'text-embedding-004';
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
            model = 'text-embedding-004';
        }
        else if (model === 'gpt-4o-mini' ||
            model.includes('free') ||
            model.includes('gemma') ||
            model === 'gpt-4o') {
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
async function fetchWithRetry(url, init, retries = 2, delayMs = 1200) {
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
