import { runSeoAudit } from './seoAuditService';

export interface PageSpeedAuditResult {
  score: number;
  technicalScore: number;
  contentScore: number;
  uxScore: number;
  issues: Array<{
    category: string;
    severity: string;
    message: string;
    suggestion?: string;
  }>;
}

export async function runPageSpeedAudit(targetUrl: string, targetKeyword?: string): Promise<PageSpeedAuditResult> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  
  // Query Performance, SEO, and Best Practices categories
  let url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(targetUrl)}&category=performance&category=seo&category=best-practices`;
  if (apiKey) {
    url += `&key=${apiKey}`;
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(60000), // PageSpeed can take up to 60s
    });

    if (!res.ok) {
      throw new Error(`Google PageSpeed API returned error: HTTP ${res.status}`);
    }

    const data = await res.json() as any;

    const lighthouse = data.lighthouseResult;
    if (!lighthouse || !lighthouse.categories) {
      throw new Error('Định dạng phản hồi PageSpeed không chính xác.');
    }

    // Extract categories
    const perfCategory = lighthouse.categories.performance;
    const seoCategory = lighthouse.categories.seo;
    const bestPracticesCategory = lighthouse.categories['best-practices'];

    // Map to local scores: Performance -> UX, Best Practices -> Technical, SEO -> Content
    const uxScore = perfCategory?.score != null ? Math.round(perfCategory.score * 100) : 70;
    const contentScore = seoCategory?.score != null ? Math.round(seoCategory.score * 100) : 70;
    const technicalScore = bestPracticesCategory?.score != null ? Math.round(bestPracticesCategory.score * 100) : 70;

    const score = Math.round((uxScore + contentScore + technicalScore) / 3);

    // Extract issues
    const issues: PageSpeedAuditResult['issues'] = [];
    const audits = lighthouse.audits || {};

    for (const key of Object.keys(audits)) {
      const audit = audits[key];
      if (audit && audit.score !== null && audit.score < 0.9) {
        // Classify severity
        const severity = audit.score < 0.5 ? 'CRITICAL' : 'WARNING';
        
        // Classify category mapping
        let category = 'technical';
        if (key.includes('seo') || key.includes('meta')) {
          category = 'content';
        } else if (key.includes('viewport') || key.includes('font') || key.includes('load') || key.includes('render')) {
          category = 'ux';
        }

        issues.push({
          category,
          severity,
          message: audit.title || key,
          suggestion: audit.description || undefined,
        });

        // Limit to top 15 issues to avoid cluttering DB
        if (issues.length >= 15) {
          break;
        }
      }
    }

    return {
      score,
      technicalScore,
      contentScore,
      uxScore,
      issues,
    };
  } catch (error: any) {
    console.error('PageSpeed Insights Audit failed:', error);
    try {
      // Fallback to local SEO Audit so the user gets real On-Page scores instead of a flat 50
      const localResult = await runSeoAudit(targetUrl, targetKeyword);
      return {
        score: localResult.score,
        technicalScore: localResult.technicalScore,
        contentScore: localResult.contentScore,
        uxScore: localResult.uxScore,
        issues: [
          {
            category: 'technical',
            severity: 'WARNING',
            message: 'Google PageSpeed Insights: Không thể kết nối với dịch vụ đo tốc độ tải trang (HTTP 429 / Rate Limit hoặc Timeout).',
            suggestion: 'Hệ thống đã tự động tính điểm dựa trên cấu trúc HTML (On-Page SEO) thực tế của website. Bạn có thể thử lại sau ít phút.',
          },
          ...localResult.issues,
        ],
      };
    } catch (fallbackError: any) {
      console.error('Fallback SEO Audit also failed:', fallbackError);
      // Return a default/failed result if both PageSpeed and local audit fail (e.g., website offline)
      return {
        score: 50,
        technicalScore: 50,
        contentScore: 50,
        uxScore: 50,
        issues: [
          {
            category: 'technical',
            severity: 'CRITICAL',
            message: `Lighthouse/PageSpeed Audit thất bại: ${error.message || error}`,
            suggestion: 'Kiểm tra xem URL có bị chặn bot của Google hay không.',
          },
        ],
      };
    }
  }
}
