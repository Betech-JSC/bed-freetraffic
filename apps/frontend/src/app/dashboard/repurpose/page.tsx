'use client';

import React, { useState, useEffect } from 'react';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLocale } from '@/context/LocaleContext';

type BlogPost = {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  content: string;
  createdAt: string;
};

type RepurposeResponse = {
  facebook?: string;
  linkedin?: string;
  zalo?: string;
  tiktok?: string;
};

export default function RepurposePage() {
  const { t } = useLocale();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  
  // Selection states
  const [sourceType, setSourceType] = useState<'blog' | 'url' | 'text'>('blog');
  const [selectedPostId, setSelectedPostId] = useState<string>('');
  const [url, setUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['facebook', 'linkedin']);
  
  // App states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<RepurposeResponse | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<string>('facebook');
  const [editedResults, setEditedResults] = useState<Record<string, string>>({});
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // Fetch blog posts if sourceType is 'blog'
  useEffect(() => {
    if (sourceType === 'blog' && posts.length === 0) {
      setLoadingPosts(true);
      apiJson<BlogPost[]>('/blog')
        .then((data) => {
          setPosts(data);
          if (data.length > 0) {
            setSelectedPostId(String(data[0].id));
          }
        })
        .catch((err) => {
          console.error('Lỗi tải bài viết blog:', err);
        })
        .finally(() => {
          setLoadingPosts(false);
        });
    }
  }, [sourceType, posts.length]);

  const togglePlatform = (platform: string) => {
    if (platforms.includes(platform)) {
      if (platforms.length > 1) {
        setPlatforms(platforms.filter(p => p !== platform));
      }
    } else {
      setPlatforms([...platforms, platform]);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResults(null);
    setLoading(true);
    setCopySuccess(null);

    const payload: any = {
      sourceType,
      platforms,
    };

    if (sourceType === 'blog') {
      if (!selectedPostId) {
        setError('Vui lòng chọn một bài viết Blog');
        setLoading(false);
        return;
      }
      payload.sourceId = parseInt(selectedPostId, 10);
    } else if (sourceType === 'url') {
      if (!url.trim()) {
        setError('Vui lòng nhập đường dẫn URL hợp lệ');
        setLoading(false);
        return;
      }
      payload.url = url.trim();
    } else {
      if (!textContent.trim()) {
        setError('Vui lòng nhập nội dung văn bản nguồn');
        setLoading(false);
        return;
      }
      payload.textContent = textContent.trim();
    }

    try {
      const data = await apiJson<RepurposeResponse>('/repurpose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setResults(data);
      setEditedResults(data);
      // Select the first generated platform as active tab
      const keys = Object.keys(data);
      if (keys.length > 0) {
        setActiveResultTab(keys[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra trong quá trình xử lý AI.');
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (platform: string, text: string) => {
    setEditedResults(prev => ({
      ...prev,
      [platform]: text
    }));
  };

  const copyToClipboard = (text: string, platform: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(platform);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">AI Social Repurposer</h1>
          <p className="text-gray-500 mt-1">Tự động xé nhỏ bài viết hoặc nội dung website thành bài đăng đa kênh mạng xã hội.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Inputs */}
        <div className="lg:col-span-5 bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Nguồn nội dung</label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-gray-50 rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() => setSourceType('blog')}
                className={`py-2 text-xs font-medium rounded-lg transition-all ${
                  sourceType === 'blog'
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Bài viết Blog
              </button>
              <button
                type="button"
                onClick={() => setSourceType('url')}
                className={`py-2 text-xs font-medium rounded-lg transition-all ${
                  sourceType === 'url'
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Đường dẫn URL
              </button>
              <button
                type="button"
                onClick={() => setSourceType('text')}
                className={`py-2 text-xs font-medium rounded-lg transition-all ${
                  sourceType === 'text'
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Văn bản thô
              </button>
            </div>
          </div>

          <form onSubmit={handleGenerate} className="space-y-6">
            {sourceType === 'blog' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Chọn bài viết Blog</label>
                {loadingPosts ? (
                  <div className="h-10 bg-gray-50 border border-gray-200 rounded-xl animate-pulse flex items-center justify-center">
                    <span className="text-xs text-gray-400">Đang tải danh sách bài viết...</span>
                  </div>
                ) : posts.length === 0 ? (
                  <div className="p-3 text-center border border-dashed border-gray-200 rounded-xl">
                    <p className="text-xs text-gray-500">Chưa có bài viết Blog nào. Hãy chọn nguồn khác.</p>
                  </div>
                ) : (
                  <select
                    value={selectedPostId}
                    onChange={(e) => setSelectedPostId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                  >
                    {posts.map((post) => (
                      <option key={post.id} value={post.id}>
                        {post.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {sourceType === 'url' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Đường dẫn URL bài viết</label>
                <input
                  type="url"
                  placeholder="https://example.com/blog-post-detail"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                />
                <p className="text-[11px] text-gray-400 mt-1">Growth OS sẽ tự động crawl và loại bỏ mã HTML của bài viết.</p>
              </div>
            )}

            {sourceType === 'text' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Nhập nội dung văn bản nguồn</label>
                <textarea
                  rows={6}
                  placeholder="Nhập hoặc dán nội dung bài viết, ý tưởng thô cần chuyển đổi tại đây..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors resize-none"
                />
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[11px] text-gray-400">Độ dài tối đa đề xuất: 10,000 ký tự</span>
                  <span className="text-[11px] text-gray-400">{textContent.length} ký tự</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Chọn kênh đích truyền thông</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'facebook', label: 'Facebook Post', desc: 'Có emoji, CTA, cấu trúc lôi cuốn' },
                  { id: 'linkedin', label: 'LinkedIn Article', desc: 'Chuyên nghiệp, kiến thức, hashtags' },
                  { id: 'zalo', label: 'Zalo Message', desc: 'Ngắn gọn, súc tích dưới 150 từ' },
                  { id: 'tiktok', label: 'TikTok Video Script', desc: 'Kịch bản thoại, cảnh quay, giật tít' },
                ].map((item) => {
                  const selected = platforms.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => togglePlatform(item.id)}
                      className={`flex flex-col items-start p-3 text-left border rounded-xl transition-all ${
                        selected
                          ? 'border-amber-500 bg-amber-50/20 ring-1 ring-amber-500'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={selected}
                          readOnly
                          className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                        />
                        <span className="text-sm font-medium text-gray-900">{item.label}</span>
                      </div>
                      <span className="text-[11px] text-gray-400 mt-1.5 leading-snug">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs flex items-center space-x-2">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2 ${
                loading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>AI đang xé nhỏ bài đăng...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  <span>Xử lý & Sáng tạo bài đăng</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Side: Generated Output Preview & Edit */}
        <div className="lg:col-span-7 space-y-6">
          {!results && !loading && (
            <div className="h-full min-h-[450px] bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4 text-amber-500 ring-4 ring-amber-50/50">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-800">Chưa có kết quả xé nhỏ</h3>
              <p className="text-gray-400 max-w-sm text-sm mt-1">Cung cấp nguồn bài đăng và chọn các nền tảng mạng xã hội bên trái để bắt đầu tạo nội dung tiếp thị hàng loạt.</p>
            </div>
          )}

          {loading && (
            <div className="h-full min-h-[450px] bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col items-center justify-center p-8 text-center animate-pulse">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mb-4 text-amber-600 animate-spin">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5M4 4a9 9 0 0115.356-2" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-700">AI đang phân tích và sáng tạo nội dung...</h3>
              <p className="text-gray-400 text-xs mt-1.5 max-w-xs">Quá trình này có thể mất từ 10 - 20 giây phụ thuộc vào độ dài nội dung nguồn của bạn.</p>
            </div>
          )}

          {results && !loading && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full min-h-[480px]">
              {/* Result Tabs */}
              <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
                <div className="flex space-x-2">
                  {Object.keys(results).map((platform) => {
                    const isActive = activeResultTab === platform;
                    return (
                      <button
                        key={platform}
                        onClick={() => setActiveResultTab(platform)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all border ${
                          isActive
                            ? 'bg-gray-900 border-gray-900 text-white shadow-sm'
                            : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        {platform}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => copyToClipboard(editedResults[activeResultTab] || '', activeResultTab)}
                    className="flex items-center space-x-1.5 py-1.5 px-3 bg-white border border-gray-200 hover:border-gray-300 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-900 transition-all shadow-sm"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    <span>{copySuccess === activeResultTab ? 'Đã sao chép!' : 'Sao chép'}</span>
                  </button>
                </div>
              </div>

              {/* Textarea workspace */}
              <div className="flex-1 p-6 flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Bản thảo bài đăng ({activeResultTab})
                  </span>
                  <span className="text-xs text-gray-400">
                    Bạn có thể chỉnh sửa trực tiếp bên dưới trước khi sao chép
                  </span>
                </div>
                <textarea
                  className="w-full flex-1 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 transition-colors text-gray-700 leading-relaxed min-h-[300px] resize-none"
                  value={editedResults[activeResultTab] || ''}
                  onChange={(e) => handleTextChange(activeResultTab, e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
