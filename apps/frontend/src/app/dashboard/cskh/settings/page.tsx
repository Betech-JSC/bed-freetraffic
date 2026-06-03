'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';

type CskhConfig = {
  id: number;
  liveChatEnabled: boolean;
  aiChatbotEnabled: boolean;
  knowledgeBaseText: string | null;
  notificationChannels: string | null;
};

export default function CskhSettingsPage() {
  const [config, setConfig] = useState<CskhConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [liveChatEnabled, setLiveChatEnabled] = useState(false);
  const [aiChatbotEnabled, setAiChatbotEnabled] = useState(false);
  const [knowledgeBaseText, setKnowledgeBaseText] = useState('');
  
  // Notification channels array
  const [channels, setChannels] = useState({
    email: false,
    slack: false,
    zalo: false,
  });

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiJson<CskhConfig>('/cskh/config');
      if (data) {
        setConfig(data);
        setLiveChatEnabled(data.liveChatEnabled);
        setAiChatbotEnabled(data.aiChatbotEnabled);
        setKnowledgeBaseText(data.knowledgeBaseText || '');
        
        // Parse channels
        const chString = data.notificationChannels || '';
        setChannels({
          email: chString.includes('email'),
          slack: chString.includes('slack'),
          zalo: chString.includes('zalo'),
        });
      }
      setError('');
    } catch (err: any) {
      setError(err.message || 'Không thể tải cấu hình CSKH.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      
      // Construct notification channels string
      const chList = [];
      if (channels.email) chList.push('email');
      if (channels.slack) chList.push('slack');
      if (channels.zalo) chList.push('zalo');
      const notificationChannels = chList.join(',');

      await apiJson('/cskh/config', {
        method: 'POST',
        body: JSON.stringify({
          liveChatEnabled,
          aiChatbotEnabled,
          knowledgeBaseText,
          notificationChannels,
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

  const handleChannelChange = (key: 'email' | 'slack' | 'zalo', val: boolean) => {
    setChannels(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <PageHeader title="Cấu hình CSKH & Chatbot AI" description="Thiết lập các chatbot tự động trả lời khách hàng qua tài liệu đào tạo và nhận cảnh báo lead mới." />

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm flex justify-between shadow">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="hover:text-white">✕</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm flex justify-between shadow">
          <span>{error}</span>
          <button onClick={() => setError('')} className="hover:text-white">✕</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f25c22]"></div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="bg-slate-900 border border-slate-850 rounded-xl p-6 space-y-6 shadow-xl">
          {/* Live Chat Enable Toggle */}
          <div className="flex justify-between items-center border-b border-slate-850 pb-4">
            <div className="space-y-0.5">
              <h4 className="font-bold text-white text-sm">Kích hoạt Live Chat Widget</h4>
              <p className="text-slate-400 text-xs">Hiển thị bong bóng chat hỗ trợ trực tuyến góc phải bên dưới các trang Landing Page.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={liveChatEnabled}
                onChange={(e) => setLiveChatEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f25c22] peer-checked:after:bg-white"></div>
            </label>
          </div>

          {/* AI Chatbot Enable Toggle */}
          <div className="flex justify-between items-center border-b border-slate-850 pb-4">
            <div className="space-y-0.5">
              <h4 className="font-bold text-white text-sm">Trợ lý AI Chatbot trả lời tự động</h4>
              <p className="text-slate-400 text-xs">Cho phép AI tự động đọc hiểu câu hỏi và trả lời dựa trên tài liệu doanh nghiệp.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={aiChatbotEnabled}
                onChange={(e) => setAiChatbotEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f25c22] peer-checked:after:bg-white"></div>
            </label>
          </div>

          {/* AI Chatbot Knowledge Base */}
          {aiChatbotEnabled && (
            <div className="space-y-2.5 animate-fadeIn">
              <h4 className="font-bold text-white text-sm uppercase tracking-wider text-[#f25c22]">Tài liệu tri thức doanh nghiệp (Knowledge Base)</h4>
              <textarea
                value={knowledgeBaseText}
                onChange={(e) => setKnowledgeBaseText(e.target.value)}
                placeholder="Nhập thông tin sản phẩm, chính sách hoàn tiền, giờ mở cửa... AI sẽ dựa vào thông tin này để tư vấn khách hàng tự động."
                rows={6}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-white text-sm focus:outline-none focus:border-[#f25c22] transition"
              />
              <p className="text-[10px] text-slate-500">Mẹo: Tài liệu viết càng chi tiết, chatbot trả lời khách hàng càng chính xác và tự nhiên.</p>
            </div>
          )}

          {/* Notification Alert Rules */}
          <div className="space-y-3 pt-2">
            <h4 className="font-bold text-white text-sm uppercase tracking-wider text-[#f25c22]">Kênh nhận thông báo cảnh báo tức thì</h4>
            <p className="text-slate-400 text-xs mb-3">Tự động báo tin nhắn cho Admin ngay khi có khách hàng nộp Lead từ Form hoặc mua đơn hàng thành công.</p>
            
            <div className="grid grid-cols-3 gap-4">
              <div
                onClick={() => handleChannelChange('email', !channels.email)}
                className={`p-3 rounded-lg border cursor-pointer text-center transition ${channels.email ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold' : 'bg-slate-950 border-slate-850 text-slate-500'}`}
              >
                📬 Email (SMTP)
              </div>
              <div
                onClick={() => handleChannelChange('slack', !channels.slack)}
                className={`p-3 rounded-lg border cursor-pointer text-center transition ${channels.slack ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold' : 'bg-slate-950 border-slate-850 text-slate-500'}`}
              >
                💬 Slack Channel
              </div>
              <div
                onClick={() => handleChannelChange('zalo', !channels.zalo)}
                className={`p-3 rounded-lg border cursor-pointer text-center transition ${channels.zalo ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold' : 'bg-slate-950 border-slate-850 text-slate-500'}`}
              >
                📱 Zalo Notification
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-slate-850 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#f25c22] hover:bg-[#d94d1a] disabled:bg-slate-850 text-white font-bold rounded-lg text-sm transition shadow-md flex items-center gap-2"
            >
              {saving ? (
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
              ) : 'Lưu cài đặt CSKH'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
