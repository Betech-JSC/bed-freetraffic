'use client';

import { useEffect, useState, useRef } from 'react';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLocale } from '@/context/LocaleContext';

interface Campaign {
  id: number;
  name: string;
  keywords: string;
  excludeKeywords: string | null;
  groupUrls: string;
  facebookCookie: string | null;
  cookieStatus: 'ACTIVE' | 'EXPIRED' | 'ERROR';
  isActive: boolean;
  useAi: boolean;
  telegramEnabled: boolean;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  createdAt: string;
  scanInterval: number;
  minScore: number;
  enableSemanticFilter: boolean;
  semanticThreshold: number;
  targetAudience: string | null;
  scrapeComments: boolean;
}

interface SocialListeningLog {
  id: number;
  campaignId: number;
  campaign: { name: string };
  postUrl: string;
  postAuthor: string;
  authorAvatar: string | null;
  postContent: string;
  aiScore: number;
  aiDecision: 'HOT' | 'WARM' | 'COLD' | 'SPAM';
  aiReason: string | null;
  aiDraftMsg: string | null;
  status: 'PENDING' | 'NOTIFIED' | 'IGNORED' | 'ERROR';
  errorMessage: string | null;
  createdAt: string;
  isConverted?: boolean;
  isComment?: boolean;
  commentId?: string | null;
  parentPostAuthor?: string | null;
}

export default function SocialListeningPage() {
  const { t } = useLocale();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [logs, setLogs] = useState<SocialListeningLog[]>([]);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'logs'>('campaigns');
  
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // CRM Lead Convert State
  const [convertingLogIds, setConvertingLogIds] = useState<number[]>([]);
  const [savedLogIds, setSavedLogIds] = useState<number[]>([]);

  // Modal Campaign Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [formState, setFormState] = useState({
    name: '',
    keywords: '',
    excludeKeywords: '',
    groupUrls: '',
    facebookCookie: '',
    useAi: true,
    telegramEnabled: true,
    telegramBotToken: '',
    telegramChatId: '',
    scanInterval: 15,
    minScore: 50,
    enableSemanticFilter: false,
    semanticThreshold: 0.70,
    targetAudience: '',
    scrapeComments: false,
  });

  // Test Scan Status
  const [scanningId, setScanningId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; data: any } | null>(null);

  // Telegram Auto-Detect Status
  const [detectingChat, setDetectingChat] = useState(false);
  const [detectError, setDetectError] = useState('');
  const [detectSuccess, setDetectSuccess] = useState('');

  // Telegram System Bot & Recent Chats
  const [systemBotInfo, setSystemBotInfo] = useState<{ systemBotEnabled: boolean; systemBotUsername?: string } | null>(null);
  const [recentChats, setRecentChats] = useState<Array<{ chatId: string; chatTitle: string; chatType: string }>>([]);
  const [loadingRecentChats, setLoadingRecentChats] = useState(false);
  const [showRecentChatsList, setShowRecentChatsList] = useState(false);



  // Fetch campaigns
  const loadCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const data = await apiJson<Campaign[]>('/listening/campaigns');
      setCampaigns(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách chiến dịch.');
    } finally {
      setLoadingCampaigns(false);
    }
  };

  // Fetch logs
  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const data = await apiJson<SocialListeningLog[]>('/listening/logs');
      setLogs(data);
      // Pre-populate savedLogIds from backend isConverted flag
      const alreadySaved = data.filter(log => log.isConverted).map(log => log.id);
      setSavedLogIds(alreadySaved);
    } catch (err: any) {
      setError(err.message || 'Không thể tải nhật ký quét bài viết.');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleConvertToCustomer = async (logId: number) => {
    if (convertingLogIds.includes(logId) || savedLogIds.includes(logId)) return;
    
    setError('');
    setSuccess('');
    setConvertingLogIds(prev => [...prev, logId]);
    
    try {
      const res = await apiJson<{ success: boolean; customerId: number; alreadyConverted?: boolean }>(
        `/listening/logs/${logId}/convert-to-customer`,
        { method: 'POST' }
      );
      
      if (res.success) {
        setSavedLogIds(prev => [...prev, logId]);
        setSuccess(res.alreadyConverted 
          ? 'Thông tin đã được lưu trong CRM trước đó.'
          : 'Lưu thông tin khách hàng vào CRM thành công!'
        );
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu thông tin khách hàng vào CRM.');
    } finally {
      setConvertingLogIds(prev => prev.filter(id => id !== logId));
    }
  };

  useEffect(() => {
    const fetchSystemBotInfo = async () => {
      try {
        const info = await apiJson<any>('/listening/telegram/bot-info');
        setSystemBotInfo(info);
      } catch (err) {
        console.warn('Failed to load system bot info', err);
      }
    };

    loadCampaigns();
    loadLogs();
    fetchSystemBotInfo();
  }, []);

  const openCreateModal = () => {
    setEditingCampaign(null);
    setFormState({
      name: '',
      keywords: '',
      excludeKeywords: '',
      groupUrls: '',
      facebookCookie: '',
      useAi: true,
      telegramEnabled: true,
      telegramBotToken: '',
      telegramChatId: '',
      scanInterval: 15,
      minScore: 50,
      enableSemanticFilter: false,
      semanticThreshold: 0.70,
      targetAudience: '',
      scrapeComments: false,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setFormState({
      name: campaign.name,
      keywords: campaign.keywords,
      excludeKeywords: campaign.excludeKeywords || '',
      groupUrls: campaign.groupUrls,
      facebookCookie: campaign.facebookCookie || '',
      useAi: campaign.useAi,
      telegramEnabled: campaign.telegramEnabled,
      telegramBotToken: campaign.telegramBotToken || '',
      telegramChatId: campaign.telegramChatId || '',
      scanInterval: campaign.scanInterval || 15,
      minScore: campaign.minScore || 50,
      enableSemanticFilter: campaign.enableSemanticFilter || false,
      semanticThreshold: campaign.semanticThreshold || 0.70,
      targetAudience: campaign.targetAudience || '',
      scrapeComments: campaign.scrapeComments || false,
    });
    setIsModalOpen(true);
  };

  const handleDeleteCampaign = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa chiến dịch này không? Tất cả logs bài viết liên quan sẽ bị xóa.')) return;
    setError('');
    setSuccess('');
    try {
      await apiJson(`/listening/campaigns/${id}`, { method: 'DELETE' });
      setSuccess('Đã xóa chiến dịch thành công.');
      loadCampaigns();
      loadLogs();
    } catch (err: any) {
      setError(err.message || 'Không thể xóa chiến dịch.');
    }
  };

  const handleToggleActive = async (campaign: Campaign) => {
    setError('');
    try {
      const updated = await apiJson<Campaign>(`/listening/campaigns/${campaign.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !campaign.isActive }),
      });
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? updated : c));
    } catch (err: any) {
      setError(err.message || 'Không thể cập nhật trạng thái hoạt động.');
    }
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (editingCampaign) {
        await apiJson(`/listening/campaigns/${editingCampaign.id}`, {
          method: 'PUT',
          body: JSON.stringify(formState),
        });
        setSuccess('Cập nhật chiến dịch thành công.');
      } else {
        await apiJson('/listening/campaigns', {
          method: 'POST',
          body: JSON.stringify(formState),
        });
        setSuccess('Tạo chiến dịch lắng nghe mới thành công.');
      }
      setIsModalOpen(false);
      loadCampaigns();
    } catch (err: any) {
      setError(err.message || 'Không thể lưu chiến dịch.');
    }
  };

  const handleTestScan = async (campaign: Campaign) => {
    if (scanningId) return;
    setError('');
    setSuccess('');
    setScanningId(campaign.id);
    setTestResult(null);
    try {
      const res = await apiJson<any>(`/listening/campaigns/${campaign.id}/test-scan`, {
        method: 'POST',
      });
      setTestResult({ id: campaign.id, data: res });
      loadLogs();
    } catch (err: any) {
      setError(err.message || 'Chạy quét thử thất bại.');
    } finally {
      setScanningId(null);
    }
  };

  const handleFetchRecentChats = async (isSystem: boolean) => {
    const token = isSystem ? '' : formState.telegramBotToken.trim();
    if (!isSystem && !token) {
      setDetectError('Vui lòng nhập Telegram Bot Token trước khi quét kết nối.');
      return;
    }
    
    setLoadingRecentChats(true);
    setDetectError('');
    setDetectSuccess('');
    setShowRecentChatsList(true);
    try {
      const chats = await apiJson<any[]>('/listening/telegram/recent-chats', {
        method: 'POST',
        body: JSON.stringify({ botToken: token }),
      });
      setRecentChats(chats);
    } catch (err: any) {
      setDetectError(err.message || 'Không tìm thấy tương tác nào. Vui lòng bấm Bắt đầu (Start) hoặc nhắn tin cho Bot trước.');
      setRecentChats([]);
    } finally {
      setLoadingRecentChats(false);
    }
  };

  const handleSelectRecentChat = async (chat: { chatId: string; chatTitle: string; chatType: string }, isSystem: boolean) => {
    const token = isSystem ? '' : formState.telegramBotToken.trim();
    setFormState(prev => ({ ...prev, telegramChatId: chat.chatId }));
    
    try {
      await apiJson<any>('/listening/telegram/send-welcome', {
        method: 'POST',
        body: JSON.stringify({
          botToken: token,
          chatId: chat.chatId,
          chatTitle: chat.chatTitle
        }),
      });
      setDetectSuccess(`Đã chọn chat ID và gửi tin nhắn xác nhận đến "${chat.chatTitle}" (${chat.chatType}) thành công!`);
      setShowRecentChatsList(false);
    } catch (err: any) {
      setDetectError(err.message || 'Lưu Chat ID thành công nhưng không gửi được tin nhắn test.');
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Đã sao chép tin nhắn nháp thành công!');
  };

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        title="AI Social Listening"
        description="Quét bài viết trên Facebook Group, dùng AI đánh giá nhu cầu khách hàng và cảnh báo cơ hội bán hàng về Telegram theo thời gian thực."
      />

      {/* Dynamic Alert Boxes */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm animate-pulse">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl text-green-700 text-sm">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{success}</span>
        </div>
      )}

      {/* Hero tutorial section */}
      <div className="bg-white rounded-3xl p-6 border border-orange-100/60 shadow-lg shadow-orange-950/5 relative overflow-hidden mb-6">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-brand/10 to-orange-500/10 rounded-full blur-2xl -mr-6 -mt-6"></div>
        
        <div>
          <div className="flex border-b border-slate-100 gap-6 mb-5 pb-2.5">
            <h3 className="text-sm font-extrabold text-brand flex items-center gap-1.5">
              🔑 Hướng dẫn lấy Cookie thủ công (Khuyên dùng - 100% Ổn định)
            </h3>
          </div>

          <div className="space-y-3.5 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <p className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <span className="p-1 bg-orange-100 rounded text-brand">💡</span>
                Cách lấy Cookie đầy đủ chứa cả c_user và xs:
              </p>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
              <div className="space-y-2">
                <p className="font-bold text-brand flex items-center gap-1">🌐 Cách 1: Dùng Extension "cURL & WS Capture" (Khuyên dùng)</p>
                <ul className="list-disc list-inside space-y-1.5 text-slate-500">
                  <li>Cài extension <b>cURL & WS Capture</b> trên Chrome/Edge.</li>
                  <li>Vào trang <b>facebook.com</b> để tải dữ liệu.</li>
                  <li>Mở extension, copy request của Facebook (dạng chuỗi hoặc JSON block).</li>
                  <li>Dán trực tiếp vào ô Cookie. Backend sẽ tự động phân tích JSON và trích xuất Cookie sạch.</li>
                </ul>
              </div>

              <div className="space-y-2 border-t sm:border-t-0 sm:border-l border-slate-100 pt-3 sm:pt-0 sm:pl-4">
                <p className="font-bold text-slate-800 flex items-center gap-1">💻 Cách 2: Sao chép từ DevTools (F12)</p>
                <ul className="list-disc list-inside space-y-1.5 text-slate-500">
                  <li>Nhấn <b>F12</b> ở facebook.com, chuyển sang tab <b>Network</b>.</li>
                  <li>Nhấn <b>F5</b> để load lại trang.</li>
                  <li>Click dòng request đầu tiên (Type: <code>document</code>).</li>
                  <li>Tìm phần <b>Request Headers</b> &rarr; copy giá trị của trường <b>Cookie</b> (chứa cả c_user và xs) và dán vào ô Cookie.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between gap-4 flex-wrap">
          <span className="text-[11px] text-slate-400">
            💡 Lưu ý: Tránh dùng tài khoản chính (cá nhân quan trọng) để chạy quét bài viết. Hãy sử dụng tài khoản Clone phụ để đảm bảo an toàn.
          </span>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-orange-100/50 gap-4">
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === 'campaigns'
              ? 'text-brand'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Chiến dịch lắng nghe ({campaigns.length})
          {activeTab === 'campaigns' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-full"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === 'logs'
              ? 'text-brand'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Khách hàng tiềm năng tìm thấy ({logs.filter(l => ['HOT', 'WARM'].includes(l.aiDecision)).length})
          {activeTab === 'logs' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-full"></div>
          )}
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'campaigns' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-slate-800 font-extrabold text-base">Danh sách chiến dịch</h3>
            <button
              onClick={openCreateModal}
              className="btn-primary text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-brand/10 font-bold"
            >
              + Tạo chiến dịch mới
            </button>
          </div>

          {loadingCampaigns ? (
            <div className="flex justify-center items-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-orange-100/60 p-8 space-y-4">
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto text-brand">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h4 className="font-bold text-slate-800">Chưa có chiến dịch lắng nghe nào</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Bắt đầu theo dõi các từ khóa nhu cầu trên Facebook bằng cách tạo chiến dịch lắng nghe đầu tiên của bạn.
              </p>
              <button onClick={openCreateModal} className="btn-primary text-xs px-4 py-2">
                Tạo chiến dịch đầu tiên
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="bg-white rounded-3xl p-6 border border-orange-100/60 shadow-lg shadow-orange-950/5 flex flex-col justify-between hover:shadow-xl hover:scale-[1.005] transition-all relative overflow-hidden"
                >
                  {/* Glowing line for active campaign */}
                  {campaign.isActive && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand to-orange-500"></div>
                  )}

                  <div className="space-y-4">
                    {/* Top line name and toggle */}
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                          {campaign.name}
                          <span
                            className={`w-2 h-2 rounded-full ${
                              campaign.isActive ? 'bg-green-500 animate-ping' : 'bg-slate-300'
                            }`}
                          />
                        </h4>
                        <span className="text-[10px] text-slate-400">Tạo ngày {new Date(campaign.createdAt).toLocaleDateString('vi-VN')}</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={campaign.isActive}
                          onChange={() => handleToggleActive(campaign)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand"></div>
                      </label>
                    </div>

                    {/* Keywords list */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Từ khóa lộc ({campaign.keywords.split(',').length})</p>
                      <div className="flex flex-wrap gap-1">
                        {campaign.keywords.split(',').map((kw, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-orange-50 text-brand text-[10px] font-bold rounded-lg border border-orange-100/40">
                            {kw.trim()}
                          </span>
                        ))}
                        {campaign.excludeKeywords && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            (Loại trừ: {campaign.excludeKeywords})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Groups list */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nhóm theo dõi</p>
                      <div className="flex flex-wrap gap-1.5">
                        {campaign.groupUrls.split(',').map((url, idx) => {
                          const cleanUrl = url.trim();
                          const display = cleanUrl.includes('/') ? cleanUrl.split('/').pop() || cleanUrl : cleanUrl;
                          return (
                            <span key={idx} className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded-lg truncate max-w-[200px]" title={cleanUrl}>
                              👥 {display}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Status row */}
                    <div className="grid grid-cols-4 gap-2 py-2.5 border-y border-slate-50 text-xs">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Cookie FB</p>
                        {campaign.cookieStatus === 'ACTIVE' ? (
                          <span className="text-green-600 font-bold flex items-center gap-1 mt-0.5 text-[11px]">
                            ● Kết nối
                          </span>
                        ) : (
                          <span className="text-red-500 font-bold flex items-center gap-1 mt-0.5 text-[11px]">
                            ▲ Lỗi/Hết hạn
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Phân loại AI</p>
                        <span className="font-semibold text-slate-700 block mt-0.5 text-[11px]" title={campaign.enableSemanticFilter ? `Lọc ngữ nghĩa độ nhạy: ${campaign.semanticThreshold}` : ''}>
                          {campaign.useAi ? (campaign.enableSemanticFilter ? `Ngữ nghĩa (>=${campaign.semanticThreshold})` : 'Từ khóa') : 'Tắt'}
                        </span>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Telegram Alert</p>
                        <span className="font-semibold text-slate-700 block mt-0.5 text-[11px]">
                          {campaign.telegramEnabled ? `Bật (>=${campaign.minScore || 50}đ)` : 'Tắt'}
                        </span>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Quét & Tần suất</p>
                        <span className="font-semibold text-slate-700 block mt-0.5 text-[11px]">
                          {campaign.scanInterval ? `${campaign.scanInterval}m` : '15m'}{campaign.scrapeComments ? ' (+Bình luận)' : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions row */}
                  <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleTestScan(campaign)}
                      disabled={scanningId !== null}
                      className={`btn-secondary text-[10px] py-2 px-3 rounded-lg font-bold flex items-center gap-1.5 ${
                        scanningId === campaign.id ? 'opacity-70 cursor-wait' : ''
                      }`}
                    >
                      {scanningId === campaign.id ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-brand"></div>
                          Đang chạy...
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18" />
                          </svg>
                          Quét thử
                        </>
                      )}
                    </button>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(campaign)}
                        className="text-[10px] text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-800 py-2 px-3 rounded-lg font-bold transition-all"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDeleteCampaign(campaign.id)}
                        className="text-[10px] text-red-500 border border-red-100 hover:bg-red-50 py-2 px-3 rounded-lg font-bold transition-all"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Test Scan Result Box */}
          {testResult && (
            <div className="card p-6 bg-slate-950 text-slate-200 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></span>
                  Kết quả chạy quét thử chiến dịch ID: {testResult.id}
                </h4>
                <button
                  onClick={() => setTestResult(null)}
                  className="text-xs text-slate-500 hover:text-slate-200"
                >
                  Đóng
                </button>
              </div>
              
              <div className="grid sm:grid-cols-3 gap-4 text-xs font-mono">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-slate-500 block">Trạng thái</span>
                  <span className="text-green-400 font-bold mt-1 block">
                    {testResult.data.success ? 'THÀNH CÔNG' : 'THẤT BẠI'}
                  </span>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-slate-500 block">Bài viết tìm thấy</span>
                  <span className="text-white font-bold mt-1 block font-mono text-base">
                    {testResult.data.postsCount ?? 0}
                  </span>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="text-slate-500 block">Lead Tiềm Năng</span>
                  <span className="text-brand font-bold mt-1 block font-mono text-base">
                    {testResult.data.leadsFound ?? 0}
                  </span>
                </div>
              </div>

              {testResult.data.error && (
                <div className="p-3.5 bg-red-950/20 border border-red-900/40 rounded-xl text-red-400 text-xs">
                  <span className="font-bold block mb-1">Mã lỗi trả về:</span>
                  <p className="font-mono">{testResult.data.error}</p>
                  {testResult.data.error === 'COOKIE_EXPIRED' && (
                    <p className="mt-1.5 text-[10px] text-red-300">
                      → Giải thích: Cookie Facebook của bạn không hoạt động, bị Checkpoint, hoặc đã hết hạn. Hãy làm theo hướng dẫn lấy Cookie thủ công ở trên đầu trang để cập nhật cookie mới.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Tab Logs / Lead list view */
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
          <div className="flex justify-between items-center">
            <h3 className="text-slate-800 font-extrabold text-base">Bài viết & Khách hàng tiềm năng</h3>
            <button
              onClick={loadLogs}
              className="text-xs text-brand hover:text-brand-hover font-bold flex items-center gap-1"
            >
              🔄 Tải lại dữ liệu
            </button>
          </div>

          {loadingLogs ? (
            <div className="flex justify-center items-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-orange-100/60 p-8 space-y-4">
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto text-brand">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h4 className="font-bold text-slate-800">Chưa ghi nhận cơ hội bán hàng nào</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Khi các chiến dịch của bạn hoạt động và tìm kiếm được bài viết khớp từ khóa lộc, chúng sẽ xuất hiện ở đây.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {logs.map((log) => {
                const isHot = log.aiDecision === 'HOT';
                const isWarm = log.aiDecision === 'WARM';
                const isSpam = log.aiDecision === 'SPAM';
                const isCold = log.aiDecision === 'COLD';
                
                return (
                  <div
                    key={log.id}
                    className="bg-white rounded-3xl p-6 border border-orange-100/60 shadow-lg shadow-orange-950/5 hover:shadow-xl transition-all relative overflow-hidden space-y-4"
                  >
                    {/* Badge classification on top left */}
                    <div className="flex justify-between items-start gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200">
                          {log.authorAvatar ? (
                            <img src={log.authorAvatar} alt={log.postAuthor} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-black text-slate-400 text-sm">{log.postAuthor.slice(0, 2).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                            {log.postAuthor}
                            {log.isComment && (
                              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded text-[9px] font-black uppercase flex items-center gap-0.5">
                                💬 Bình luận
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Chiến dịch: <span className="font-bold text-slate-500">{log.campaign?.name}</span>
                            {log.isComment && log.parentPostAuthor && (
                              <span> • Tại bài đăng của <span className="font-bold text-slate-500">@{log.parentPostAuthor}</span></span>
                            )}
                            <span> • {new Date(log.createdAt).toLocaleString('vi-VN')}</span>
                          </p>
                        </div>
                      </div>

                      {/* Decision Badges */}
                      <div className="flex items-center gap-2">
                        {isHot && (
                          <span className="px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 text-xs font-black rounded-lg flex items-center gap-1">
                            🔥 HOT - {log.aiScore}/100
                          </span>
                        )}
                        {isWarm && (
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-600 border border-amber-200 text-xs font-black rounded-lg flex items-center gap-1">
                            💡 WARM - {log.aiScore}/100
                          </span>
                        )}
                        {isCold && (
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-500 border border-blue-200 text-xs font-bold rounded-lg">
                            COLD - {log.aiScore}/100
                          </span>
                        )}
                        {isSpam && (
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-400 border border-slate-200 text-xs font-bold rounded-lg line-through">
                            SPAM - {log.aiScore}/100
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Post Content */}
                    <div className="text-slate-700 text-sm whitespace-pre-wrap bg-slate-50/50 p-4 rounded-2xl border border-slate-100/40">
                      {log.postContent}
                    </div>

                    {/* AI Scoring Box */}
                    {!isCold && !isSpam && (
                      <div className="bg-orange-50/20 border border-orange-100/40 rounded-2xl p-5 space-y-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lý do phân loại AI</p>
                          <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                            {log.aiReason || 'AI đánh giá bài viết khớp từ khóa mục tiêu.'}
                          </p>
                        </div>

                        {log.aiDraftMsg && (
                          <div className="space-y-2 border-t border-orange-100/40 pt-4">
                            <div className="flex justify-between items-center">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kịch bản nhắn tin/inbox nháp</p>
                              <button
                                onClick={() => handleCopyText(log.aiDraftMsg!)}
                                className="text-[10px] text-brand hover:text-brand-hover font-bold"
                              >
                                📋 Sao chép nháp
                              </button>
                            </div>
                            <div className="text-xs text-slate-600 italic bg-white p-3 rounded-xl border border-orange-100/30 leading-relaxed relative">
                              "{log.aiDraftMsg}"
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Links and trigger statuses */}
                    <div className="flex justify-between items-center gap-4 text-xs pt-2">
                      <div className="text-slate-400 flex items-center gap-1.5">
                        <span>Trạng thái:</span>
                        {log.status === 'NOTIFIED' ? (
                          <span className="text-green-600 font-bold">✓ Đã gửi Telegram</span>
                        ) : log.status === 'ERROR' ? (
                          <span className="text-red-500 font-bold" title={log.errorMessage || ''}>⚠️ Gửi Telegram lỗi</span>
                        ) : log.status === 'IGNORED' ? (
                          <span className="text-slate-500">Lưu trữ (Cold/Spam)</span>
                        ) : (
                          <span className="text-slate-500">Chưa xử lý</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {(isHot || isWarm) && (
                          <button
                            onClick={() => handleConvertToCustomer(log.id)}
                            disabled={convertingLogIds.includes(log.id) || savedLogIds.includes(log.id)}
                            className={`text-xs py-2 px-4 rounded-xl font-bold flex items-center gap-1 transition-all ${
                              savedLogIds.includes(log.id)
                                ? 'bg-green-50 text-green-700 border border-green-200 cursor-not-allowed'
                                : convertingLogIds.includes(log.id)
                                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-wait'
                                : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 cursor-pointer active:scale-95'
                            }`}
                          >
                            {convertingLogIds.includes(log.id) ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-slate-500"></div>
                                Đang lưu...
                              </>
                            ) : savedLogIds.includes(log.id) ? (
                              '✓ Đã lưu CRM'
                            ) : (
                              '📥 Lưu vào CRM'
                            )}
                          </button>
                        )}

                        <a
                          href={log.postUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-primary text-xs py-2 px-4 rounded-xl shadow-lg shadow-brand/10 font-bold flex items-center gap-1"
                        >
                          Đi tới bài viết
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Create/Edit Campaign */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl text-slate-700 overflow-y-auto max-h-[90vh]">
            {/* Header stripe */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand to-orange-500"></div>
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-slate-800">
                {editingCampaign ? 'Chỉnh sửa chiến dịch' : 'Tạo chiến dịch lắng nghe mới'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCampaign} className="space-y-5">
              {/* Campaign Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Tên chiến dịch</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Tìm Khách Hàng Web Freelance"
                  className="input w-full"
                  value={formState.name}
                  onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              {/* Group URLs */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase flex justify-between">
                  <span>Danh sách Nhóm Facebook (URL hoặc ID)</span>
                  <span className="text-slate-400 font-normal normal-case">Cách nhau bằng dấu phẩy</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: https://www.facebook.com/groups/12345678, my-target-group"
                  className="input w-full"
                  value={formState.groupUrls}
                  onChange={(e) => setFormState(prev => ({ ...prev, groupUrls: e.target.value }))}
                />
              </div>

              {/* Keywords */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase flex justify-between">
                    <span>Từ khóa lọc tìm kiếm</span>
                    <span className="text-slate-400 font-normal normal-case">phẩy</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="cần làm web, thiết kế web, tuyển code"
                    className="input w-full"
                    value={formState.keywords}
                    onChange={(e) => setFormState(prev => ({ ...prev, keywords: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase flex justify-between">
                    <span>Từ khóa phủ định (loại trừ)</span>
                    <span className="text-slate-400 font-normal normal-case">phẩy</span>
                  </label>
                  <input
                    type="text"
                    placeholder="học, khóa học, chia sẻ tài liệu"
                    className="input w-full"
                    value={formState.excludeKeywords}
                    onChange={(e) => setFormState(prev => ({ ...prev, excludeKeywords: e.target.value }))}
                  />
                </div>
              </div>

              {/* FB Cookie manually (Highly recommended to copy full cookie manually) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase flex justify-between">
                  <span>Facebook Cookie (Full Cookie)</span>
                  <span className="text-brand font-bold normal-case">Khuyên dùng copy bằng tay từ F12 Network tab</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Dán toàn bộ chuỗi Cookie lấy từ Network tab (phải có cả c_user=... và xs=... để không bị lỗi COOKIE_EXPIRED)"
                  className="input w-full font-mono text-xs border-orange-100 focus:border-brand"
                  value={formState.facebookCookie}
                  onChange={(e) => setFormState(prev => ({ ...prev, facebookCookie: e.target.value }))}
                />
                <span className="text-[10px] text-slate-400 block leading-normal mt-1">
                  💡 Hãy lấy cookie bằng tay như hướng dẫn ở trên đầu trang nếu gặp lỗi.
                </span>
              </div>

              {/* Chân dung khách hàng mục tiêu & Sản phẩm */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase flex justify-between">
                  <span>Chân dung khách hàng mục tiêu & Sản phẩm của bạn</span>
                  <span className="text-brand font-bold normal-case">Dùng làm bối cảnh để AI lọc chính xác hơn</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Ví dụ: Chúng tôi cung cấp dịch vụ SEO cho các local brand thời trang nhỏ tại Việt Nam với giá từ 5 triệu."
                  className="input w-full border-orange-100 focus:border-brand"
                  value={formState.targetAudience}
                  onChange={(e) => setFormState(prev => ({ ...prev, targetAudience: e.target.value }))}
                />
              </div>

              {/* Tần suất quét & Ngưỡng điểm thông báo */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Tần suất quét tự động</label>
                  <select
                    className="input w-full bg-white cursor-pointer"
                    value={formState.scanInterval}
                    onChange={(e) => setFormState(prev => ({ ...prev, scanInterval: parseInt(e.target.value, 10) }))}
                  >
                    <option value={5}>Mỗi 5 phút (Rất nhanh)</option>
                    <option value={15}>Mỗi 15 phút (Mặc định)</option>
                    <option value={30}>Mỗi 30 phút</option>
                    <option value={60}>Mỗi 1 giờ</option>
                    <option value={180}>Mỗi 3 giờ</option>
                    <option value={360}>Mỗi 6 giờ</option>
                    <option value={720}>Mỗi 12 giờ</option>
                    <option value={1440}>Mỗi 24 giờ (Hàng ngày)</option>
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Điểm AI tối thiểu nhận báo</label>
                  <select
                    className="input w-full bg-white cursor-pointer"
                    value={formState.minScore}
                    onChange={(e) => setFormState(prev => ({ ...prev, minScore: parseInt(e.target.value, 10) }))}
                  >
                    <option value={50}>50 điểm (Tất cả WARM & HOT)</option>
                    <option value={60}>60 điểm (Lọc bớt tin nhiễu)</option>
                    <option value={70}>70 điểm (Cơ hội chất lượng khá trở lên)</option>
                    <option value={80}>80 điểm (Chỉ cơ hội cực kỳ rõ ràng/HOT)</option>
                  </select>
                </div>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                💡 Cấu hình thời gian giãn cách quét và ngưỡng điểm số đánh giá từ AI để lọc thông tin đẩy về Telegram.
              </span>

              {/* Switches logic */}
              <div className="grid sm:grid-cols-2 gap-4 py-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formState.useAi}
                    onChange={(e) => setFormState(prev => ({ ...prev, useAi: e.target.checked }))}
                    className="w-4 h-4 rounded text-brand border-slate-300 focus:ring-brand accent-brand"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Chạy chấm điểm Lead bằng AI</span>
                    <span className="text-[10px] text-slate-400 block">Dùng LLM qualify nội dung và soạn kịch bản nháp.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formState.telegramEnabled}
                    onChange={(e) => setFormState(prev => ({ ...prev, telegramEnabled: e.target.checked }))}
                    className="w-4 h-4 rounded text-brand border-slate-300 focus:ring-brand accent-brand"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Thông báo Telegram</span>
                    <span className="text-[10px] text-slate-400 block">Gửi tin nhắn thông báo về Telegram khi có Lead HOT/WARM.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formState.enableSemanticFilter}
                    onChange={(e) => setFormState(prev => ({ ...prev, enableSemanticFilter: e.target.checked }))}
                    className="w-4 h-4 rounded text-brand border-slate-300 focus:ring-brand accent-brand"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Bộ lọc Ngữ nghĩa (Semantic Filter)</span>
                    <span className="text-[10px] text-slate-400 block">Dùng AI Embeddings tự nhận biết các cụm từ đồng nghĩa.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formState.scrapeComments}
                    onChange={(e) => setFormState(prev => ({ ...prev, scrapeComments: e.target.checked }))}
                    className="w-4 h-4 rounded text-brand border-slate-300 focus:ring-brand accent-brand"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Quét Bình luận (Comment Scraping)</span>
                    <span className="text-[10px] text-slate-400 block">Tìm kiếm lead tiềm năng xuất hiện trong bình luận bài đăng.</span>
                  </div>
                </label>
              </div>

              {/* Semantic Threshold Slider */}
              {formState.enableSemanticFilter && (
                <div className="space-y-1.5 p-4 bg-orange-50/20 border border-orange-100/40 rounded-2xl">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                    <span>Độ nhạy ngữ nghĩa (Semantic Similarity Threshold)</span>
                    <span className="text-brand font-mono">{formState.semanticThreshold.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.50"
                    max="0.90"
                    step="0.05"
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand"
                    value={formState.semanticThreshold}
                    onChange={(e) => setFormState(prev => ({ ...prev, semanticThreshold: parseFloat(e.target.value) }))}
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Thấp (Bắt rộng - Đồng nghĩa nhiều)</span>
                    <span>Cao (Chính xác tuyệt đối)</span>
                  </div>
                </div>
              )}

              {/* Telegram Config */}
              {formState.telegramEnabled && (
                <div className="bg-orange-50/25 border border-orange-100/40 p-4 rounded-2xl space-y-3.5">
                  <div className="flex justify-between items-center border-b border-orange-100/20 pb-2">
                    <p className="text-xs font-bold text-slate-600 uppercase">Cấu hình Telegram Bot</p>
                    <span className="text-[9px] text-slate-400 font-semibold bg-orange-100/40 px-2 py-0.5 rounded">
                      Kết nối nhanh 1-Click
                    </span>
                  </div>

                  {/* 1. System Bot Option (if configured in backend) */}
                  {systemBotInfo && systemBotInfo.systemBotEnabled ? (
                    <div className="space-y-3 bg-white p-3.5 rounded-xl border border-orange-100/30">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <span className="text-xs font-bold text-slate-700 block">🤖 Sử dụng Bot Be Traffic (Khuyên dùng)</span>
                          <span className="text-[10px] text-slate-400 block">
                            Nhận thông báo qua Bot hệ thống: <a href={`https://t.me/${systemBotInfo.systemBotUsername}`} target="_blank" rel="noreferrer" className="text-brand font-bold underline">@{systemBotInfo.systemBotUsername}</a>
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={loadingRecentChats}
                          onClick={() => {
                            setFormState(prev => ({ ...prev, telegramBotToken: '' })); // Clear custom bot to use system bot
                            handleFetchRecentChats(true);
                          }}
                          className="btn-primary whitespace-nowrap text-[10px] px-3 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          {loadingRecentChats ? (
                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                          ) : 'Quét Chat' }
                        </button>
                      </div>
                      <p className="text-[9px] text-slate-400">
                        *Cách hoạt động: Click link <a href={`https://t.me/${systemBotInfo.systemBotUsername}`} target="_blank" rel="noreferrer" className="text-brand underline">@{systemBotInfo.systemBotUsername}</a> → Bấm <b>Start</b> → Quay lại đây nhấn <b>Quét Chat</b> để chọn tên bạn.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl text-[10px] text-slate-500 leading-normal">
                      ℹ️ Để sử dụng phương thức 1-click bằng Bot hệ thống, vui lòng cấu hình biến <code>TELEGRAM_BOT_TOKEN</code> trong file <code>.env</code> trên máy chủ.
                    </div>
                  )}

                  {/* 2. Custom Bot Option */}
                  <div className="space-y-3 border-t border-slate-100 pt-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Hoặc sử dụng Telegram Bot riêng của bạn</p>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Bot Token của bạn</label>
                        <input
                          type="text"
                          placeholder="Nhập Token Bot từ @BotFather"
                          className="input w-full text-xs font-mono"
                          value={formState.telegramBotToken}
                          onChange={(e) => setFormState(prev => ({ ...prev, telegramBotToken: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Chat ID của bạn</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Chọn từ danh sách quét hoặc nhập ID"
                            className="input w-full text-xs font-mono"
                            value={formState.telegramChatId}
                            onChange={(e) => setFormState(prev => ({ ...prev, telegramChatId: e.target.value }))}
                          />
                          {formState.telegramBotToken.trim() && (
                            <button
                              type="button"
                              disabled={loadingRecentChats}
                              onClick={() => handleFetchRecentChats(false)}
                              className="btn-secondary whitespace-nowrap text-[10px] px-3 font-bold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              {loadingRecentChats ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-brand"></div>
                              ) : 'Quét Chat' }
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Chats Selector Dropdown */}
                  {showRecentChatsList && (
                    <div className="bg-slate-900 text-slate-200 p-3.5 rounded-xl border border-slate-800 space-y-2 mt-2">
                      <div className="flex justify-between items-center border-b border-slate-850 pb-1">
                        <span className="text-[10px] font-bold text-slate-400">Chọn cuộc trò chuyện để liên kết:</span>
                        <button
                          type="button"
                          onClick={() => setShowRecentChatsList(false)}
                          className="text-[9px] text-slate-500 hover:text-slate-200"
                        >
                          Đóng
                        </button>
                      </div>
                      {loadingRecentChats ? (
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 justify-center py-2">
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-brand"></div>
                          Đang dò tìm tương tác gần đây...
                        </div>
                      ) : recentChats.length === 0 ? (
                        <p className="text-[10px] text-slate-500 text-center py-2">
                          Không tìm thấy tương tác mới nào. Vui lòng mở Telegram nhấn Bắt đầu (Start) hoặc gửi tin nhắn cho Bot trước rồi quét lại.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-[150px] overflow-y-auto custom-scrollbar">
                          {recentChats.map((c) => (
                            <button
                              key={c.chatId}
                              type="button"
                              onClick={() => handleSelectRecentChat(c, !formState.telegramBotToken.trim())}
                              className="w-full text-left p-2 hover:bg-slate-800 active:bg-slate-700 rounded-lg text-xs flex items-center justify-between border border-slate-800/40 transition-colors cursor-pointer"
                            >
                              <span>
                                {c.chatType === 'Cá nhân' ? '👤' : '👥'} <span className="font-bold text-white">{c.chatTitle}</span> ({c.chatType})
                              </span>
                              <span className="text-[10px] font-mono text-brand">ID: {c.chatId} → Kết nối</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Alert messages */}
                  {detectError && (
                    <p className="text-[10px] text-red-500 font-bold bg-red-50 p-2.5 rounded-xl border border-red-100/50 leading-relaxed">
                      ⚠️ {detectError}
                    </p>
                  )}
                  {detectSuccess && (
                    <p className="text-[10px] text-green-600 font-bold bg-green-50 p-2.5 rounded-xl border border-green-100/50 leading-relaxed">
                      ✓ {detectSuccess}
                    </p>
                  )}
                </div>
              )}

              {/* Modal footer actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 font-bold px-4 py-2.5 rounded-xl transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-brand/10 font-bold"
                >
                  {editingCampaign ? 'Cập nhật' : 'Tạo chiến dịch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
