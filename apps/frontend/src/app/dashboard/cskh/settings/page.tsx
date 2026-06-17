'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { io } from 'socket.io-client';
import Link from 'next/link';

type CskhConfig = {
  id: number;
  liveChatEnabled: boolean;
  aiChatbotEnabled: boolean;
  knowledgeBaseText: string | null;
  notificationChannels: string | null;
  followUpDelayHours: number | null;
  followUpEmailSubject: string | null;
  followUpEmailBody: string | null;
  followUpTemplate?: string | null;
  autoCareEnabled?: boolean;
  autoCareScheduleType?: string;
  autoCareDelayHours?: number;
  autoCareIntervalDays?: number;
  autoCareEmailSubject?: string | null;
  autoCareEmailBody?: string | null;
  autoCareTemplate?: string | null;
  autoCareChannels?: string | null;
  knowledgeFiles?: string | null;
  knowledgeUrls?: string | null;
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

type ChatMessage = {
  id: number;
  sessionId: string;
  sender: 'visitor' | 'bot' | 'agent';
  content: string;
  imageUrl?: string | null;
  createdAt: string;
};

type ChatSession = {
  id: string;
  workspaceId: number;
  customerId: number | null;
  customer?: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
  } | null;
  ipAddress: string | null;
  userAgent: string | null;
  followUpScheduledAt: string | null;
  followUpSent: boolean;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

const getFullImageUrl = (url: string | null | undefined) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const apiHost = process.env.NEXT_PUBLIC_API_URL 
    ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '') 
    : 'http://localhost:4000';
  return `${apiHost}${url}`;
};


export default function CskhSettingsPage() {
  const [activeTab, setActiveTab] = useState<'config' | 'history'>('config');
  const [config, setConfig] = useState<CskhConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [liveChatEnabled, setLiveChatEnabled] = useState(false);
  const [aiChatbotEnabled, setAiChatbotEnabled] = useState(false);
  const [knowledgeBaseText, setKnowledgeBaseText] = useState('');
  const [followUpDelayHours, setFollowUpDelayHours] = useState(0);
  const [followUpEmailSubject, setFollowUpEmailSubject] = useState('');
  const [followUpEmailBody, setFollowUpEmailBody] = useState('');

  const [knowledgeFiles, setKnowledgeFiles] = useState<any[]>([]);
  const [knowledgeUrls, setKnowledgeUrls] = useState<any[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [crawlingUrl, setCrawlingUrl] = useState(false);
  const [resettingKnowledge, setResettingKnowledge] = useState(false);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [previewingSource, setPreviewingSource] = useState<KnowledgeSource | null>(null);
  const [syncingSourceId, setSyncingSourceId] = useState<number | null>(null);


  // AI CRM Auto-care states
  const [autoCareEnabled, setAutoCareEnabled] = useState(false);
  const [autoCareScheduleType, setAutoCareScheduleType] = useState('AFTER_CREATION');
  const [autoCareDelayHours, setAutoCareDelayHours] = useState(24);
  const [autoCareIntervalDays, setAutoCareIntervalDays] = useState(7);
  const [autoCareEmailSubject, setAutoCareEmailSubject] = useState('');
  const [autoCareEmailBody, setAutoCareEmailBody] = useState('');
  const [autoCareChannelsState, setAutoCareChannelsState] = useState({
    email: true,
    zalo: false,
    messenger: false,
  });

  // Notification channels array
  const [channels, setChannels] = useState({
    email: false,
    slack: false,
    zalo: false,
    telegram: false,
  });

  // History states
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Agent takeover states
  const [agentReplyInput, setAgentReplyInput] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Real-time socket message synchronization
  useEffect(() => {
    if (activeTab !== 'history') return;

    const wsIdStr = typeof window !== 'undefined' ? localStorage.getItem('workspaceId') : null;
    const workspaceId = wsIdStr ? parseInt(wsIdStr, 10) : null;
    if (!workspaceId) return;

    const socketHost = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const socket = io(socketHost);

    socket.emit('join_workspace', workspaceId);

    if (activeSession) {
      socket.emit('join_session', activeSession.id);
    }

    socket.on('new_message', (msg: ChatMessage) => {
      // If we are currently viewing the session this message belongs to, append/update it
      if (activeSession && msg.sessionId === activeSession.id) {
        setSessionMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }

      // Also update the activeSession's last message or notify the session list!
      setSessions((prevSessions) => {
        return prevSessions
          .map((s) => {
            if (s.id === msg.sessionId) {
              return {
                ...s,
                updatedAt: new Date().toISOString(),
                messages: [msg], // Replace last message
              };
            }
            return s;
          })
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [activeSession, activeTab]);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiJson<CskhConfig>('/cskh/config');
      if (data) {
        setConfig(data);
        setLiveChatEnabled(data.liveChatEnabled);
        setAiChatbotEnabled(data.aiChatbotEnabled);
        setKnowledgeBaseText(data.knowledgeBaseText || '');
        setFollowUpDelayHours(data.followUpDelayHours || 0);
        setFollowUpEmailSubject(data.followUpEmailSubject || '');
        setFollowUpEmailBody(data.followUpEmailBody || '');
        
        // Parse knowledge files & urls
        try {
          setKnowledgeFiles(data.knowledgeFiles ? JSON.parse(data.knowledgeFiles) : []);
        } catch (e) {
          setKnowledgeFiles([]);
        }

        try {
          setKnowledgeUrls(data.knowledgeUrls ? JSON.parse(data.knowledgeUrls) : []);
        } catch (e) {
          setKnowledgeUrls([]);
        }
        
        // Parse channels
        const chString = data.notificationChannels || '';
        setChannels({
          email: chString.includes('email'),
          slack: chString.includes('slack'),
          zalo: chString.includes('zalo'),
          telegram: chString.includes('telegram'),
        });

        // Set auto care states
        setAutoCareEnabled(!!data.autoCareEnabled);
        setAutoCareScheduleType(data.autoCareScheduleType || 'AFTER_CREATION');
        setAutoCareDelayHours(data.autoCareDelayHours !== undefined ? Number(data.autoCareDelayHours) : 24);
        setAutoCareIntervalDays(data.autoCareIntervalDays !== undefined ? Number(data.autoCareIntervalDays) : 7);
        setAutoCareEmailSubject(data.autoCareEmailSubject || '');
        setAutoCareEmailBody(data.autoCareEmailBody || '');

        const autoChString = data.autoCareChannels || 'email';
        setAutoCareChannelsState({
          email: autoChString.includes('email'),
          zalo: autoChString.includes('zalo'),
          messenger: autoChString.includes('messenger'),
        });
      }
      setError('');
    } catch (err: any) {
      setError(err.message || 'Không thể tải cấu hình CSKH.');
    } finally {
      setLoading(false);
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
    if (activeTab === 'config' && aiChatbotEnabled) {
      loadSources();
    }
  }, [activeTab, aiChatbotEnabled, loadSources]);

  // Polling for processing sources
  useEffect(() => {
    const hasProcessing = sources.some(s => s.status === 'PROCESSING');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      loadSources();
    }, 3000);

    return () => clearInterval(interval);
  }, [sources, loadSources]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const data = await apiJson<ChatSession[]>('/cskh/sessions');
      if (data) {
        setSessions(data);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải lịch sử trò chuyện.');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  const loadSessionMessages = async (session: ChatSession) => {
    try {
      setActiveSession(session);
      setLoadingMessages(true);
      const data = await apiJson<ChatMessage[]>(`/cskh/sessions/${session.id}/messages`);
      if (data) {
        setSessionMessages(data);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải tin nhắn.');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa phiên chat này không?')) return;
    try {
      await apiJson(`/cskh/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSession?.id === sessionId) {
        setActiveSession(null);
        setSessionMessages([]);
      }
      setSuccess('Đã xóa phiên hội thoại thành công.');
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa phiên hội thoại.');
    }
  };

  const handleSendAgentReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !agentReplyInput.trim() || sendingReply) return;
    try {
      setSendingReply(true);
      const res = await apiJson<{ success: boolean; message: ChatMessage }>(`/cskh/sessions/${activeSession.id}/send-agent`, {
        method: 'POST',
        body: JSON.stringify({ content: agentReplyInput.trim() }),
      });
      if (res && res.message) {
        setSessionMessages(prev => [...prev, res.message]);
        setAgentReplyInput('');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi gửi tin nhắn của agent.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      
      // Construct notification channels string
      const chList = [];
      if (channels.email) chList.push('email');
      if (channels.slack) chList.push('slack');
      if (channels.zalo) chList.push('zalo');
      if (channels.telegram) chList.push('telegram');
      const notificationChannels = chList.join(',');

      // Construct autoCareChannels string
      const autoChList = [];
      if (autoCareChannelsState.email) autoChList.push('email');
      if (autoCareChannelsState.zalo) autoChList.push('zalo');
      if (autoCareChannelsState.messenger) autoChList.push('messenger');
      const autoCareChannelsStr = autoChList.join(',');

      await apiJson('/cskh/config', {
        method: 'POST',
        body: JSON.stringify({
          liveChatEnabled,
          aiChatbotEnabled,
          knowledgeBaseText,
          notificationChannels,
          followUpDelayHours: Number(followUpDelayHours),
          followUpEmailSubject,
          followUpEmailBody,
          // new fields
          autoCareEnabled,
          autoCareScheduleType,
          autoCareDelayHours: Number(autoCareDelayHours),
          autoCareIntervalDays: Number(autoCareIntervalDays),
          autoCareEmailSubject,
          autoCareEmailBody,
          autoCareChannels: autoCareChannelsStr,
        }),
      });

      setSuccess('Đã lưu cấu hình chăm sóc khách hàng tự động.');
      setError('');
      loadConfig();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu cấu hình.');
    } finally {
      setSaving(false);
    }
  };

  const handleChannelChange = (key: 'email' | 'slack' | 'zalo' | 'telegram', val: boolean) => {
    setChannels(prev => ({ ...prev, [key]: val }));
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

      const token = localStorage.getItem('token');
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

      setSuccess(result.message || 'Tải lên tài liệu thành công. Đang tiến hành phân tích và học...');
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

      setSuccess(result.message || 'Đang cào dữ liệu website và học tri thức...');
      setUrlInput('');
      loadSources();
    } catch (err: any) {
      setError(err.message || 'Lỗi cào dữ liệu từ URL.');
    } finally {
      setCrawlingUrl(false);
    }
  };

  const handleDeleteSource = async (id: number, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài liệu "${name}" không? AI sẽ không còn nhớ thông tin từ nguồn này.`)) return;
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
      setSuccess('Đang đồng bộ lại tài liệu...');
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
      setPreviewText('Đang tải nội dung văn bản tri thức...');
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
    if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ tri thức hiện tại không? Hành động này sẽ xóa sạch tài liệu và liên kết website đã học.')) return;
    
    setResettingKnowledge(true);
    setError('');
    setSuccess('');

    try {
      await apiJson('/cskh/knowledge/reset', { method: 'POST' });
      setSuccess('Đã đặt lại và xóa sạch tri thức doanh nghiệp.');
      setSources([]);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa tri thức.');
    } finally {
      setResettingKnowledge(false);
    }
  };


  const filteredSessions = sessions.filter(session => {
    const text = searchTerm.toLowerCase();
    const customerName = session.customer?.name?.toLowerCase() || '';
    const customerEmail = session.customer?.email?.toLowerCase() || '';
    const ip = session.ipAddress?.toLowerCase() || '';
    return customerName.includes(text) || customerEmail.includes(text) || ip.includes(text);
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <PageHeader 
        title="Chăm Sóc Khách Hàng & Chatbot AI" 
        description="Quản lý cấu hình chatbot trả lời trực tuyến, hẹn giờ tự động gửi thư hỏi thăm và theo dõi lịch sử tư vấn khách hàng." 
      />

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm flex justify-between shadow">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="hover:text-white">X</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm flex justify-between shadow">
          <span>{error}</span>
          <button onClick={() => setError('')} className="hover:text-white">X</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('config')}
          className={`py-3 px-5 font-semibold text-sm border-b-2 transition flex items-center gap-2 ${activeTab === 'config' ? 'border-[#f25c22] text-[#f25c22]' : 'border-transparent text-slate-400 hover:text-slate-800 hover:border-slate-300'}`}
        >
          Cấu hình Chatbot & Follow-up
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`py-3 px-5 font-semibold text-sm border-b-2 transition flex items-center gap-2 ${activeTab === 'history' ? 'border-[#f25c22] text-[#f25c22]' : 'border-transparent text-slate-400 hover:text-slate-800 hover:border-slate-300'}`}
        >
          Lịch sử trò chuyện Live Chat
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f25c22]"></div>
        </div>
      ) : activeTab === 'config' ? (
        <form onSubmit={handleSave} className="bg-white border-2 border-orange-500/10 rounded-2xl p-8 space-y-6 shadow-xl shadow-orange-500/5 relative overflow-hidden">
          {/* Top highlight bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#f25c22] to-amber-500"></div>

          {/* Live Chat Enable Toggle */}
          <div className="flex justify-between items-center border-b border-orange-100/50 pb-4">
            <div className="space-y-0.5">
              <h4 className="font-bold text-slate-800 text-sm">Kích hoạt Live Chat Widget</h4>
              <p className="text-slate-500 text-xs">Hiển thị bong bóng chat hỗ trợ trực tuyến góc phải bên dưới các trang Landing Page.</p>
              <div className="mt-1.5">
                <Link
                  href="/dashboard/cskh/widget-customizer"
                  className="text-xs font-bold text-[#f25c22] hover:underline flex items-center gap-1"
                >
                  ⚙️ Tùy chỉnh giao diện bong bóng & Lấy mã nhúng website ngoài
                </Link>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={liveChatEnabled}
                onChange={(e) => setLiveChatEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f25c22] peer-checked:after:bg-white"></div>
            </label>
          </div>

          {/* AI Chatbot Enable Toggle */}
          <div className="flex justify-between items-center border-b border-orange-100/50 pb-4">
            <div className="space-y-0.5">
              <h4 className="font-bold text-slate-800 text-sm">Trợ lý AI Chatbot trả lời tự động</h4>
              <p className="text-slate-500 text-xs">Cho phép AI tự động đọc hiểu câu hỏi và trả lời dựa trên tài liệu doanh nghiệp.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={aiChatbotEnabled}
                onChange={(e) => setAiChatbotEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f25c22] peer-checked:after:bg-white"></div>
            </label>
          </div>

          {/* AI Chatbot Knowledge Base Redirect */}
          {aiChatbotEnabled && (
            <>
              <div className="p-5 bg-orange-50 border border-orange-200/50 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs animate-fadeIn pb-6 border-b border-orange-100/50">
                <div className="space-y-1">
                  <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">📚 Quản lý Kho Tri thức Doanh nghiệp (RAG)</span>
                  <p className="text-slate-500">Tải lên các file tài liệu (.pdf, .docx, .txt) hoặc cào dữ liệu từ đường dẫn website để huấn luyện cho Trợ lý AI của bạn.</p>
                </div>
                <Link
                  href="/dashboard/cskh/knowledge"
                  className="px-4 py-2 bg-[#f25c22] hover:bg-[#d94d1a] text-white font-bold rounded-lg transition shadow-md whitespace-nowrap flex-shrink-0"
                >
                  Quản lý Tri thức (RAG) →
                </Link>
              </div>

              {/* AI Auto-Followup (Theo Dõi Khách Hàng) */}
              <div className="space-y-4 pt-4 border-t border-orange-100/50 animate-fadeIn">
                <h4 className="font-bold text-[#f25c22] text-sm uppercase tracking-wider">AI Auto-Followup (Theo Dõi Khách Hàng)</h4>
                <p className="text-slate-500 text-xs">AI tự động lên lịch gửi thư chăm sóc/theo dõi khách hàng sau khi cuộc trò chuyện live chat kết thúc.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase">Gửi sau khi kết thúc chat</label>
                    <select
                      value={followUpDelayHours}
                      onChange={(e) => setFollowUpDelayHours(Number(e.target.value))}
                      className="w-full bg-orange-50/20 border border-orange-200/60 focus:border-[#f25c22] rounded-lg p-2.5 text-slate-800 text-sm focus:outline-none transition"
                    >
                      <option value={0}>Tắt (Không tự động gửi)</option>
                      <option value={1}>Sau 1 giờ</option>
                      <option value={2}>Sau 2 giờ</option>
                      <option value={6}>Sau 6 giờ</option>
                      <option value={12}>Sau 12 giờ</option>
                      <option value={24}>Sau 24 giờ (1 ngày)</option>
                      <option value={48}>Sau 48 giờ (2 ngày)</option>
                    </select>
                  </div>
                </div>

                {followUpDelayHours > 0 && (
                  <>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase">Tiêu đề email theo dõi</label>
                      <input
                        type="text"
                        value={followUpEmailSubject}
                        onChange={(e) => setFollowUpEmailSubject(e.target.value)}
                        placeholder="Ví dụ: Cảm ơn bạn đã trò chuyện với Betech!"
                        className="w-full bg-orange-50/20 border border-orange-200/60 focus:border-[#f25c22] rounded-lg p-2.5 text-slate-800 text-sm focus:outline-none transition placeholder-slate-400"
                      />
                      <p className="text-[10px] text-slate-400">Hỗ trợ các placeholder: {"{{name}}"}, {"{{company}}"}, {"{{email}}"}.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase">Định hướng nội dung cho AI soạn thảo</label>
                      <textarea
                        value={followUpEmailBody}
                        onChange={(e) => setFollowUpEmailBody(e.target.value)}
                        placeholder="Ví dụ: Tóm tắt nội dung chính đã trao đổi và gửi thêm tài liệu về chủ đề khách hàng quan tâm..."
                        rows={4}
                        className="w-full bg-orange-50/20 border border-orange-200/60 focus:border-[#f25c22] rounded-lg p-3 text-slate-800 text-sm focus:outline-none transition placeholder-slate-400"
                      />
                      <p className="text-[10px] text-slate-400">AI sẽ tự động đọc lại lịch sử cuộc chat gần nhất để cá nhân hóa nội dung email cho khách hàng.</p>
                    </div>
                  </>
                )}
              </div>
            </>
          )}


          {/* AI CRM Auto-Care Settings */}
          <div className="space-y-4 pt-4 border-t border-orange-100/50">
            <h4 className="font-bold text-[#f25c22] text-sm uppercase tracking-wider">AI Bot Tự Động Chăm Sóc Khách Hàng (CRM Auto-Care)</h4>
            <p className="text-slate-500 text-xs">AI Bot tự động đọc thông tin chi tiết khách hàng và lịch sử ghi chú để tự động gửi email/tin nhắn chăm sóc.</p>
            
            <div className="flex justify-between items-center border-b border-orange-100/50 pb-4">
              <div className="space-y-0.5">
                <h4 className="font-bold text-slate-800 text-sm">Kích hoạt AI chăm sóc tự động</h4>
                <p className="text-slate-500 text-xs">Cho phép AI tự động quét danh sách khách hàng trong CRM và gửi tin nhắn định kỳ.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCareEnabled}
                  onChange={(e) => setAutoCareEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f25c22] peer-checked:after:bg-white"></div>
              </label>
            </div>

            {autoCareEnabled && (
              <div className="space-y-4 animate-fadeIn">
                {/* Channels select checkbox */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase">Kênh gửi tin nhắn chăm sóc</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-700 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoCareChannelsState.email}
                        onChange={(e) => setAutoCareChannelsState(prev => ({ ...prev, email: e.target.checked }))}
                        className="rounded border-slate-300 text-[#f25c22] focus:ring-[#f25c22]/35"
                      />
                      Email
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoCareChannelsState.zalo}
                        onChange={(e) => setAutoCareChannelsState(prev => ({ ...prev, zalo: e.target.checked }))}
                        className="rounded border-slate-300 text-[#f25c22] focus:ring-[#f25c22]/35"
                      />
                      Zalo
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoCareChannelsState.messenger}
                        onChange={(e) => setAutoCareChannelsState(prev => ({ ...prev, messenger: e.target.checked }))}
                        className="rounded border-slate-300 text-[#f25c22] focus:ring-[#f25c22]/35"
                      />
                      Messenger
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase">Loại lịch trình gửi</label>
                    <select
                      value={autoCareScheduleType}
                      onChange={(e) => setAutoCareScheduleType(e.target.value)}
                      className="w-full bg-orange-50/20 border border-orange-200/60 focus:border-[#f25c22] rounded-lg p-2.5 text-slate-800 text-sm focus:outline-none transition"
                    >
                      <option value="AFTER_CREATION">Gửi sau khi tạo khách hàng</option>
                      <option value="PERIODIC">Gửi định kỳ theo chu kỳ</option>
                    </select>
                  </div>

                  {autoCareScheduleType === 'AFTER_CREATION' ? (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase">Thời gian gửi sau khi tạo</label>
                      <select
                        value={autoCareDelayHours}
                        onChange={(e) => setAutoCareDelayHours(Number(e.target.value))}
                        className="w-full bg-orange-50/20 border border-orange-200/60 focus:border-[#f25c22] rounded-lg p-2.5 text-slate-800 text-sm focus:outline-none transition"
                      >
                        <option value={1}>Sau 1 giờ</option>
                        <option value={2}>Sau 2 giờ</option>
                        <option value={6}>Sau 6 giờ</option>
                        <option value={12}>Sau 12 giờ</option>
                        <option value={24}>Sau 24 giờ (1 ngày)</option>
                        <option value={48}>Sau 48 giờ (2 ngày)</option>
                        <option value={72}>Sau 72 giờ (3 ngày)</option>
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase">Chu kỳ gửi chăm sóc</label>
                      <select
                        value={autoCareIntervalDays}
                        onChange={(e) => setAutoCareIntervalDays(Number(e.target.value))}
                        className="w-full bg-orange-50/20 border border-orange-200/60 focus:border-[#f25c22] rounded-lg p-2.5 text-slate-800 text-sm focus:outline-none transition"
                      >
                        <option value={1}>Mỗi ngày một lần</option>
                        <option value={3}>3 ngày một lần</option>
                        <option value={7}>7 ngày một lần (1 tuần)</option>
                        <option value={14}>14 ngày một lần (2 tuần)</option>
                        <option value={30}>30 ngày một lần (1 tháng)</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase">Tiêu đề email/tin nhắn gửi đi</label>
                  <input
                    type="text"
                    value={autoCareEmailSubject}
                    onChange={(e) => setAutoCareEmailSubject(e.target.value)}
                    placeholder="Ví dụ: Chào {{name}}, giải pháp kinh doanh của bạn thế nào rồi?"
                    className="w-full bg-orange-50/20 border border-orange-200/60 focus:border-[#f25c22] rounded-lg p-2.5 text-slate-800 text-sm focus:outline-none transition placeholder-slate-400"
                  />
                  <p className="text-[10px] text-slate-400">Hỗ trợ các placeholder: {"{{name}}"}, {"{{company}}"}, {"{{email}}"}.</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase">Định hướng nội dung cho AI soạn thảo</label>
                  <textarea
                    value={autoCareEmailBody}
                    onChange={(e) => setAutoCareEmailBody(e.target.value)}
                    placeholder="Ví dụ: Hỏi thăm khách hàng dựa trên sản phẩm họ đã mua hoặc ghi chú chăm sóc cũ, đề xuất hỗ trợ hướng dẫn thiết lập hệ thống SEO..."
                    rows={4}
                    className="w-full bg-orange-50/20 border border-orange-200/60 focus:border-[#f25c22] rounded-lg p-3 text-slate-800 text-sm focus:outline-none transition placeholder-slate-400"
                  />
                  <p className="text-[10px] text-slate-400">AI sẽ tự động đọc hồ sơ chi tiết của khách hàng (Họ tên, ghi chú gần nhất, đơn hàng...) để soạn tin nhắn phù hợp nhất.</p>
                </div>
              </div>
            )}
          </div>

          {/* Notification Alert Channels */}
          <div className="space-y-3 pt-4 border-t border-orange-100/50">
            <h4 className="font-bold text-[#f25c22] text-sm uppercase tracking-wider">Kênh nhận thông báo cảnh báo tức thì</h4>
            <p className="text-slate-500 text-xs mb-3">Tự động báo tin cho Admin ngay khi Live Chatbot thu thập được Lead mới (Email, SĐT) thành công.</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div
                onClick={() => handleChannelChange('email', !channels.email)}
                className={`p-3 rounded-lg border cursor-pointer text-center transition text-xs ${channels.email ? 'bg-orange-500/10 border-orange-500/30 text-[#f25c22] font-bold' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/50'}`}
              >
                Email (SMTP)
              </div>
              <div
                onClick={() => handleChannelChange('slack', !channels.slack)}
                className={`p-3 rounded-lg border cursor-pointer text-center transition text-xs ${channels.slack ? 'bg-orange-500/10 border-orange-500/30 text-[#f25c22] font-bold' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/50'}`}
              >
                Slack Channel
              </div>
              <div
                onClick={() => handleChannelChange('zalo', !channels.zalo)}
                className={`p-3 rounded-lg border cursor-pointer text-center transition text-xs ${channels.zalo ? 'bg-orange-500/10 border-orange-500/30 text-[#f25c22] font-bold' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/50'}`}
              >
                Zalo Notification
              </div>
              <div
                onClick={() => handleChannelChange('telegram', !channels.telegram)}
                className={`p-3 rounded-lg border cursor-pointer text-center transition text-xs ${channels.telegram ? 'bg-orange-500/10 border-orange-500/30 text-[#f25c22] font-bold' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/50'}`}
              >
                Telegram Bot Alert
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-orange-100/50 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#f25c22] hover:bg-[#d94d1a] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-lg text-sm transition shadow-md flex items-center gap-2"
            >
              {saving ? (
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
              ) : 'Lưu cấu hình CSKH'}
            </button>
          </div>
        </form>
      ) : (
        /* Tab 2: Lịch sử cuộc trò chuyện */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white border-2 border-orange-500/10 rounded-2xl p-6 pt-8 shadow-xl shadow-orange-500/5 relative overflow-hidden min-h-[580px]">
          {/* Top highlight bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#f25c22] to-amber-500"></div>

          {/* Left panel: Session list */}
          <div className="md:col-span-1 border-r border-slate-100 pr-4 flex flex-col gap-4 relative z-10">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm tên, email, ip..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 pl-4 text-slate-800 text-xs focus:outline-none focus:border-[#f25c22] focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition placeholder-slate-400"
              />
            </div>

            {loadingHistory ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-[#f25c22]"></div>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">Không tìm thấy cuộc hội thoại nào.</div>
            ) : (
              <div className="overflow-y-auto space-y-2 flex-1 max-h-[480px]">
                {filteredSessions.map((session) => {
                  const hasCustomer = !!session.customer;
                  const lastMessage = session.messages?.[0]?.content || '(Trống)';
                  const isSelected = activeSession?.id === session.id;

                  return (
                    <div
                      key={session.id}
                      onClick={() => loadSessionMessages(session)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition ${isSelected ? 'bg-orange-50 border-orange-200 shadow-sm shadow-orange-500/5' : 'bg-white border-slate-100 hover:bg-orange-50/30 hover:border-orange-100'}`}
                    >
                      <div className="flex justify-between items-start">
                        <span className={`font-bold text-xs truncate max-w-[120px] ${isSelected ? 'text-[#f25c22]' : 'text-slate-800'}`}>
                          {hasCustomer ? session.customer?.name : 'Khách vãng lai'}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {new Date(session.updatedAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      
                      {hasCustomer && (
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{session.customer?.email}</p>
                      )}
                      
                      <p className="text-[11px] text-slate-600 truncate mt-1.5 italic">"{lastMessage}"</p>
                      
                      {/* Follow up status badge */}
                      <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-slate-100">
                        <span className="text-[8px] text-slate-400 font-mono">IP: {session.ipAddress || 'Unknown'}</span>
                        
                        {session.followUpSent ? (
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-600 text-[8px] font-bold">
                            Đã gửi mail AI
                          </span>
                        ) : session.followUpScheduledAt ? (
                          <span className="px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-blue-600 text-[8px] font-bold" title={`Hẹn gửi: ${new Date(session.followUpScheduledAt).toLocaleString('vi-VN')}`}>
                            Chờ gửi AI
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200/60 text-slate-500 text-[8px]">
                            Không hẹn gửi
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right panel: Active Chat view */}
          <div className="md:col-span-2 flex flex-col justify-between md:pl-6 md:border-l border-slate-100 min-h-[500px] relative z-10">
            {activeSession ? (
              <div className="flex flex-col h-full justify-between gap-4">
                {/* Session Header */}
                <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-slate-850 text-sm">
                      {activeSession.customer ? activeSession.customer.name : 'Khách vãng lai'}
                    </h4>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {activeSession.customer?.email ? `${activeSession.customer.email} ${activeSession.customer.phone ? `• ${activeSession.customer.phone}` : ''}` : 'Chưa lưu Lead (SĐT/Email)'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteSession(activeSession.id)}
                    className="px-2.5 py-1 text-rose-650 hover:text-white hover:bg-rose-600 rounded-lg border border-rose-200 hover:border-rose-600 text-xs transition font-semibold"
                  >
                    Xóa hội thoại
                  </button>
                </div>

                {/* Message logs */}
                <div className="flex-1 overflow-y-auto max-h-[380px] space-y-3 pr-2 py-2 flex flex-col">
                  {loadingMessages ? (
                    <div className="flex justify-center items-center h-full">
                      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-[#f25c22]"></div>
                    </div>
                  ) : sessionMessages.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">Không có tin nhắn nào trong hội thoại này.</div>
                  ) : (
                    sessionMessages.map((msg) => {
                      const sender = msg.sender;
                      let cardClass = '';
                      let labelColor = 'text-slate-400';
                      let labelName = 'Khách';
                      if (sender === 'visitor') {
                        cardClass = 'bg-slate-100 text-slate-800 self-start rounded-bl-none border border-slate-200/50';
                        labelColor = 'text-slate-400';
                        labelName = 'Khách';
                      } else if (sender === 'bot') {
                        cardClass = 'bg-orange-500 text-white self-end rounded-br-none shadow-md shadow-orange-500/10';
                        labelColor = 'text-orange-100';
                        labelName = 'AI';
                      } else { // 'agent'
                        cardClass = 'bg-indigo-600 text-white self-end rounded-br-none shadow-md shadow-indigo-500/10';
                        labelColor = 'text-indigo-100';
                        labelName = 'Bạn';
                      }
                      
                      const cleanContent = msg.content.replace(/\*\(Tham khảo từ:\s*([^\)]+)\)\*/g, '').trim();
                      const citationMatch = msg.content.match(/\*\(Tham khảo từ:\s*([^\)]+)\)\*/);
                      const references = citationMatch ? citationMatch[1].split(',').map(s => s.trim()) : [];

                      return (
                        <div
                          key={msg.id}
                          className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed shadow-sm ${cardClass}`}
                        >
                          {msg.imageUrl && (
                            <div className="mb-2 max-w-xs overflow-hidden rounded-lg border border-slate-200/20">
                              <img 
                                src={getFullImageUrl(msg.imageUrl)} 
                                alt="Hình ảnh đính kèm" 
                                className="object-cover max-h-48 rounded-lg cursor-zoom-in"
                                onClick={() => window.open(getFullImageUrl(msg.imageUrl), '_blank')}
                              />
                            </div>
                          )}
                          <p className="whitespace-pre-wrap">{cleanContent}</p>
                          {references.length > 0 && (
                            <div className="mt-2 pt-1.5 border-t border-white/20 flex flex-wrap gap-1 items-center">
                              <span className="text-[9px] font-bold opacity-80">📖 Nguồn:</span>
                              {references.map((ref, rIdx) => (
                                <span 
                                  key={rIdx} 
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${sender === 'visitor' ? 'bg-slate-200 text-slate-700' : 'bg-white/20 text-white'}`}
                                >
                                  {ref}
                                </span>
                              ))}
                            </div>
                          )}
                          <span className={`block text-[8px] text-right mt-1.5 ${labelColor}`}>
                            {labelName} • {new Date(msg.createdAt).toLocaleTimeString('vi-VN')}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Details box */}
                <div className="bg-orange-50/20 p-4 rounded-xl border border-orange-100/60 text-[10px] text-slate-600 space-y-1">
                  <p><b>Mã phiên chat:</b> <span className="font-mono text-slate-450">{activeSession.id}</span></p>
                  <p className="mt-1"><b>Trình duyệt:</b> <span className="text-slate-500">{activeSession.userAgent || 'Unknown'}</span></p>
                  {activeSession.followUpScheduledAt && (
                    <p className="mt-1 text-blue-600">
                      <b>Thời điểm gửi AI Follow-up:</b> {new Date(activeSession.followUpScheduledAt).toLocaleString('vi-VN')}
                      {activeSession.followUpSent ? ' (Đã gửi thành công)' : ' (Đang xếp hàng chờ)'}
                    </p>
                  )}
                </div>

                {/* Agent Reply Box */}
                <form onSubmit={handleSendAgentReply} className="flex gap-2 border-t border-slate-100 pt-4 mt-2">
                  <input
                    type="text"
                    value={agentReplyInput}
                    onChange={(e) => setAgentReplyInput(e.target.value)}
                    placeholder="Nhập câu trả lời trực tiếp (AI chatbot sẽ tạm dừng 30 phút)..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-slate-800 text-xs focus:outline-none focus:border-[#f25c22] focus:bg-white transition"
                    disabled={sendingReply}
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !agentReplyInput.trim()}
                    className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-xs transition shadow-md flex items-center gap-1.5"
                  >
                    {sendingReply ? (
                      <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                    ) : 'Gửi'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex flex-col justify-center items-center h-full text-slate-400 text-xs">
                <div className="text-slate-400 text-center font-medium">Chọn một cuộc hội thoại bên trái để xem nội dung chat chi tiết</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal preview tài liệu */}
      {previewingSource && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative border border-orange-100 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h4 className="font-bold text-slate-800 text-sm truncate pr-4" title={previewingSource.name}>
                📄 Xem nội dung: {previewingSource.name}
              </h4>
              <button
                type="button"
                onClick={() => { setPreviewingSource(null); setPreviewText(''); }}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1"
              >
                X
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-50 border border-slate-100 rounded-xl p-4 text-slate-700 text-xs font-mono whitespace-pre-wrap leading-relaxed">
              {previewText}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

