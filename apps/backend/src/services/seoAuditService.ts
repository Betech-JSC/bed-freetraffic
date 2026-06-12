export interface AuditIssueInput {
  category: string;
  severity: string;
  message: string;
  suggestion?: string;
}

export async function runSeoAudit(url: string, targetKeyword?: string): Promise<{
  score: number;
  technicalScore: number;
  contentScore: number;
  uxScore: number;
  issues: AuditIssueInput[];
}> {
  const issues: AuditIssueInput[] = [];
  let technical = 100;
  let content = 100;
  let ux = 100;

  const t0 = Date.now();
  const res = await fetch(url, {
    headers: { 'User-Agent': 'FreeTrafficBot/1.0 SEO-Audit' },
    signal: AbortSignal.timeout(15000),
  });
  const loadMs = Date.now() - t0;

  if (!res.ok) {
    return {
      score: 0,
      technicalScore: 0,
      contentScore: 0,
      uxScore: 0,
      issues: [
        {
          category: 'technical',
          severity: 'CRITICAL',
          message: `HTTP ${res.status} — không truy cập được URL`,
          suggestion: 'Kiểm tra URL và máy chủ',
        },
      ],
    };
  }

  const html = await res.text();
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
  const metaDesc = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i
  )?.[1]?.trim();
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  const h2Count = (html.match(/<h2[\s>]/gi) || []).length;
  const imgWithoutAlt = (html.match(/<img(?![^>]*alt=)[^>]*>/gi) || []).length;
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const internalLinks = (html.match(/<a[^>]+href=["'](?!https?:\/\/|\/\/|#|mailto:|tel:)([^"']*)["']/gi) || [])
    .length;
  const htmlSizeKb = Math.round(html.length / 1024);

  if (!title || title.length < 10) {
    technical -= 15;
    issues.push({
      category: 'content',
      severity: 'CRITICAL',
      message: 'Thiếu hoặc title quá ngắn',
      suggestion: 'Thêm title 50–60 ký tự chứa từ khóa chính',
    });
  } else if (title.length > 60) {
    content -= 5;
    issues.push({
      category: 'content',
      severity: 'WARNING',
      message: 'Title dài hơn 60 ký tự',
      suggestion: 'Rút gọn title để hiển thị đầy đủ trên SERP',
    });
  }

  if (!metaDesc) {
    content -= 15;
    issues.push({
      category: 'content',
      severity: 'CRITICAL',
      message: 'Thiếu meta description',
      suggestion: 'Thêm meta description 120–160 ký tự',
    });
  }

  if (h1Count === 0) {
    content -= 10;
    issues.push({
      category: 'content',
      severity: 'WARNING',
      message: 'Không có thẻ H1',
      suggestion: 'Thêm một H1 duy nhất cho trang',
    });
  } else if (h1Count > 1) {
    content -= 5;
    issues.push({
      category: 'content',
      severity: 'INFO',
      message: `Có ${h1Count} thẻ H1`,
      suggestion: 'Nên chỉ dùng một H1 chính',
    });
  }

  if (imgWithoutAlt > 0) {
    technical -= Math.min(10, imgWithoutAlt * 2);
    issues.push({
      category: 'technical',
      severity: 'WARNING',
      message: `${imgWithoutAlt} ảnh thiếu alt`,
      suggestion: 'Thêm thuộc tính alt mô tả cho hình ảnh',
    });
  }

  if (!hasViewport) {
    ux -= 15;
    issues.push({
      category: 'ux',
      severity: 'WARNING',
      message: 'Thiếu meta viewport',
      suggestion: 'Thêm meta viewport cho mobile',
    });
  }

  if (loadMs > 3000) {
    technical -= 15;
    issues.push({
      category: 'technical',
      severity: 'WARNING',
      message: `Thời gian phản hồi ~${loadMs}ms (chậm)`,
      suggestion: 'Tối ưu hosting, nén ảnh, cache',
    });
  } else if (loadMs > 1500) {
    issues.push({
      category: 'technical',
      severity: 'INFO',
      message: `Thời gian phản hồi ~${loadMs}ms`,
      suggestion: 'Cân nhắc tối ưu thêm để dưới 1.5s',
    });
  }

  if (htmlSizeKb > 500) {
    technical -= 5;
    issues.push({
      category: 'technical',
      severity: 'INFO',
      message: `HTML ~${htmlSizeKb} KB (lớn)`,
      suggestion: 'Giảm markup/inline script không cần thiết',
    });
  }

  if (internalLinks < 3) {
    content -= 5;
    issues.push({
      category: 'content',
      severity: 'INFO',
      message: `Ít internal link (${internalLinks})`,
      suggestion: 'Thêm liên kết nội bộ tới trang quan trọng',
    });
  }

  if (h2Count === 0 && h1Count > 0) {
    content -= 5;
    issues.push({
      category: 'content',
      severity: 'INFO',
      message: 'Không có thẻ H2',
      suggestion: 'Chia nhỏ nội dung bằng H2, H3',
    });
  }

  // Word count and Target Keyword checks
  const textOnly = html
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = textOnly.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (wordCount < 300) {
    content -= 10;
    issues.push({
      category: 'content',
      severity: 'WARNING',
      message: `Nội dung trang quá ngắn (${wordCount} từ)`,
      suggestion: 'Bổ sung thêm nội dung trang web tối thiểu 500 từ để có chất lượng tốt hơn',
    });
  } else if (wordCount < 600) {
    issues.push({
      category: 'content',
      severity: 'INFO',
      message: `Độ dài nội dung ở mức trung bình (${wordCount} từ)`,
      suggestion: 'Nên mở rộng nội dung bài viết trên 600 từ để cải thiện SEO',
    });
  } else {
    issues.push({
      category: 'content',
      severity: 'INFO',
      message: `Độ dài bài viết rất tốt (${wordCount} từ)`,
      suggestion: 'Tuyệt vời, tiếp tục duy trì bài viết chất lượng dài',
    });
  }

  if (targetKeyword && targetKeyword.trim()) {
    const kw = targetKeyword.trim();
    const kwLower = kw.toLowerCase();

    // 1. Check Title
    const titleLower = (title || '').toLowerCase();
    if (!titleLower.includes(kwLower)) {
      content -= 10;
      issues.push({
        category: 'content',
        severity: 'WARNING',
        message: `Từ khóa mục tiêu "${kw}" không xuất hiện trong Title`,
        suggestion: 'Thêm từ khóa mục tiêu vào tiêu đề của trang',
      });
    }

    // 2. Check H1
    const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m =>
      m[1].replace(/<[^>]+>/g, '').trim().toLowerCase()
    );
    const h1HasKeyword = h1s.some(h1Text => h1Text.includes(kwLower));
    if (h1Count > 0 && !h1HasKeyword) {
      content -= 10;
      issues.push({
        category: 'content',
        severity: 'WARNING',
        message: `Từ khóa mục tiêu "${kw}" không xuất hiện trong thẻ H1`,
        suggestion: 'Thêm từ khóa mục tiêu vào thẻ H1 chính',
      });
    }

    // 3. Check Meta Description
    if (metaDesc) {
      const descLower = metaDesc.toLowerCase();
      if (!descLower.includes(kwLower)) {
        content -= 8;
        issues.push({
          category: 'content',
          severity: 'WARNING',
          message: `Từ khóa mục tiêu "${kw}" không xuất hiện trong Meta Description`,
          suggestion: 'Tối ưu meta description chứa từ khóa mục tiêu',
        });
      }
    }

    // 4. Check First 150 Words
    const first150Words = words.slice(0, 150).join(' ').toLowerCase();
    if (!first150Words.includes(kwLower)) {
      content -= 7;
      issues.push({
        category: 'content',
        severity: 'WARNING',
        message: `Từ khóa mục tiêu "${kw}" không xuất hiện ở 150 từ đầu tiên`,
        suggestion: 'Thêm từ khóa mục tiêu vào đoạn giới thiệu của trang',
      });
    }

    // 5. Keyword Density
    const escapedKw = kwLower.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const kwMatches = textOnly.toLowerCase().match(new RegExp(escapedKw, 'g')) || [];
    const kwWordsCount = kw.split(/\s+/).filter(Boolean).length;
    const keywordDensity = wordCount > 0 ? (kwMatches.length * kwWordsCount / wordCount) * 100 : 0;

    if (keywordDensity < 0.5) {
      content -= 5;
      issues.push({
        category: 'content',
        severity: 'INFO',
        message: `Mật độ từ khóa mục tiêu quá thấp (${keywordDensity.toFixed(2)}%)`,
        suggestion: `Tăng số lần xuất hiện từ khóa "${kw}" trong nội dung (đề xuất 0.5% - 2.5%)`,
      });
    } else if (keywordDensity > 3.0) {
      content -= 5;
      issues.push({
        category: 'content',
        severity: 'WARNING',
        message: `Mật độ từ khóa mục tiêu quá cao (${keywordDensity.toFixed(2)}% — Spam)`,
        suggestion: `Giảm bớt tần suất lặp từ khóa "${kw}" để tránh bị Google phạt lỗi nhồi nhét từ khóa`,
      });
    } else {
      issues.push({
        category: 'content',
        severity: 'INFO',
        message: `Mật độ từ khóa mục tiêu lý tưởng (${keywordDensity.toFixed(2)}%)`,
        suggestion: `Duy trì mật độ này để tối ưu hóa tìm kiếm`,
      });
    }
  }

  const score = Math.max(0, Math.round((technical + content + ux) / 3));

  return {
    score,
    technicalScore: Math.max(0, technical),
    contentScore: Math.max(0, content),
    uxScore: Math.max(0, ux),
    issues,
  };
}
