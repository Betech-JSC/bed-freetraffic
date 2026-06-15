'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiJson, getAuthToken } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import Link from 'next/link';

// Custom SVG Icons for Corporate Aesthetic
const FileTextIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const GlobeIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
  </svg>
);

const TrashIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const EyeIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const RefreshIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
  </svg>
);

const UploadCloudIcon = ({ className = "w-10 h-10 text-orange-500/80 mb-3" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

const SearchIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const ArrowLeftIcon = ({ className = "w-3.5 h-3.5 mr-1" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const DatabaseIcon = ({ className = "w-5 h-5 text-orange-500/80 mr-2" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
  </svg>
);

const CloseIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

type CskhConfig = {
  id: number;
  liveChatEnabled: boolean;
  aiChatbotEnabled: boolean;
  knowledgeBaseText: string | null;
  notificationChannels: string | null;
  followUpDelayHours: number | null;
  followUpEmailSubject: string | null;
  followUpEmailBody: string | null;
  autoCareEnabled?: boolean;
  autoCareScheduleType?: string;
  autoCareDelayHours?: number;
  autoCareIntervalDays?: number;
  autoCareEmailSubject?: string | null;
  autoCareEmailBody?: string | null;
  autoCareChannels?: string | null;
};

type KnowledgeSource = {
  id: number;
  name: string;
  type: 'FILE' | 'URL' | 'TEXT';
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  fileSize: number | null;
  url: string | null;
  errorMessage: string | null;
  createdAt: string;
  _count?: {
    chunks: number;
  };
};

export default function KnowledgeBasePage() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [config, setConfig] = useState<CskhConfig | null>(null);
  const [knowledgeBaseText, setKnowledgeBaseText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  
  const [loadingSources, setLoadingSources] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [crawlingUrl, setCrawlingUrl] = useState(false);
  const [syncingSourceId, setSyncingSourceId] = useState<number | null>(null);
  const [resettingKnowledge, setResettingKnowledge] = useState(false);
  
  const [previewingSource, setPreviewingSource] = useState<KnowledgeSource | null>(null);
  const [previewText, setPreviewText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadConfig = useCallback(async () => {
    try {
      setLoadingConfig(true);
      const data = await apiJson<CskhConfig>('/cskh/config');
      if (data) {
        setConfig(data);
        setKnowledgeBaseText(data.knowledgeBaseText || '');
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải cấu hình tri thức doanh nghiệp.');
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  const loadSources = useCallback(async () => {
    try {
      setLoadingSources(true);
      const data = await apiJson<KnowledgeSource[]>('/cskh/knowledge/sources');
      if (data) {
        setSources(data);
      }
    } catch (err: any) {
      console.error('Lỗi tải danh sách tài liệu tri thức:', err);
    } finally {
      setLoadingSources(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadSources();
  }, [loadConfig, loadSources]);

  // Polling for processing sources
  useEffect(() => {
    const hasProcessing = sources.some(s => s.status === 'PROCESSING');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      loadSources();
    }, 3000);

    return () => clearInterval(interval);
  }, [sources, loadSources]);

  // Auto-dismiss success notification
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Auto-dismiss error notification
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSaveTextKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    try {
      setSavingConfig(true);
      setError('');
      setSuccess('');
      
      await apiJson('/cskh/config', {
        method: 'POST',
        body: JSON.stringify({
          ...config,
          knowledgeBaseText: knowledgeBaseText.trim()
        }),
      });

      setSuccess('Đã lưu chỉ dẫn tri thức doanh nghiệp thành công.');
      loadConfig();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu chỉ dẫn tri thức.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setError('Kích thước tệp quá lớn. Vui lòng tải lên tệp dưới 20MB.');
      e.target.value = '';
      return;
    }

    setUploadingFile(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = getAuthToken();
      const workspaceId = localStorage.getItem('workspaceId');
      
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? `${window.location.origin.replace(':3000', ':4000')}/api` : 'http://localhost:4000/api');
      const res = await fetch(`${baseUrl}/cskh/knowledge/upload`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'x-workspace-id': workspaceId || '',
        },
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Lỗi tải tệp tin tri thức');
      }

      setSuccess(result.message || 'Đã tải lên tài liệu thành công. Hệ thống đang đồng bộ tri thức...');
      loadSources();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải tài liệu lên.');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleCrawlWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || crawlingUrl) return;

    setCrawlingUrl(true);
    setError('');
    setSuccess('');

    try {
      const result = await apiJson<any>('/cskh/knowledge/crawl', {
        method: 'POST',
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      setSuccess(result.message || 'Đang đồng bộ dữ liệu website vào hệ thống tri thức...');
      setUrlInput('');
      loadSources();
    } catch (err: any) {
      setError(err.message || 'Lỗi đồng bộ dữ liệu từ URL.');
    } finally {
      setCrawlingUrl(false);
    }
  };

  const handleDeleteSource = async (id: number, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài liệu "${name}" không? Hệ thống RAG sẽ không sử dụng thông tin từ nguồn này.`)) return;
    setError('');
    setSuccess('');
    try {
      await apiJson(`/cskh/knowledge/sources/${id}`, { method: 'DELETE' });
      setSuccess(`Đã xóa thành công tài liệu: ${name}`);
      loadSources();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa tài liệu.');
    }
  };

  const handleReSyncSource = async (id: number) => {
    setError('');
    setSuccess('');
    try {
      setSyncingSourceId(id);
      await apiJson(`/cskh/knowledge/sources/${id}/re-sync`, { method: 'POST' });
      setSuccess('Đang cập nhật lại tài liệu...');
      loadSources();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi đồng bộ lại tài liệu.');
    } finally {
      setSyncingSourceId(null);
    }
  };

  const handlePreviewSource = async (source: KnowledgeSource) => {
    setError('');
    setSuccess('');
    try {
      setPreviewingSource(source);
      setPreviewText('Đang giải nén văn bản tri thức...');
      const res = await apiJson<{ extractedText: string }>(`/cskh/knowledge/sources/${source.id}/preview`);
      if (res) {
        setPreviewText(res.extractedText);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể lấy nội dung xem trước.');
      setPreviewingSource(null);
    }
  };

  const handleResetKnowledge = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ tri thức hiện tại không? Thao tác này sẽ xóa sạch tài liệu và liên kết website đã lưu.')) return;
    
    setResettingKnowledge(true);
    setError('');
    setSuccess('');

    try {
      await apiJson('/cskh/knowledge/reset', { method: 'POST' });
      setSuccess('Đã đặt lại và dọn sạch hệ thống tri thức doanh nghiệp.');
      setSources([]);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi đặt lại hệ thống tri thức.');
    } finally {
      setResettingKnowledge(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Upper Navigation Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <PageHeader 
          title="Hệ thống Tri thức Doanh nghiệp (RAG)" 
          description="Nạp dữ liệu tài liệu nội bộ hoặc đồng bộ website doanh nghiệp. AI sẽ tự động phân tích chạy ngầm làm cơ sở viết bài, lên kế hoạch và tư vấn chính xác." 
        />
        <Link
          href="/dashboard/cskh/settings"
          className="flex items-center px-4 py-2.5 bg-slate-55 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition duration-200 active:scale-[0.98] shrink-0"
        >
          <ArrowLeftIcon />
          Quay lại Cấu hình CSKH
        </Link>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex justify-between items-center shadow-sm animate-in fade-in duration-200">
          <span className="font-medium">{success}</span>
          <button onClick={() => setSuccess('')} className="text-emerald-500 hover:text-emerald-800 transition">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex justify-between items-center shadow-sm animate-in fade-in duration-200">
          <span className="font-semibold">{error}</span>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-800 transition">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Workspace Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Columns (2/3 Width): Chunks and Sources List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4 mb-5">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center">
                <DatabaseIcon />
                Tài liệu & Website đã đồng bộ ({sources.length})
              </h3>
              {sources.length > 0 && (
                <button
                  type="button"
                  onClick={handleResetKnowledge}
                  disabled={resettingKnowledge}
                  className="text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-100 hover:border-rose-200 font-bold flex items-center gap-1 transition duration-200 cursor-pointer disabled:opacity-50"
                >
                  <TrashIcon />
                  Xóa toàn bộ tri thức
                </button>
              )}
            </div>

            <div className="bg-slate-50/50 border border-slate-200/80 rounded-xl overflow-hidden min-h-[350px] max-h-[550px] overflow-y-auto">
              {loadingSources && sources.length === 0 ? (
                <div className="flex justify-center items-center py-28">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent"></div>
                </div>
              ) : sources.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-32 px-4 space-y-3">
                  <div className="p-3 bg-slate-100 rounded-2xl text-slate-400">
                    <DatabaseIcon className="w-8 h-8" />
                  </div>
                  <div className="text-slate-400 text-xs max-w-sm">
                    Chưa có tài liệu hay liên kết website nào được học. Sử dụng khung cấu hình bên phải để nạp dữ liệu tri thức mới cho doanh nghiệp.
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {sources.map((source) => (
                    <div key={source.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:bg-slate-100/30 transition duration-150">
                      <div className="space-y-1.5 pr-4 truncate flex-1">
                        <div className="flex items-center gap-2.5 truncate">
                          <span className="flex-shrink-0 p-1.5 bg-slate-100 rounded-lg text-slate-600" title={source.type === 'FILE' ? 'Tệp tài liệu' : 'Website URL'}>
                            {source.type === 'FILE' ? <FileTextIcon className="w-4 h-4" /> : <GlobeIcon className="w-4 h-4" />}
                          </span>
                          <span className="font-bold text-slate-800 text-sm truncate block" title={source.name}>
                            {source.name}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                          <span className="font-mono">
                            {source.type === 'FILE' && source.fileSize ? `${(source.fileSize / 1024).toFixed(1)} KB` : 'Website'}
                          </span>
                          <span>•</span>
                          <span>{new Date(source.createdAt).toLocaleDateString('vi-VN')}</span>
                          {source._count && (
                            <>
                              <span>•</span>
                              <span className="px-2 py-0.5 rounded-lg bg-orange-50 text-orange-600 font-bold font-mono border border-orange-100 text-[10px]">
                                {source._count.chunks} phân đoạn
                              </span>
                            </>
                          )}
                        </div>
                        {source.errorMessage && (
                          <div className="text-[10px] text-rose-600 font-medium leading-normal mt-2 bg-rose-50 border border-rose-100 rounded-lg px-3 py-1.5 whitespace-pre-line" title={source.errorMessage}>
                            Chi tiết lỗi: {source.errorMessage.slice(0, 150)}...
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                        {source.status === 'PROCESSING' && (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold flex items-center gap-1.5 animate-pulse">
                            <span className="animate-spin rounded-full h-3 w-3 border border-amber-700 border-t-transparent inline-block"></span>
                            Đang xử lý
                          </span>
                        )}
                        {source.status === 'COMPLETED' && (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold flex items-center gap-0.5">
                            Đã đồng bộ
                          </span>
                        )}
                        {source.status === 'FAILED' && (
                          <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold flex items-center gap-0.5">
                            Thất bại
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handlePreviewSource(source)}
                          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 rounded-xl transition duration-150"
                          title="Xem trước văn bản trích xuất"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReSyncSource(source.id)}
                          disabled={syncingSourceId === source.id || source.status === 'PROCESSING'}
                          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 disabled:opacity-40 rounded-xl transition duration-150"
                          title="Đồng bộ lại dữ liệu"
                        >
                          <RefreshIcon className={`w-4 h-4 ${syncingSourceId === source.id ? 'animate-spin text-orange-500' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSource(source.id, source.name)}
                          className="p-2 text-rose-550 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition duration-150"
                          title="Xóa tài liệu"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (1/3 Width): Upload File & Crawl Link & Quick Note */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            
            {/* Upload File Section */}
            <div className="space-y-2.5">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Tải tệp tài liệu tri thức</h3>
              <div className="relative border-2 border-dashed border-slate-200 hover:border-orange-500 rounded-2xl p-6 transition duration-200 bg-slate-50/40 hover:bg-orange-50/5 flex flex-col items-center justify-center cursor-pointer text-center group">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  disabled={uploadingFile}
                />
                <UploadCloudIcon className="w-8 h-8 text-slate-400 group-hover:text-orange-500 transition duration-200 mb-2" />
                <span className="text-xs font-bold text-slate-700 group-hover:text-slate-800 transition">
                  {uploadingFile ? 'Đang trích xuất văn bản...' : 'Kéo thả hoặc nhấp để chọn tệp'}
                </span>
                <span className="text-[10px] text-slate-400 mt-1">Hỗ trợ PDF, Word (.docx), Text (.txt) tối đa 20MB</span>
              </div>
            </div>

            {/* Sync URL Section */}
            <div className="space-y-2.5 pt-4 border-t border-slate-100">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Đồng bộ từ liên kết Website</h3>
              <form onSubmit={handleCrawlWebsite} className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://company.com/chinh-sach"
                  className="flex-1 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none transition duration-150 placeholder-slate-400"
                  disabled={crawlingUrl}
                  required
                />
                <button
                  type="submit"
                  disabled={crawlingUrl || !urlInput.trim()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-xs transition shadow-sm flex-shrink-0 cursor-pointer"
                >
                  {crawlingUrl ? 'Đang tải...' : 'Đồng bộ'}
                </button>
              </form>
            </div>

            {/* Quick Note (Text Knowledge) Section */}
            <div className="space-y-2.5 pt-4 border-t border-slate-100">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Chỉ dẫn tri thức & Ghi chú nhanh</h3>
              <textarea
                value={knowledgeBaseText}
                onChange={(e) => setKnowledgeBaseText(e.target.value)}
                placeholder="Nhập ghi chú nhanh về thông số kỹ thuật sản phẩm, chính sách bảo hành cập nhật tức thì..."
                rows={5}
                className="w-full bg-slate-55 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl p-3 text-slate-800 text-xs focus:outline-none transition duration-150 placeholder-slate-400 font-sans"
              />
              <button
                type="button"
                onClick={handleSaveTextKnowledge}
                disabled={savingConfig || loadingConfig}
                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 text-white text-xs font-bold rounded-xl transition duration-200 active:scale-[0.98] cursor-pointer shadow-sm shadow-orange-500/10"
              >
                {savingConfig ? 'Đang lưu...' : 'Lưu chỉ dẫn'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Preview Source Content */}
      {previewingSource && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="space-y-0.5 pr-4 truncate">
                <h3 className="font-bold text-slate-850 text-sm truncate flex items-center">
                  <SearchIcon className="w-4 h-4 mr-2 text-slate-500" />
                  Nội dung trích xuất tri thức
                </h3>
                <p className="text-slate-400 text-[11px] truncate font-mono">
                  {previewingSource.name}
                </p>
              </div>
              <button
                onClick={() => setPreviewingSource(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 shadow-inner">
              {previewText ? (
                <pre className="text-xs leading-relaxed text-slate-700 font-sans whitespace-pre-wrap select-text break-words">
                  {previewText}
                </pre>
              ) : (
                <p className="text-xs text-slate-400 text-center py-16">Tài liệu này không chứa bất kỳ nội dung văn bản nào.</p>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 flex justify-end bg-white">
              <button
                onClick={() => setPreviewingSource(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
