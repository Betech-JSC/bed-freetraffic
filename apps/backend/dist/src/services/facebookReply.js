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
exports.postFacebookComment = postFacebookComment;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const socialListeningScraper_1 = require("./socialListeningScraper");
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
/**
 * Parses a Facebook URL or Post ID to construct the mbasic story URL.
 */
function getMbasicUrl(postUrlOrId, groupUrlOrId) {
    const cleaned = postUrlOrId.trim();
    // If it's already a full URL, convert it to mbasic
    if (cleaned.startsWith('http')) {
        return cleaned.replace(/(www|m)\.facebook\.com/, 'mbasic.facebook.com');
    }
    // If it's a numeric ID and we have the group ID
    if (/^\d+$/.test(cleaned) && groupUrlOrId) {
        const groupId = (0, socialListeningScraper_1.extractGroupId)(groupUrlOrId);
        return `https://mbasic.facebook.com/groups/${groupId}/permalink/${cleaned}/`;
    }
    // Fallback to direct ID query
    return `https://mbasic.facebook.com/${cleaned}`;
}
/**
 * Submits a comment or reply to a Facebook Group post/comment using mbasic and the user's Cookie.
 *
 * @param cookie Facebook account cookie.
 * @param postUrl Full post URL (e.g., permanent link).
 * @param text The comment text.
 * @param commentId Optional ID of the parent comment (if replying to a comment).
 * @returns boolean indicating success.
 */
async function postFacebookComment(cookie, postUrl, text, commentId) {
    if (!cookie) {
        throw new Error('Facebook Cookie is required to post a comment.');
    }
    const resolvedUrl = getMbasicUrl(postUrl);
    console.log(`[FB Reply Service] Fetching page: ${resolvedUrl}`);
    const axiosHeaders = {
        'Cookie': cookie,
        'User-Agent': MOBILE_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://mbasic.facebook.com/',
    };
    try {
        // 1. Fetch the story page
        const pageRes = await axios_1.default.get(resolvedUrl, {
            headers: axiosHeaders,
            timeout: 15000,
        });
        let html = pageRes.data;
        let $ = cheerio.load(html);
        let targetUrl = resolvedUrl;
        // 2. If replying to a specific comment, find the "Reply" link for that comment
        if (commentId) {
            console.log(`[FB Reply Service] Attempting to reply to comment: ${commentId}`);
            // Look for a link containing the commentId and "replies" or comment action URL
            let replyLink = '';
            // Match links containing "/comment/replies" or containing the comment ID
            $('a').each((_, el) => {
                const href = $(el).attr('href') || '';
                if (href.includes('/comment/replies') && href.includes(commentId)) {
                    replyLink = href;
                    return false; // break loop
                }
            });
            // Backup selector: any reply links
            if (!replyLink) {
                $('a').each((_, el) => {
                    const href = $(el).attr('href') || '';
                    if (href.includes('/comment/replies') && (href.includes('ctarget') || href.includes('gfid'))) {
                        // Check if this link is near the comment target
                        replyLink = href;
                    }
                });
            }
            if (replyLink) {
                const fullReplyUrl = replyLink.startsWith('http')
                    ? replyLink
                    : `https://mbasic.facebook.com${replyLink}`;
                console.log(`[FB Reply Service] Found comment reply page: ${fullReplyUrl}`);
                // Fetch the replies page containing the reply input form
                const replyPageRes = await axios_1.default.get(fullReplyUrl, {
                    headers: { ...axiosHeaders, Referer: resolvedUrl },
                    timeout: 10000,
                });
                html = replyPageRes.data;
                $ = cheerio.load(html);
                targetUrl = fullReplyUrl;
            }
            else {
                console.warn(`[FB Reply Service] Could not find reply link for comment: ${commentId}. Submitting as top-level post comment instead.`);
            }
        }
        // 3. Locate the comment form
        // On mbasic: form action usually starts with "/a/comment.php"
        let form = $('form[action^="/a/comment.php"]').first();
        if (!form.length) {
            form = $('form').filter((_, el) => {
                return $(el).find('input[name="fb_dtsg"]').length > 0;
            }).first();
        }
        if (!form.length) {
            // Check if page contains login prompt
            if (html.includes('login_form') || html.includes('/login.php') || html.includes('id="login_single_factor_form"')) {
                throw new Error('COOKIE_EXPIRED');
            }
            throw new Error('Could not find Facebook comment input form. The cookie might not have permission or page layout changed.');
        }
        const actionPath = form.attr('action') || '';
        const actionUrl = actionPath.startsWith('http')
            ? actionPath
            : `https://mbasic.facebook.com${actionPath}`;
        console.log(`[FB Reply Service] Found comment form action: ${actionUrl}`);
        // 4. Extract form fields
        const formData = new URLSearchParams();
        form.find('input[type="hidden"]').each((_, el) => {
            const name = $(el).attr('name');
            const val = $(el).attr('value') || '';
            if (name) {
                formData.append(name, val);
            }
        });
        // Check for comment text input
        let commentField = 'comment_text';
        const hasTextarea = form.find('textarea[name="comment_text"]').length > 0;
        const hasInput = form.find('input[name="comment_text"]').length > 0;
        if (!hasTextarea && !hasInput) {
            // Find any textarea or input text
            const alternative = form.find('textarea, input[type="text"]').first();
            const altName = alternative.attr('name');
            if (altName) {
                commentField = altName;
            }
        }
        formData.append(commentField, text);
        // Also append the submit button name if present (some forms expect it)
        const submitBtn = form.find('input[type="submit"]').first();
        const submitName = submitBtn.attr('name');
        const submitVal = submitBtn.attr('value') || 'Comment';
        if (submitName) {
            formData.append(submitName, submitVal);
        }
        // 5. Post comment
        console.log(`[FB Reply Service] Submitting comment payload...`);
        const postRes = await axios_1.default.post(actionUrl, formData.toString(), {
            headers: {
                ...axiosHeaders,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': targetUrl,
            },
            maxRedirects: 5,
            timeout: 20000,
        });
        // Verify successful comment posting
        // Usually facebook redirects to the post page (302) upon success.
        // If the response html still contains the same comment form, it might have failed.
        const postHtml = postRes.data;
        if (postRes.status === 200 && postHtml.includes('comment_text') && postHtml.includes('fb_dtsg')) {
            // Form is still shown, could be a captcha or rate limit or error
            if (postHtml.includes('captcha') || postHtml.includes('security check')) {
                throw new Error('Facebook requested security check (CAPTCHA). Comment blocked.');
            }
            if (postHtml.includes('temporary block') || postHtml.includes('chặn tạm thời')) {
                throw new Error('Facebook account temporarily blocked from commenting.');
            }
            console.warn('⚠️ [FB Reply Service] Comment form still visible in response. It might have failed or succeeded without redirect.');
        }
        console.log(`[FB Reply Service] Comment posted successfully to ${postUrl}`);
        return true;
    }
    catch (error) {
        if (error.message === 'COOKIE_EXPIRED' || error.response?.status === 401 || error.response?.status === 403) {
            throw new Error('COOKIE_EXPIRED');
        }
        console.error('❌ [FB Reply Service Error]:', error.response?.data || error.message);
        throw error;
    }
}
