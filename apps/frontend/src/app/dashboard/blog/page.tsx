'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLocale } from '@/context/LocaleContext';

const SparklesIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.286L13 21l-2.286-6.857L5 12l5.714-2.286L13 3z" />
  </svg>
);

type BlogPost = {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  content: string;
  published: boolean;
  publishedAt: string | null;
  authorName: string;
  tags: string | null;
  createdAt: string;
  ogImageUrl?: string | null;
};

function BlogPageContent() {
  const { t } = useLocale();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // AI Writer states
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiUrl, setAiUrl] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [optimizeLoading, setOptimizeLoading] = useState(false);
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(true);

  // Form states for creation / editing
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [focusKeyword, setFocusKeyword] = useState('');
  const [form, setForm] = useState({
    title: '',
    slug: '',
    summary: '',
    content: '',
    authorName: 'Admin',
    tags: '',
    published: false,
    ogImageUrl: '',
  });

  const analyzeSeo = () => {
    const report = {
      score: 0,
      titleLength: form.title.length,
      summaryLength: form.summary.length,
      wordCount: form.content.split(/\s+/).filter(Boolean).length,
      hasH2: /##\s+.+/i.test(form.content),
      hasH3: /###\s+.+/i.test(form.content),
      hasLinks: /\[.+\]\(.+\)/i.test(form.content),
      hasImages: /!\[.+\]\(.+\)/i.test(form.content),
      keywordInTitle: false,
      keywordInSummary: false,
      keywordInContent: false,
      keywordDensity: 0,
      checklist: [] as { label: string; passed: boolean; tip: string }[]
    };

    // 1. Title Length Check (10-60 chars)
    const isTitleOk = report.titleLength >= 10 && report.titleLength <= 60;
    report.checklist.push({
      label: 'Độ dài tiêu đề bài viết',
      passed: isTitleOk,
      tip: isTitleOk 
        ? `Tốt (${report.titleLength} ký tự)` 
        : `Nên từ 10-60 ký tự (Hiện tại: ${report.titleLength} ký tự)`
    });
    if (isTitleOk) report.score += 15;

    // 2. Summary (Meta Desc) Length Check (50-160 chars)
    const isSummaryOk = report.summaryLength >= 50 && report.summaryLength <= 160;
    report.checklist.push({
      label: 'Độ dài SEO Meta Description',
      passed: isSummaryOk,
      tip: isSummaryOk 
        ? `Tốt (${report.summaryLength} ký tự)` 
        : `Nên từ 50-160 ký tự để hiển thị tốt trên Google (Hiện tại: ${report.summaryLength} ký tự)`
    });
    if (isSummaryOk) report.score += 15;

    // 3. Word Count Check (>= 300 words)
    const isWordCountOk = report.wordCount >= 300;
    report.checklist.push({
      label: 'Độ dài nội dung bài viết',
      passed: isWordCountOk,
      tip: isWordCountOk 
        ? `Tốt (${report.wordCount} từ)` 
        : `Nên có ít nhất 300 từ để đạt thứ hạng cao (Hiện tại: ${report.wordCount} từ)`
    });
    if (isWordCountOk) report.score += 10;
    else if (report.wordCount > 100) report.score += 5;

    // 4. Header Hierarchy (H2 / H3)
    const hasHeaders = report.hasH2 || report.hasH3;
    report.checklist.push({
      label: 'Sử dụng các thẻ Heading (H2, H3)',
      passed: hasHeaders,
      tip: hasHeaders 
        ? 'Tốt, cấu trúc bài viết rõ ràng' 
        : 'Nên sử dụng ## (H2) hoặc ### (H3) để phân chia các phần'
    });
    if (hasHeaders) report.score += 10;

    // 5. Links and Images
    const hasMedia = report.hasLinks || report.hasImages;
    report.checklist.push({
      label: 'Liên kết & Hình ảnh trực quan',
      passed: hasMedia,
      tip: hasMedia 
        ? 'Tốt, đã có ảnh hoặc liên kết' 
        : 'Nên chèn thêm liên kết hoặc hình ảnh minh họa để giữ chân người đọc'
    });
    if (hasMedia) report.score += 10;

    // Focus keyword checks
    if (focusKeyword.trim()) {
      const kw = focusKeyword.toLowerCase().trim();
      
      // Keyword in Title
      report.keywordInTitle = form.title.toLowerCase().includes(kw);
      report.checklist.push({
        label: `Từ khóa chính xuất hiện trong tiêu đề`,
        passed: report.keywordInTitle,
        tip: report.keywordInTitle 
          ? 'Tốt' 
          : `Thêm từ khóa "${focusKeyword}" vào tiêu đề của bạn`
      });
      if (report.keywordInTitle) report.score += 15;

      // Keyword in Meta Description
      report.keywordInSummary = form.summary.toLowerCase().includes(kw);
      report.checklist.push({
        label: `Từ khóa chính xuất hiện trong Meta Description`,
        passed: report.keywordInSummary,
        tip: report.keywordInSummary 
          ? 'Tốt' 
          : `Thêm từ khóa "${focusKeyword}" vào mô tả tóm tắt`
      });
      if (report.keywordInSummary) report.score += 10;

      // Keyword density
      const words = form.content.toLowerCase().split(/\s+/).filter(Boolean);
      const kwCount = form.content.toLowerCase().split(kw).length - 1;
      const density = words.length > 0 ? (kwCount / words.length) * 100 : 0;
      report.keywordDensity = Number(density.toFixed(2));

      const isDensityOk = density >= 0.5 && density <= 3.0;
      report.checklist.push({
        label: `Mật độ từ khóa chính (0.5% - 3%)`,
        passed: isDensityOk,
        tip: isDensityOk 
          ? `Tốt (${report.keywordDensity}%)` 
          : `Mật độ từ khóa chính nên từ 0.5% đến 3% (Hiện tại: ${report.keywordDensity}%, số lần lặp: ${kwCount})`
      });
      if (isDensityOk) report.score += 15;
      else if (kwCount > 0) report.score += 5;
    } else {
      // Default tips if no focus keyword provided
      report.checklist.push({
        label: 'Nhập từ khóa chính để tối ưu hóa SEO sâu hơn',
        passed: false,
        tip: 'Hãy điền "Từ khóa chính" ở ô bên cạnh để kiểm tra từ khóa'
      });
    }

    return report;
  };

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiJson<BlogPost[]>('/blog');
      setPosts(Array.isArray(data) ? data : []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách bài viết.');
    } finally {
      setLoading(false);
    }
  }, []);

  const searchParams = useSearchParams();

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    const keyword = searchParams.get('keyword');
    const title = searchParams.get('title');
    if (keyword || title) {
      setIsEditing(true);
      setSelectedPostId(null);
      setForm((prev) => ({
        ...prev,
        title: title || '',
        slug: title ? title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-') : '',
      }));
      if (keyword) {
        setFocusKeyword(keyword);
        setAiPrompt(`Viết bài chuẩn SEO cho từ khóa: "${keyword}". Tiêu đề gợi ý: "${title || ''}"`);
        setShowAiModal(true);
      }
    }
  }, [searchParams]);

  const handleCreateNew = () => {
    setIsEditing(true);
    setSelectedPostId(null);
    setForm({
      title: '',
      slug: '',
      summary: '',
      content: '',
      authorName: 'Admin',
      tags: '',
      published: false,
      ogImageUrl: '',
    });
    setUseKnowledgeBase(true);
  };

  const handleEdit = (post: BlogPost) => {
    setIsEditing(true);
    setSelectedPostId(post.id);
    setForm({
      title: post.title,
      slug: post.slug,
      summary: post.summary || '',
      content: post.content,
      authorName: post.authorName,
      tags: post.tags || '',
      published: post.published,
      ogImageUrl: post.ogImageUrl || '',
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) return;
    try {
      await apiJson(`/blog/${id}`, { method: 'DELETE' });
      setSuccess('Đã xóa bài viết thành công.');
      loadPosts();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa bài viết.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.slug || !form.content) {
      setError('Vui lòng nhập đầy đủ Tiêu đề, Đường dẫn và Nội dung.');
      return;
    }

    try {
      if (selectedPostId) {
        await apiJson(`/blog/${selectedPostId}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        setSuccess('Cập nhật bài viết thành công.');
      } else {
        await apiJson('/blog', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        setSuccess('Tạo bài viết mới thành công.');
      }
      setIsEditing(false);
      loadPosts();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu bài viết.');
    }
  };

  const togglePublish = async (post: BlogPost) => {
    try {
      await apiJson(`/blog/${post.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...post,
          published: !post.published,
        }),
      });
      setSuccess(`Đã ${!post.published ? 'xuất bản' : 'gỡ'} bài viết thành công.`);
      loadPosts();
    } catch (err: any) {
      setError(err.message || 'Lỗi thay đổi trạng thái xuất bản.');
    }
  };

  const handleAiGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiUrl.trim()) {
      setAiError(t('URL đích là bắt buộc'));
      return;
    }
    setAiLoading(true);
    setAiError('');
    try {
      const res = await apiJson<{
        title: string;
        content: string;
        slug?: string;
        metaDescription?: string;
        isDemo: boolean;
      }>('/templates/generate-ai', {
        method: 'POST',
        body: JSON.stringify({
          urlTarget: aiUrl.trim(),
          aiPrompt: aiPrompt.trim() || undefined,
          contentType: 'blog',
          generateImage: false,
          useKnowledgeBase,
        }),
      });

      setForm((prev) => ({
        ...prev,
        title: res.title || prev.title,
        slug: res.slug || prev.slug,
        summary: res.metaDescription || prev.summary,
        content: res.content || prev.content,
      }));
      
      if (focusKeyword.trim() === '' && res.title) {
        const guessedKw = aiPrompt.trim() || res.title.split(' ').slice(0, 2).join(' ');
        setFocusKeyword(guessedKw);
      }
      
      setShowAiModal(false);
      setAiUrl('');
      setAiPrompt('');
    } catch (err: any) {
      setAiError(err.message || t('Lỗi tạo bài viết bằng AI'));
    } finally {
      setAiLoading(false);
    }
  };

  const handleOptimizeSeo = async () => {
    if (!focusKeyword.trim()) {
      setError(t('Vui lòng điền Từ khóa chính để hệ thống phân tích tối ưu.'));
      return;
    }
    setOptimizeLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await apiJson<{
        title: string;
        slug: string;
        metaDescription: string;
        content: string;
        isDemo: boolean;
      }>('/templates/optimize-seo', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          slug: form.slug,
          metaDescription: form.summary,
          content: form.content,
          focusKeyword: focusKeyword.trim()
        }),
      });

      setForm({
        title: res.title,
        slug: res.slug,
        summary: res.metaDescription,
        content: res.content,
        authorName: form.authorName,
        tags: form.tags,
        published: form.published,
        ogImageUrl: form.ogImageUrl,
      });

      setSuccess(t('Tự động tối ưu SEO bằng AI thành công! Điểm SEO đã được cập nhật.'));
    } catch (err: any) {
      setError(err.message || t('Lỗi tối ưu SEO bằng AI'));
    } finally {
      setOptimizeLoading(false);
    }
  };

  // Automatically suggest a slug based on title
  useEffect(() => {
    if (!selectedPostId && form.title) {
      const slugified = form.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      setForm((prev) => ({ ...prev, slug: slugified }));
    }
  }, [form.title, selectedPostId]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader title="Quản lý CMS Blog (SEO)" description="Tạo và xuất bản bài viết chất lượng cao để kéo traffic tự nhiên." />
        {!isEditing && (
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-[#f25c22] hover:bg-[#d94d1a] text-white rounded-lg transition duration-200 shadow-md font-semibold text-sm flex items-center gap-2"
          >
            Tạo bài viết mới
          </button>
        )}
      </div>

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm flex justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="hover:text-white text-xs font-semibold">Đóng</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="hover:text-white text-xs font-semibold">Đóng</button>
        </div>
      )}

      {isEditing ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Editor Form */}
          <form onSubmit={handleSave} className="lg:col-span-2 card p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800">
                {selectedPostId ? t('Chỉnh sửa bài viết') : t('Viết bài mới')}
              </h3>
              {!selectedPostId && (
                <button
                  type="button"
                  onClick={() => { setShowAiModal(true); setAiError(''); setUseKnowledgeBase(true); }}
                  className="text-xs font-bold text-white px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#f25c22] to-[#ff7a45] hover:from-[#d94d1a] hover:to-[#f25c22] shadow-[0_4px_12px_rgba(242, 92, 34, 0.25)] transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <SparklesIcon />
                  {t('Viết bằng AI 🤖')}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="label">Tiêu đề bài viết</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Nhập tiêu đề hấp dẫn..."
                  className="input"
                />
              </div>

              <div className="space-y-1">
                <label className="label">Đường dẫn thân thiện (URL Slug)</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="vi-du-duong-dan-bai-viet"
                  className="input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="label">Tác giả</label>
                <input
                  type="text"
                  value={form.authorName}
                  onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                  className="input"
                />
              </div>

              <div className="space-y-1">
                <label className="label">Tags (ngăn cách bởi dấu phẩy)</label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="seo, marketing, traffic"
                  className="input"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="label">Mô tả tóm tắt (SEO Meta Description)</label>
              <textarea
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="Nhập mô tả tóm tắt bài viết giúp thu hút người đọc trên Google Search..."
                rows={2}
                className="input"
              />
            </div>

            {selectedPostId && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ảnh chia sẻ MXH (OpenGraph Image)</label>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setError('');
                        setSuccess('');
                        const res = await apiJson<{ success: boolean; ogImageUrl: string }>('/og-image/generate', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ type: 'blog', id: selectedPostId }),
                        });
                        if (res.success) {
                          setForm(f => ({ ...f, ogImageUrl: res.ogImageUrl }));
                          setSuccess('Đã tạo ảnh chia sẻ OpenGraph thành công!');
                          loadPosts();
                        }
                      } catch (err: any) {
                        setError(err.message || 'Lỗi tạo ảnh OpenGraph');
                      }
                    }}
                    className="py-1.5 px-3 bg-[#e85d26] hover:bg-[#d84d16] text-white rounded-lg text-xs font-semibold transition-all shadow-sm flex items-center space-x-1 cursor-pointer"
                  >
                    <span>🪄 Sinh ảnh bìa AI</span>
                  </button>
                </div>

                {form.ogImageUrl ? (
                  <div className="space-y-2">
                    <div className="relative aspect-[1.91/1] w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                      <img
                        src={`http://localhost:4000${form.ogImageUrl}`}
                        alt="OpenGraph Sharing Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      Xem trước: http://localhost:4000/api/og-image/public/blog/{selectedPostId}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Chưa tạo ảnh OpenGraph cho bài viết này. Hãy click nút ở trên để tự động vẽ ảnh bìa bằng AI dựa trên tiêu đề.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <div className="flex justify-between items-center mb-1">
                <label className="label mb-0">Nội dung bài viết (Hỗ trợ Markdown)</label>
                <span className="text-[10px] text-slate-400">Mẹo: Sử dụng # cho Heading, * cho In nghiêng, ** cho In đậm</span>
              </div>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Nhập nội dung bài viết bằng Markdown..."
                rows={12}
                className="input font-mono text-xs"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="published"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
                className="h-4 w-4 border-slate-350 rounded accent-[#f25c22] cursor-pointer"
              />
              <label htmlFor="published" className="text-xs font-semibold text-slate-600 select-none cursor-pointer">
                Xuất bản bài viết này lên trang chủ ngay lập tức
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="btn-secondary px-5 py-2"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="btn-primary px-6 py-2"
              >
                Lưu bài viết
              </button>
            </div>
          </form>

          {/* Real-time SEO Analyzer Sidebar */}
          <div className="card p-6 space-y-6 self-start bg-white border border-slate-200 shadow-sm rounded-2xl">
            <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              📊 Trợ lý SEO On-page Real-time
            </h3>

            {/* Focus Keyword Input & Auto-Optimize */}
            <div className="space-y-1.5">
              <label className="label text-xs font-bold text-slate-500 uppercase tracking-wider">Từ khóa chính (Focus Keyword)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={focusKeyword}
                  onChange={(e) => setFocusKeyword(e.target.value)}
                  placeholder="Nhập từ khóa chính để kiểm tra..."
                  className="input text-xs flex-1"
                  disabled={optimizeLoading}
                />
                <button
                  type="button"
                  onClick={handleOptimizeSeo}
                  className="px-3.5 py-2 text-white text-[11px] font-bold rounded-xl bg-gradient-to-r from-[#f25c22] to-[#ff7a45] hover:from-[#d94d1a] hover:to-[#f25c22] shadow-[0_4px_10px_rgba(242,92,34,0.15)] active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                  disabled={optimizeLoading || !focusKeyword.trim()}
                  title={t('Tự động tối ưu hóa nội dung chuẩn SEO dựa trên từ khóa chính')}
                >
                  {optimizeLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>🪄 {t('Tối ưu SEO')}</>
                  )}
                </button>
              </div>
            </div>

            {/* Score Gauge */}
            {(() => {
              const seoReport = analyzeSeo();
              const scoreColor = seoReport.score >= 80 
                ? 'text-emerald-600 border-emerald-500 bg-emerald-500/10' 
                : seoReport.score >= 50 
                ? 'text-amber-600 border-amber-500 bg-amber-500/10' 
                : 'text-rose-600 border-rose-500 bg-rose-500/10';
              
              return (
                <div className="flex flex-col items-center justify-center py-2 border-b border-slate-100 pb-4">
                  <div className={`w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-350 ${scoreColor}`}>
                    <span className="text-3xl font-extrabold">{seoReport.score}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider">SEO Score</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-600 mt-3">
                    {seoReport.score >= 80 ? '🎉 Tối ưu rất tốt!' : seoReport.score >= 50 ? '⚡ Khá tốt, cần cải thiện thêm' : '⚠️ Cần tối ưu hóa thêm'}
                  </p>
                </div>
              );
            })()}

            {/* Checklist items */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Danh mục SEO cần tối ưu</h4>
              <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                {analyzeSeo().checklist.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs">
                    <span className={`text-sm shrink-0 font-bold ${item.passed ? 'text-emerald-500' : 'text-rose-400'}`}>
                      {item.passed ? '✓' : '⚠'}
                    </span>
                    <div className="space-y-0.5">
                      <span className={`font-bold block ${item.passed ? 'text-slate-700' : 'text-slate-500'}`}>{item.label}</span>
                      <span className="text-[10px] text-slate-400 leading-normal block">{item.tip}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full flex justify-center py-12 text-slate-400 text-sm font-semibold">
              Đang tải bài viết...
            </div>
          ) : posts.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-white border border-orange-100 rounded-2xl p-8 flex flex-col items-center shadow-sm">
              <h4 className="text-slate-800 font-bold mb-1 text-base">Chưa có bài viết nào</h4>
              <p className="text-slate-500 text-xs mb-4">Hãy bắt đầu tạo bài viết blog đầu tiên chuẩn SEO của bạn.</p>
              <button
                onClick={handleCreateNew}
                className="px-4 py-2 bg-[#f25c22]/10 hover:bg-[#f25c22]/20 border border-[#f25c22]/30 text-[#f25c22] rounded-lg transition text-xs font-semibold"
              >
                Tạo bài viết
              </button>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="card card-hover overflow-hidden flex flex-col justify-between">
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-center gap-2">
                    <span className={`px-2.5 py-0.5 text-[10px] rounded-full font-bold uppercase tracking-wider ${post.published ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/10'}`}>
                      {post.published ? 'Đã xuất bản' : 'Bản nháp'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">{new Date(post.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <h4 className="font-bold text-slate-850 text-base line-clamp-2 hover:text-[#f25c22] cursor-pointer transition-colors" onClick={() => handleEdit(post)}>
                    {post.title}
                  </h4>
                  <p className="text-slate-500 text-xs leading-relaxed line-clamp-3">
                    {post.summary || 'Không có mô tả tóm tắt.'}
                  </p>
                  {post.tags && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {post.tags.split(',').map((tag, idx) => (
                        <span key={idx} className="bg-orange-50 text-brand text-[10px] px-2 py-0.5 rounded border border-orange-100/50 font-bold">
                          #{tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="px-5 py-3.5 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => togglePublish(post)}
                      className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded border transition-all ${post.published ? 'hover:bg-amber-100/50 border-amber-200 text-amber-700 bg-amber-50/40' : 'hover:bg-emerald-100/50 border-emerald-200 text-emerald-700 bg-emerald-50/40'}`}
                      title={post.published ? 'Gỡ xuất bản' : 'Xuất bản'}
                    >
                      {post.published ? 'Gỡ' : 'Đăng'}
                    </button>
                    <a
                      href={`/api/public/blog/posts/${post.slug}/html`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-bold uppercase border border-slate-200 hover:bg-slate-50 text-slate-500 px-2.5 py-1 rounded transition-all"
                    >
                      Xem
                    </a>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(post)}
                      className="text-slate-600 hover:text-slate-900 text-[10px] font-bold uppercase px-2.5 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-all"
                      title="Sửa"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="text-rose-600 hover:bg-rose-50 text-[10px] font-bold uppercase px-2.5 py-1 rounded transition-all border border-transparent hover:border-rose-100"
                      title="Xóa"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      {/* AI Writer Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg flex flex-col shadow-2xl border border-slate-100 overflow-hidden transform transition-all scale-100">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-orange-50/50 to-amber-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-[#f25c22] to-[#ff7a45] shadow-sm">
                  <SparklesIcon />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">{t('Viết bài mới bằng AI')}</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">{t('Tự động cào dữ liệu và soạn thảo nội dung chuẩn SEO.')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 transition-colors flex items-center justify-center text-slate-400 hover:text-slate-600 font-bold cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAiGenerate} className="p-6 space-y-4">
              {aiError && (
                <div className="rounded-xl bg-red-50 text-red-700 p-3 text-xs border border-red-100">
                  {aiError}
                </div>
              )}

              <div className="space-y-1">
                <label className="label text-xs font-bold text-slate-500">{t('URL đích (Website cần viết bài)')} <span className="text-red-500">*</span></label>
                <input
                  type="url"
                  className="input text-xs"
                  placeholder="Ví dụ: https://mywebsite.com/product"
                  value={aiUrl}
                  onChange={(e) => setAiUrl(e.target.value)}
                  required
                  disabled={aiLoading}
                />
              </div>

              <div className="space-y-1">
                <label className="label text-xs font-bold text-slate-500">{t('Ý tưởng / Yêu cầu bổ sung cho AI (Tùy chọn)')}</label>
                <textarea
                  className="input text-xs"
                  placeholder="Ví dụ: Tập trung viết về thế mạnh X, phong cách viết vui tươi, chèn từ khóa SEO chính là 'tự động hóa marketing'..."
                  rows={3}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  disabled={aiLoading}
                />
              </div>


              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="btn-secondary text-xs px-4 py-2"
                  disabled={aiLoading}
                >
                  {t('Hủy bỏ')}
                </button>
                <button
                  type="submit"
                  className="text-white text-xs font-bold px-4 py-2 rounded-xl bg-gradient-to-r from-[#f25c22] to-[#ff7a45] hover:from-[#d94d1a] hover:to-[#f25c22] shadow-[0_4px_12px_rgba(242, 92, 34, 0.25)] transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  disabled={aiLoading}
                >
                  {aiLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t('AI đang viết bài...')}
                    </>
                  ) : (
                    <>
                      <SparklesIcon />
                      {t('Tạo bài bằng AI 🤖')}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BlogPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-450">Đang tải trang quản lý bài viết...</div>}>
      <BlogPageContent />
    </Suspense>
  );
}
