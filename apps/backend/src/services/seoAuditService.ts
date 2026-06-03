export interface AuditIssueInput {
  category: string;
  severity: string;
  message: string;
  suggestion?: string;
}

export async function runSeoAudit(url: string): Promise<{
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

  const score = Math.max(0, Math.round((technical + content + ux) / 3));

  return {
    score,
    technicalScore: Math.max(0, technical),
    contentScore: Math.max(0, content),
    uxScore: Math.max(0, ux),
    issues,
  };
}
