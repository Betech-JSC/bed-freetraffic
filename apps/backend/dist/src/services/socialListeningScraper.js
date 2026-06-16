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
exports.normalizeCookie = normalizeCookie;
exports.scrapeFacebookGroup = scrapeFacebookGroup;
exports.extractGroupId = extractGroupId;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
/**
 * Normalizes a potentially malformed cookie string, extracting the raw Cookie header
 * value if it was pasted as a JSON block from cURL & WS Capture or similar tools.
 */
function normalizeCookie(cookieInput) {
    if (!cookieInput)
        return '';
    const trimmed = cookieInput.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            // Case 1: cURL & WS Capture JSON format (under http.headers.Cookie or http.headers.cookie)
            if (parsed.http?.headers) {
                const cookieHeader = parsed.http.headers.Cookie || parsed.http.headers.cookie;
                if (cookieHeader)
                    return cookieHeader;
            }
            // Case 2: Direct headers object
            if (parsed.headers) {
                const cookieHeader = parsed.headers.Cookie || parsed.headers.cookie;
                if (cookieHeader)
                    return cookieHeader;
            }
            // Case 3: Cookies map object (under http.cookies or cookies)
            const cookiesObj = parsed.http?.cookies || parsed.cookies;
            if (cookiesObj && typeof cookiesObj === 'object') {
                const cookieParts = Object.entries(cookiesObj).map(([key, val]) => {
                    return `${key}=${val}`;
                });
                if (cookieParts.length > 0) {
                    return cookieParts.join('; ');
                }
            }
            // Case 4: Any object containing a single cookie string field
            if (parsed.cookie && typeof parsed.cookie === 'string') {
                return parsed.cookie;
            }
        }
        catch (e) {
            // Ignore JSON parse error, treat as raw string
        }
    }
    // Fallback: If it's a raw request header string copy like "Cookie: datr=..."
    const headerMatch = trimmed.match(/cookie:\s*(.+)$/i);
    if (headerMatch) {
        return headerMatch[1].trim();
    }
    return trimmed;
}
/**
 * Decodes JSON/Unicode escape sequences (like \u00eb, \n, etc.) back to raw characters safely.
 */
function decodeUnicode(str) {
    try {
        const safeStr = str
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n')
            .replace(/\t/g, '\\t')
            .replace(/\f/g, '\\f')
            .replace(/[\b]/g, '\\b');
        return JSON.parse('"' + safeStr + '"');
    }
    catch (e) {
        return str
            .replace(/\\u([0-9a-fA-F]{4})/g, (_, p1) => {
            return String.fromCharCode(parseInt(p1, 16));
        })
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
    }
}
/**
 * Extracts comments from a post's JSON/Comet context string using robust regular expressions.
 */
function extractCommentsFromContext(context) {
    const comments = [];
    const seenComments = new Set();
    // Broad regex to match Comment objects inside context JSON
    const commentRegex = /"__typename"\s*:\s*"Comment"\s*,\s*"id"\s*:\s*"([^"]+)"\s*(?:,\s*"[^"]+"\s*:\s*(?:[^{}[\]"]+|"[^"]*"|\{[^{}]*\})*)*,\s*"body"\s*:\s*\{\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"\}\s*,\s*"author"\s*:\s*\{\s*"name"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let match;
    while ((match = commentRegex.exec(context)) !== null) {
        const rawCommentId = match[1];
        let rawText = match[2];
        let rawAuthor = match[3];
        let commentId = rawCommentId;
        if (commentId.includes('comment') || /^[A-Za-z0-9+/=]{10,}$/.test(commentId)) {
            try {
                const decoded = Buffer.from(commentId, 'base64').toString('ascii');
                const parts = decoded.split('_');
                if (parts.length > 1) {
                    commentId = parts[parts.length - 1];
                }
            }
            catch (e) { }
        }
        if (seenComments.has(commentId))
            continue;
        seenComments.add(commentId);
        const content = decodeUnicode(rawText.replace(/\\"/g, '"').replace(/\\\\/g, '\\')).trim();
        const authorName = decodeUnicode(rawAuthor.replace(/\\"/g, '"').replace(/\\\\/g, '\\')).trim();
        if (content.length > 2 && authorName) {
            comments.push({
                commentId,
                authorName,
                content
            });
        }
    }
    // Fallback: If above regex is too strict due to JSON properties ordering, search for body/text and look around it
    if (comments.length === 0) {
        const bodyRegex = /"body"\s*:\s*\{\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"\}/g;
        let bodyMatch;
        while ((bodyMatch = bodyRegex.exec(context)) !== null && comments.length < 15) {
            const index = bodyMatch.index;
            const snippet = context.slice(Math.max(0, index - 500), Math.min(context.length, index + 500));
            const authorMatch = snippet.match(/"author"\s*:\s*\{\s*"name"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            const idMatch = snippet.match(/"legacy_token"\s*:\s*"(\d+)"/) || snippet.match(/"id"\s*:\s*"([^"]+)"/);
            if (authorMatch && idMatch) {
                const rawText = bodyMatch[1];
                const rawAuthor = authorMatch[1];
                let commentId = idMatch[1];
                if (commentId.includes('comment') || /^[A-Za-z0-9+/=]{10,}$/.test(commentId)) {
                    try {
                        const decoded = Buffer.from(commentId, 'base64').toString('ascii');
                        const parts = decoded.split('_');
                        if (parts.length > 1) {
                            commentId = parts[parts.length - 1];
                        }
                    }
                    catch (e) { }
                }
                if (seenComments.has(commentId))
                    continue;
                seenComments.add(commentId);
                const content = decodeUnicode(rawText.replace(/\\"/g, '"').replace(/\\\\/g, '\\')).trim();
                const authorName = decodeUnicode(rawAuthor.replace(/\\"/g, '"').replace(/\\\\/g, '\\')).trim();
                if (content.length > 2 && authorName) {
                    comments.push({
                        commentId,
                        authorName,
                        content
                    });
                }
            }
        }
    }
    return comments;
}
/**
 * Scrapes the latest posts from a Facebook Group using desktop layout and script JSON parsing.
 * Requires a valid Facebook Cookie for authentication.
 * Throws "COOKIE_EXPIRED" error if redirect to login page is detected.
 */
async function scrapeFacebookGroup(groupIdOrUrl, cookie) {
    const groupId = extractGroupId(groupIdOrUrl);
    const url = `https://www.facebook.com/groups/${groupId}/?sorting_setting=CHRONOLOGICAL`;
    const normalizedCookie = normalizeCookie(cookie);
    if (!normalizedCookie.includes('xs=')) {
        console.warn(`⚠️ [Facebook Scraper Warning]: Cookie does not contain the vital session secret "xs=". This will likely fail authentication.`);
    }
    if (!normalizedCookie.includes('c_user=')) {
        console.warn(`⚠️ [Facebook Scraper Warning]: Cookie does not contain user identifier "c_user=". This will likely fail authentication.`);
    }
    // Set default headers
    let userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    let secChUa = '"Not(A:Brand";v="99", "Google Chrome";v="120", "Chromium";v="120"';
    let secChUaMobile = '?0';
    let secChUaPlatform = '"Windows"';
    let secChUaFullVersionList = '';
    let secChUaPlatformVersion = '';
    // Extract from JSON payload if user pasted curl & ws capture block
    if (cookie && (cookie.trim().startsWith('{') || cookie.trim().startsWith('['))) {
        try {
            const parsed = JSON.parse(cookie.trim());
            const jsonHeaders = parsed.http?.headers || parsed.headers;
            if (jsonHeaders) {
                const getHeaderValue = (keyName) => {
                    const key = Object.keys(jsonHeaders).find(k => k.toLowerCase() === keyName.toLowerCase());
                    return key ? jsonHeaders[key] : '';
                };
                const parsedUserAgent = getHeaderValue('user-agent');
                if (parsedUserAgent)
                    userAgent = parsedUserAgent;
                const parsedSecChUa = getHeaderValue('sec-ch-ua');
                if (parsedSecChUa)
                    secChUa = parsedSecChUa;
                const parsedSecChUaMobile = getHeaderValue('sec-ch-ua-mobile');
                if (parsedSecChUaMobile)
                    secChUaMobile = parsedSecChUaMobile;
                const parsedSecChUaPlatform = getHeaderValue('sec-ch-ua-platform');
                if (parsedSecChUaPlatform)
                    secChUaPlatform = parsedSecChUaPlatform;
                const parsedSecChUaFullVersionList = getHeaderValue('sec-ch-ua-full-version-list');
                if (parsedSecChUaFullVersionList)
                    secChUaFullVersionList = parsedSecChUaFullVersionList;
                const parsedSecChUaPlatformVersion = getHeaderValue('sec-ch-ua-platform-version');
                if (parsedSecChUaPlatformVersion)
                    secChUaPlatformVersion = parsedSecChUaPlatformVersion;
            }
        }
        catch (e) {
            // Ignore JSON parse error, fallback to defaults
        }
    }
    const headers = {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'accept-language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'cookie': normalizedCookie,
        'user-agent': userAgent,
        'sec-ch-ua': secChUa,
        'sec-ch-ua-mobile': secChUaMobile,
        'sec-ch-ua-platform': secChUaPlatform,
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1'
    };
    if (secChUaFullVersionList) {
        headers['sec-ch-ua-full-version-list'] = secChUaFullVersionList;
    }
    if (secChUaPlatformVersion) {
        headers['sec-ch-ua-platform-version'] = secChUaPlatformVersion;
    }
    try {
        const response = await axios_1.default.get(url, {
            headers,
            timeout: 15000,
            maxRedirects: 5,
        });
        const html = response.data;
        // Check for login redirects or checkpoints using final URL and specific HTML markers
        const finalUrl = response.request?.res?.responseUrl || '';
        const isRedirectedToLogin = finalUrl.includes('/login') ||
            finalUrl.includes('/checkpoint') ||
            finalUrl.includes('checkpoint.php');
        const hasLoginForm = html.includes('id="login_form"') || html.includes('id="loginform"');
        if (isRedirectedToLogin || hasLoginForm) {
            console.warn(`⚠️ [Facebook Scraper Warning]: Auth failure. Redirected to: ${finalUrl} (Has login form: ${hasLoginForm})`);
            throw new Error('COOKIE_EXPIRED');
        }
        const $ = cheerio.load(html);
        const posts = [];
        const seenPostIds = new Set();
        // Approach 1: Try parsing from script tags containing Comet payload (highly reliable for desktop FB)
        $('script').each((_, scriptEl) => {
            const jsContent = $(scriptEl).html() || '';
            if (!jsContent.includes('post_id') && !jsContent.includes('Story'))
                return;
            const postIdRegex = /"post_id"\s*:\s*"(\d+)"/g;
            let match;
            while ((match = postIdRegex.exec(jsContent)) !== null) {
                const postId = match[1];
                if (seenPostIds.has(postId))
                    continue;
                const index = match.index;
                const contextStart = Math.max(0, index - 8000);
                const contextEnd = Math.min(jsContent.length, index + 8000);
                const context = jsContent.slice(contextStart, contextEnd);
                // Extract message text
                const msgMatch = context.match(/"message"\s*:\s*\{\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"\}/);
                if (!msgMatch)
                    continue;
                let rawContent = msgMatch[1];
                rawContent = rawContent.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                const content = decodeUnicode(rawContent).trim();
                if (content.length <= 10)
                    continue;
                // Extract author name
                let authorName = 'Thành viên nhóm';
                const authorMatch = context.match(/"owning_profile"\s*:\s*\{[^{}]*"name"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                if (authorMatch) {
                    authorName = decodeUnicode(authorMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\')).trim();
                }
                else {
                    const actorMatch = context.match(/"actors"\s*:\s*\[\s*\{\s*"__typename"\s*:\s*"User"\s*,\s*"name"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                    if (actorMatch) {
                        authorName = decodeUnicode(actorMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\')).trim();
                    }
                }
                // Extract profile picture
                let authorAvatar = null;
                const avatarMatch = context.match(/"profile_picture"\s*:\s*\{[^{}]*"uri"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                if (avatarMatch) {
                    authorAvatar = avatarMatch[1].replace(/\\/g, '');
                }
                // Extract post URL
                let postUrl = `https://www.facebook.com/groups/${groupId}/permalink/${postId}/`;
                const urlMatch = context.match(/"url"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                if (urlMatch) {
                    postUrl = urlMatch[1].replace(/\\/g, '');
                }
                const postComments = extractCommentsFromContext(context);
                posts.push({
                    postId,
                    postUrl,
                    authorName,
                    authorAvatar,
                    content,
                    comments: postComments,
                });
                seenPostIds.add(postId);
            }
        });
        // Approach 2: DOM-based backup parsing
        const domPosts = new Map();
        $('a').each((_, el) => {
            const href = $(el).attr('href') || '';
            const match = href.match(/\/groups\/[^/]+\/(?:posts|permalink)\/(\d+)/);
            if (match) {
                const postId = match[1];
                if (seenPostIds.has(postId) || domPosts.has(postId))
                    return;
                let parent = $(el).parent();
                let content = '';
                for (let i = 0; i < 10; i++) {
                    if (!parent.length)
                        break;
                    const contentDiv = parent.find('div[dir="auto"]').first();
                    if (contentDiv.length) {
                        content = contentDiv.text().trim();
                        break;
                    }
                    parent = parent.parent();
                }
                if (content && content.length > 10) {
                    domPosts.set(postId, {
                        postId,
                        postUrl: `https://www.facebook.com/groups/${groupId}/permalink/${postId}/`,
                        authorName: 'Thành viên nhóm',
                        authorAvatar: null,
                        content,
                    });
                }
            }
        });
        for (const [postId, post] of domPosts.entries()) {
            if (!seenPostIds.has(postId)) {
                posts.push(post);
                seenPostIds.add(postId);
            }
        }
        return posts;
    }
    catch (error) {
        if (error.message === 'COOKIE_EXPIRED' || error.response?.status === 401 || error.response?.status === 403) {
            throw new Error('COOKIE_EXPIRED');
        }
        console.error('❌ [Facebook Scraper Error]:', error.message);
        throw error;
    }
}
/**
 * Parses and extracts the group path/ID from a Facebook Group URL or string
 */
function extractGroupId(urlOrId) {
    const cleaned = urlOrId.trim();
    if (!cleaned.includes('/'))
        return cleaned;
    // Regex matches '/groups/some-group-id' or '/groups/12345678/'
    const match = cleaned.match(/\/groups\/([^/\s?]+)/);
    return match ? match[1] : cleaned;
}
