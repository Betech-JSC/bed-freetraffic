"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAiPostContent = generateAiPostContent;
exports.generateAiImage = generateAiImage;
exports.generateAiContentPlan = generateAiContentPlan;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ai_1 = require("../lib/ai");
async function generateAiPostContent(urlTarget, aiPrompt) {
    const ai = (0, ai_1.getAiConfig)('/chat/completions');
    if (!ai.apiKey) {
        throw new Error('Chưa cấu hình OPENAI_API_KEY trong file .env');
    }
    const systemInstructions = `Bạn là chuyên gia marketing chuyên viết bài quảng cáo mạng xã hội (Facebook, Zalo) bằng tiếng Việt với mục tiêu tối ưu tỷ lệ nhấp chuột (CTR).
Nhiệm vụ của bạn là phân tích URL đích và định hướng/chủ đề từ người dùng (nếu có) để tạo ra tiêu đề và nội dung bài viết lôi cuốn theo công thức AIDA (Attention - Gây chú ý, Interest - Tạo hứng thú, Desire - Khơi gợi khao khát, Action - Kêu gọi hành động).

Quy tắc viết bài:
1. Tiêu đề (title): Phải thật giật gân, khơi gợi tò mò hoặc giải quyết trực tiếp vấn đề của khách hàng, có sử dụng emoji phù hợp.
2. Nội dung (content):
   - Bắt đầu bằng một câu mở đầu gây chú ý mạnh mẽ (câu hỏi nhức nhối hoặc một thực tế gây sốc).
   - Trình bày các điểm nổi bật dưới dạng danh sách gạch đầu dòng rõ ràng, trực quan.
   - Luôn chèn placeholder '{url}' ở vị trí tự nhiên nhất để hướng người đọc click vào liên kết.
   - Có lời kêu gọi hành động (CTA) rõ ràng ở cuối.
   - Thêm 3-5 hashtag liên quan ở dưới cùng.
3. TRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON HỢP LỆ với 2 thuộc tính duy nhất: "title" và "content".
4. KHÔNG bao bọc chuỗi JSON bằng thẻ code markdown như \`\`\`json. Hãy trả về text JSON thô để có thể chạy JSON.parse() trực tiếp.`;
    const userPrompt = `URL đích: ${urlTarget}
${aiPrompt ? `Chủ đề/Yêu cầu viết bài: ${aiPrompt}` : 'Hãy tự suy nghĩ chủ đề thu hút nhất liên quan đến URL đích.'}`;
    try {
        const res = await fetch(ai.url, {
            method: 'POST',
            headers: ai.headers,
            body: JSON.stringify({
                model: ai.model,
                messages: [
                    { role: 'system', content: systemInstructions },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.8,
                max_tokens: 600,
            }),
            signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`OpenAI API returned status ${res.status}: ${errText}`);
        }
        const data = (await res.json());
        const contentText = data.choices?.[0]?.message?.content?.trim() || '';
        // Parse JSON
        try {
            const parsed = JSON.parse(contentText);
            return {
                title: parsed.title || 'Bài viết tự động',
                content: parsed.content || 'Khám phá ngay tại {url}',
            };
        }
        catch {
            // Fallback if AI didn't return clean JSON
            console.warn('AI did not return valid JSON, using raw text fallback:', contentText);
            return {
                title: 'Bài viết tự sinh',
                content: contentText || 'Khám phá thêm tại {url}',
            };
        }
    }
    catch (err) {
        console.error('Lỗi khi gọi OpenAI GPT:', err);
        throw err;
    }
}
async function translateToEnglishImagePrompt(prompt) {
    try {
        const ai = (0, ai_1.getAiConfig)('/chat/completions');
        if (!ai.apiKey)
            return prompt;
        const res = await fetch(ai.url, {
            method: 'POST',
            headers: ai.headers,
            body: JSON.stringify({
                model: ai.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a professional image prompt translator and optimizer. If the user input is in Vietnamese, translate it to clear, descriptive English for text-to-image AI (Stable Diffusion/Flux). If it is already in English, keep/improve it. Output ONLY the translated/improved English text, with no preamble, no explanations, and no quotes.'
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 80
            }),
            signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
            const data = await res.json();
            let result = data.choices?.[0]?.message?.content?.trim();
            if (result && !result.includes('{') && result.length > 2) {
                if (result.startsWith('"') && result.endsWith('"')) {
                    result = result.slice(1, -1);
                }
                if (result.startsWith("'") && result.endsWith("'")) {
                    result = result.slice(1, -1);
                }
                return result.trim();
            }
        }
    }
    catch (e) {
        console.error('Failed to translate/optimize image prompt to English:', e);
    }
    return prompt;
}
function getSafeCategory(prompt) {
    const clean = prompt.toLowerCase();
    if (clean.includes('công nghệ') ||
        clean.includes('tech') ||
        clean.includes('phần mềm') ||
        clean.includes('hệ thống') ||
        clean.includes('ai') ||
        clean.includes('robot') ||
        clean.includes('digital') ||
        clean.includes('số hóa') ||
        clean.includes('computer') ||
        clean.includes('lập trình') ||
        clean.includes('developer') ||
        clean.includes('mạng') ||
        clean.includes('cloud') ||
        clean.includes('future') ||
        clean.includes('tương lai')) {
        return 'technology';
    }
    if (clean.includes('marketing') ||
        clean.includes('bán hàng') ||
        clean.includes('quảng cáo') ||
        clean.includes('sales') ||
        clean.includes('seo') ||
        clean.includes('ctr') ||
        clean.includes('quảng bá') ||
        clean.includes('thị trường') ||
        clean.includes('ads') ||
        clean.includes('lead') ||
        clean.includes('email') ||
        clean.includes('zalo') ||
        clean.includes('facebook') ||
        clean.includes('social') ||
        clean.includes('truyền thông')) {
        return 'marketing';
    }
    if (clean.includes('tài chính') ||
        clean.includes('tiền') ||
        clean.includes('doanh thu') ||
        clean.includes('đầu tư') ||
        clean.includes('finance') ||
        clean.includes('thanh toán') ||
        clean.includes('ví') ||
        clean.includes('ngân hàng') ||
        clean.includes('bank') ||
        clean.includes('giao dịch') ||
        clean.includes('chi phí') ||
        clean.includes('lợi nhuận')) {
        return 'finance';
    }
    if (clean.includes('học') ||
        clean.includes('đào tạo') ||
        clean.includes('education') ||
        clean.includes('sách') ||
        clean.includes('trường') ||
        clean.includes('study') ||
        clean.includes('khóa học') ||
        clean.includes('tri thức') ||
        clean.includes('kiến thức') ||
        clean.includes('cẩm nang')) {
        return 'education';
    }
    return 'business';
}
async function generateAiImage(imagePrompt) {
    const ai = (0, ai_1.getAiConfig)('/images/generations');
    try {
        const englishPrompt = await translateToEnglishImagePrompt(imagePrompt);
        console.log(`[AI Image] Original: "${imagePrompt}" -> Translated/Optimized: "${englishPrompt}"`);
        // If API key is not set or is an OpenRouter key, route to AI Horde with Flickr+Preset fallbacks!
        if (!ai.apiKey || ai.apiKey.startsWith('sk-or-')) {
            const stylizedPrompt = `flat minimal vector illustration of ${englishPrompt.slice(0, 200)}, clean minimalist design, professional corporate marketing graphic art, orange and warm color scheme, white background`;
            console.log(`[AI Image] Querying AI Horde with prompt: "${stylizedPrompt}"`);
            let buffer = null;
            let generateSuccess = false;
            try {
                const queueRes = await fetch('https://stablehorde.net/api/v2/generate/async', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': '0000000000',
                        'Client-Agent': 'free-traffic-system:1.0:github'
                    },
                    body: JSON.stringify({
                        prompt: stylizedPrompt,
                        params: {
                            n: 1,
                            width: 512,
                            height: 512,
                            steps: 20,
                            sampler_name: 'k_euler',
                            cfg_scale: 7
                        },
                        models: ["stable_diffusion"]
                    }),
                    signal: AbortSignal.timeout(15000)
                });
                if (queueRes.ok) {
                    const queueData = await queueRes.json();
                    const jobId = queueData.id;
                    if (jobId) {
                        console.log(`[AI Image] AI Horde job submitted successfully. Job ID: ${jobId}. Polling...`);
                        // Poll up to 15 times (45 seconds)
                        for (let i = 0; i < 15; i++) {
                            await new Promise(resolve => setTimeout(resolve, 3000));
                            const checkRes = await fetch(`https://stablehorde.net/api/v2/generate/check/${jobId}`, {
                                headers: { 'Client-Agent': 'free-traffic-system:1.0:github' },
                                signal: AbortSignal.timeout(8000)
                            });
                            if (checkRes.ok) {
                                const checkData = await checkRes.json();
                                console.log(`[AI Image] Horde Poll ${i + 1}: done=${checkData.done}, wait_time=${checkData.wait_time}s`);
                                if (checkData.done) {
                                    const statusRes = await fetch(`https://stablehorde.net/api/v2/generate/status/${jobId}`, {
                                        headers: { 'Client-Agent': 'free-traffic-system:1.0:github' },
                                        signal: AbortSignal.timeout(10000)
                                    });
                                    if (statusRes.ok) {
                                        const statusData = await statusRes.json();
                                        if (statusData.generations && statusData.generations.length > 0) {
                                            const imgData = statusData.generations[0].img;
                                            if (imgData) {
                                                if (imgData.startsWith('data:') || imgData.includes(';base64,')) {
                                                    // Base64 image
                                                    const base64Data = imgData.split(';base64,').pop() || imgData;
                                                    buffer = Buffer.from(base64Data, 'base64');
                                                    generateSuccess = true;
                                                    console.log(`[AI Image] AI Horde successfully returned base64 image!`);
                                                }
                                                else if (imgData.startsWith('http')) {
                                                    // URL image
                                                    console.log(`[AI Image] AI Horde returned image URL: ${imgData}. Downloading...`);
                                                    const downloadRes = await fetch(imgData, { signal: AbortSignal.timeout(15000) });
                                                    if (downloadRes.ok) {
                                                        const arrayBuffer = await downloadRes.arrayBuffer();
                                                        buffer = Buffer.from(arrayBuffer);
                                                        generateSuccess = true;
                                                        console.log(`[AI Image] AI Horde image downloaded successfully!`);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            catch (err) {
                console.error(`[AI Image] AI Horde process failed or timed out:`, err);
            }
            // If AI Horde succeeded, save it and return
            if (generateSuccess && buffer) {
                const uploadsDir = path_1.default.join(__dirname, '../../uploads');
                if (!fs_1.default.existsSync(uploadsDir)) {
                    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
                }
                const filename = `ai-${Date.now()}-${Math.floor(Math.random() * 10000)}.webp`;
                const filepath = path_1.default.join(uploadsDir, filename);
                fs_1.default.writeFileSync(filepath, buffer);
                return `/uploads/${filename}`;
            }
            // --- FALLBACK (LoremFlickr + local preset fallback) ---
            console.warn(`[AI Image] AI Horde failed or timed out. Falling back to Flickr...`);
            const category = getSafeCategory(imagePrompt);
            console.log(`[AI Image] Classified category: "${category}" for prompt: "${imagePrompt}"`);
            const searchUrl = `https://loremflickr.com/800/600/illustration,${category}/all`;
            console.log(`[AI Image] Fetching from LoremFlickr: ${searchUrl}`);
            let imgRes = null;
            try {
                imgRes = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });
            }
            catch (e) {
                console.error(`[AI Image] LoremFlickr fetch failed:`, e);
            }
            let usePresetFallback = true;
            let fallbackBuffer = null;
            if (imgRes && imgRes.ok) {
                const isDefaultCat = imgRes.url.includes('defaultImage') || imgRes.url.includes('defaultImage.small');
                if (!isDefaultCat) {
                    console.log(`[AI Image] LoremFlickr returned valid image: ${imgRes.url}. Downloading...`);
                    try {
                        const arrayBuffer = await imgRes.arrayBuffer();
                        fallbackBuffer = Buffer.from(arrayBuffer);
                        usePresetFallback = false;
                    }
                    catch (err) {
                        console.error(`[AI Image] Failed to read array buffer:`, err);
                    }
                }
                else {
                    console.warn(`[AI Image] LoremFlickr returned default cat fallback image.`);
                }
            }
            if (usePresetFallback) {
                console.log(`[AI Image] Using local preset fallback illustration for category: ${category}`);
                return `/uploads/presets/${category}.png`;
            }
            const uploadsDir = path_1.default.join(__dirname, '../../uploads');
            if (!fs_1.default.existsSync(uploadsDir)) {
                fs_1.default.mkdirSync(uploadsDir, { recursive: true });
            }
            const filename = `ai-${Date.now()}-${Math.floor(Math.random() * 10000)}.jpg`;
            const filepath = path_1.default.join(uploadsDir, filename);
            fs_1.default.writeFileSync(filepath, fallbackBuffer);
            return `/uploads/${filename}`;
        }
        // Generate image using DALL-E 2 for fast & cost-efficient generation
        const res = await fetch(ai.url, {
            method: 'POST',
            headers: ai.headers,
            body: JSON.stringify({
                model: 'dall-e-2',
                prompt: `Flat vector illustration of ${englishPrompt.slice(0, 200)}, clean minimalist design, professional corporate marketing graphic art, orange and warm color scheme, white background`,
                n: 1,
                size: '1024x1024',
            }),
            signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
            const errText = await res.text();
            console.error(`DALL-E API error: ${errText}`);
            return null;
        }
        const data = (await res.json());
        const tempUrl = data.data?.[0]?.url;
        if (!tempUrl)
            return null;
        // Download image and save to local uploads directory
        const imgRes = await fetch(tempUrl);
        if (!imgRes.ok)
            return null;
        const arrayBuffer = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const uploadsDir = path_1.default.join(__dirname, '../../uploads');
        if (!fs_1.default.existsSync(uploadsDir)) {
            fs_1.default.mkdirSync(uploadsDir, { recursive: true });
        }
        const filename = `ai-${Date.now()}-${Math.floor(Math.random() * 10000)}.jpg`;
        const filepath = path_1.default.join(uploadsDir, filename);
        fs_1.default.writeFileSync(filepath, buffer);
        return `/uploads/${filename}`;
    }
    catch (err) {
        console.error('Lỗi khi tạo ảnh với AI:', err);
        return null;
    }
}
async function generateAiContentPlan(topic, industry, tone, postCount = 5) {
    const ai = (0, ai_1.getAiConfig)('/chat/completions');
    if (!ai.apiKey) {
        // Fallback/Stubs for AI content plan when OPENAI_API_KEY is not configured
        const plan = [];
        const mockPosts = [
            {
                title: `🚀 Khởi đầu đột phá: Tối ưu ${topic} cho doanh nghiệp ${industry}`,
                content: `Bạn muốn nâng tầm doanh số trong lĩnh vực ${industry}? Khám phá giải pháp tự động hóa và tăng trưởng lưu lượng truy cập tối ưu tại {url}! Giọng điệu ${tone} đảm bảo chuyên nghiệp và hiệu quả.\n\n#${industry.toLowerCase()} #marketing #sales`,
                platform: 'facebook',
                suggestedTime: '09:00'
            },
            {
                title: `⚠️ 3 Sai lầm chí mạng khi triển khai ${topic}`,
                content: `Nhiều đơn vị trong ngành ${industry} vẫn đang mắc phải những sai lầm này. Đọc ngay bài viết phân tích chi tiết và cách khắc phục tại {url} để tránh lãng phí ngân sách!`,
                platform: 'email',
                suggestedTime: '12:00'
            },
            {
                title: `💡 Case Study: Tăng 200% doanh thu nhờ áp dụng ${topic}`,
                content: `Khám phá câu chuyện thành công thực tế của một doanh nghiệp trong ngành ${industry}. Xem chi tiết cách họ tối ưu quy trình và gặt hái kết quả tại {url}!\n\n#casestudy #growth`,
                platform: 'zalo',
                suggestedTime: '20:00'
            },
            {
                title: `🔥 Hướng dẫn từng bước: Làm chủ ${topic} trong 7 ngày`,
                content: `Cẩm nang chi tiết dành riêng cho các nhà quản lý trong lĩnh vực ${industry}. Bắt đầu hành trình chuyển đổi số của bạn ngay hôm nay tại {url}!`,
                platform: 'facebook',
                suggestedTime: '09:00'
            },
            {
                title: `🎁 Ưu đãi đặc biệt: Tư vấn miễn phí chiến lược ${topic}`,
                content: `Chỉ dành riêng cho 50 doanh nghiệp ${industry} đăng ký sớm nhất tuần này. Đặt lịch hẹn tư vấn miễn phí 1-1 cùng chuyên gia tại {url}!`,
                platform: 'email',
                suggestedTime: '12:00'
            }
        ];
        for (let i = 0; i < Math.min(postCount, mockPosts.length); i++) {
            plan.push({
                day: `Ngày ${i + 1}`,
                ...mockPosts[i]
            });
        }
        return plan;
    }
    const systemInstructions = `Bạn là một Giám đốc Marketing AI chuyên nghiệp, chuyên viết bài quảng cáo mạng xã hội (Facebook, Zalo, Email) bằng tiếng Việt với mục tiêu tối ưu tỷ lệ nhấp chuột (CTR) và tỷ lệ chuyển đổi.
Hãy tạo một kế hoạch nội dung đa kênh gồm ${postCount} ngày dựa trên chủ đề, ngành nghề và giọng điệu "${tone}" được cung cấp.

Mỗi ngày, hãy tạo một bài viết chất lượng cao phù hợp với kênh được đề xuất (facebook, email, zalo).
Quy tắc viết bài:
1. Nội dung phải đa dạng góc nhìn qua từng ngày:
   - Ngày giáo dục/chia sẻ kiến thức có giá trị.
   - Ngày vạch trần sai lầm hoặc phân tích case study thực tế.
   - Ngày khuyến mãi/ưu đãi giới hạn thời gian để chuyển đổi.
2. Bài viết phải cực kỳ lôi cuốn, viết theo công thức AIDA (Attention - Gây chú ý, Interest - Tạo hứng thú, Desire - Khơi gợi khao khát, Action - Kêu gọi hành động):
   - Tiêu đề (title): Phải thật giật gân, khơi gợi tò mò hoặc giải quyết trực tiếp vấn đề/nỗi đau của khách hàng, có sử dụng emoji phù hợp.
   - Nội dung (content):
     * Bắt đầu bằng một câu mở đầu gây chú ý mạnh mẽ (câu hỏi nhức nhối hoặc một thực tế gây sốc).
     * Trình bày các điểm nổi bật/giá trị dưới dạng danh sách gạch đầu dòng rõ ràng, trực quan để người đọc dễ quét thông tin, tránh viết một khối văn bản dài tẻ nhạt.
     * Luôn chèn placeholder '{url}' ở vị trí tự nhiên nhất để hướng người đọc click vào liên kết.
     * Luôn có lời kêu gọi hành động (CTA) rõ ràng, thôi thúc ở cuối.
     * Thêm 3-5 hashtag liên quan ở dưới cùng.
   - Tránh dùng các từ ngữ sáo rỗng, quá tâng bốc ("cách mạng", "tuyệt vời nhất", "hoàn hảo") để nội dung tự nhiên, chân thực và không bị "giả trân".
3. Trả về kết quả dưới dạng một MẢNG JSON HỢP LỆ (Array of Objects), mỗi đối tượng có định dạng:
   {
     "day": "Ngày X",
     "title": "Tiêu đề bài viết ngắn gọn và kích thích tò mò",
     "content": "Nội dung chi tiết lôi cuốn, chèn placeholder {url} và các hashtag liên quan ở cuối",
     "platform": "facebook" | "email" | "zalo",
     "suggestedTime": "HH:MM"
   }
KHÔNG bao bọc kết quả bằng thẻ code markdown như \`\`\`json. Hãy trả về text JSON thô.`;
    const userPrompt = `Chủ đề: ${topic}
Ngành nghề: ${industry}
Giọng điệu: ${tone}`;
    try {
        const res = await fetch(ai.url, {
            method: 'POST',
            headers: ai.headers,
            body: JSON.stringify({
                model: ai.model,
                messages: [
                    { role: 'system', content: systemInstructions },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.8,
                max_tokens: 2000,
            }),
            signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`OpenAI API returned status ${res.status}: ${errText}`);
        }
        const data = (await res.json());
        const contentText = data.choices?.[0]?.message?.content?.trim() || '[]';
        try {
            return JSON.parse(contentText);
        }
        catch {
            console.warn('AI plan did not return valid JSON, parsing raw text fallback:', contentText);
            throw new Error('AI không trả về đúng định dạng JSON kế hoạch.');
        }
    }
    catch (err) {
        console.error('Lỗi gọi OpenAI cho Copilot Plan:', err);
        throw err;
    }
}
