'use client';

import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import Link from 'next/link';

type WidgetSettings = {
  themeColor: string;
  themeColor2: string;
  title: string;
  welcomeMessage: string;
  avatarUrl: string;
  botName: string;
};

export default function WidgetCustomizerPage() {
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [themeColor, setThemeColor] = useState('#6366f1');
  const [themeColor2, setThemeColor2] = useState('#06b6d4');
  const [title, setTitle] = useState('Hỗ Trợ Khách Hàng AI');
  const [welcomeMessage, setWelcomeMessage] = useState('Chào bạn! Mình là trợ lý ảo hỗ trợ trực tuyến. Mình có thể giúp gì cho bạn hôm nay?');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [botName, setBotName] = useState('AI');

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [apiHost, setApiHost] = useState('http://localhost:4000');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const wsId = localStorage.getItem('workspaceId') || '';
      setWorkspaceId(wsId);
      
      const host = process.env.NEXT_PUBLIC_API_URL || window.location.origin.replace(':3000', ':4000');
      setApiHost(host);
    }
  }, []);

  useEffect(() => {
    async function loadWidgetConfig() {
      if (!workspaceId) return;
      try {
        setLoading(true);
        // We load cskhConfig config from backend
        const config = await apiJson<any>('/cskh/config');
        if (config && config.widgetSettings) {
          try {
            const settings: WidgetSettings = JSON.parse(config.widgetSettings);
            if (settings.themeColor) setThemeColor(settings.themeColor);
            if (settings.themeColor2) setThemeColor2(settings.themeColor2);
            if (settings.title) setTitle(settings.title);
            if (settings.welcomeMessage) setWelcomeMessage(settings.welcomeMessage);
            if (settings.avatarUrl) setAvatarUrl(settings.avatarUrl);
            if (settings.botName) setBotName(settings.botName);
          } catch (e) {
            // keep defaults
          }
        }
      } catch (err: any) {
        console.error('Không thể tải cấu hình widget:', err);
      } finally {
        setLoading(false);
      }
    }
    loadWidgetConfig();
  }, [workspaceId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const settings: WidgetSettings = {
        themeColor,
        themeColor2,
        title,
        welcomeMessage,
        avatarUrl,
        botName,
      };

      // We save inside CskhConfig
      await apiJson('/cskh/config', {
        method: 'POST',
        body: JSON.stringify({
          widgetSettings: JSON.stringify(settings),
        }),
      });

      setSuccess('Đã lưu cấu hình bong bóng chat thành công.');
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu cấu hình.');
    } finally {
      setSaving(false);
    }
  };

  const embedScript = `<script src="${apiHost}/api/public/cskh/widget.js" data-workspace-id="${workspaceId || 'WORKSPACE_ID'}" defer></script>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedScript);
    alert('Đã sao chép mã nhúng vào bộ nhớ tạm!');
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <PageHeader 
          title="Tùy Biến Bong Bóng Chat AI" 
          description="Thiết lập giao diện, lời chào và lấy mã nhúng AI Chatbot để cài đặt lên các website bên ngoài của bạn." 
        />
        <Link
          href="/dashboard/cskh/settings"
          className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 transition rounded-xl text-xs font-bold"
        >
          ← Quay lại cấu hình CSKH
        </Link>
      </div>

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm flex justify-between shadow">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="hover:text-white font-bold">X</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm flex justify-between shadow">
          <span>{error}</span>
          <button onClick={() => setError('')} className="hover:text-white font-bold">X</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f25c22]"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Cột trái: Cài đặt */}
          <form onSubmit={handleSave} className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">
              🎨 Cài đặt Giao diện & Lời chào
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Màu chủ đạo (Gradient 1)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="h-9 w-12 rounded border border-slate-200 cursor-pointer p-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-[#f25c22]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Màu phụ (Gradient 2)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={themeColor2}
                    onChange={(e) => setThemeColor2(e.target.value)}
                    className="h-9 w-12 rounded border border-slate-200 cursor-pointer p-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={themeColor2}
                    onChange={(e) => setThemeColor2(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-[#f25c22]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tên viết tắt hiển thị (Bot Name)</label>
                <input
                  type="text"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="Ví dụ: AI, CSKH, Tư vấn"
                  maxLength={10}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:bg-white focus:border-[#f25c22]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tiêu đề khung chat (Title)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Hỗ Trợ Khách Hàng AI"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:bg-white focus:border-[#f25c22]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">URL hình đại diện (Avatar URL)</label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="Nhập liên kết ảnh (.png, .jpg) - ví dụ: https://example.com/avatar.png"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:bg-white focus:border-[#f25c22]"
              />
              <p className="text-[10px] text-slate-400">* Để trống sẽ tự động lấy 2 ký tự đầu của Tên bot làm hình đại diện.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tin nhắn chào mừng ban đầu</label>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Nhập tin nhắn hiển thị đầu tiên khi khách mở bong bóng chat..."
                rows={3}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:bg-white focus:border-[#f25c22]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-[#f25c22] hover:bg-[#d94d1a] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-xs transition shadow flex items-center gap-2"
              >
                {saving ? (
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                ) : 'Lưu cấu hình Widget'}
              </button>
            </div>
          </form>

          {/* Cột phải: Xem trước & Mã nhúng */}
          <div className="lg:col-span-5 space-y-6">
            {/* Box mã nhúng */}
            <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-lg border border-slate-800 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2">
                <span>💻</span> Mã nhúng Website ngoài
              </h3>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Sao chép mã script này và dán vào trước thẻ kết thúc <code className="text-white bg-slate-800 px-1 rounded">&lt;/body&gt;</code> của bất kỳ trang web nào (WordPress, Shopify, HTML tĩnh...) để nhúng chatbot nổi.
              </p>
              
              <div className="relative bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[10px] text-emerald-400 break-all select-all shadow-inner pr-12 min-h-[60px] flex items-center">
                {embedScript}
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="absolute right-2 top-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-white hover:text-orange-400 rounded-lg transition"
                  title="Sao chép"
                >
                  📋
                </button>
              </div>
            </div>

            {/* Khung mô phỏng xem trước */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm min-h-[460px] flex flex-col justify-between relative overflow-hidden">
              <div className="text-center">
                <span className="px-2.5 py-1 rounded-full bg-slate-200/60 border border-slate-300/40 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Live Preview Canvas
                </span>
                <p className="text-[10px] text-slate-400 mt-2">Bấm vào bong bóng chat bên dưới để mở/đóng và xem trước giao diện thực tế.</p>
              </div>

              {/* Chat panel preview */}
              {previewOpen && (
                <div 
                  className="w-full max-w-[320px] h-[380px] bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200 self-center"
                >
                  {/* Header Preview */}
                  <div 
                    className="p-3 text-white flex items-center gap-3"
                    style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor2})` }}
                  >
                    <div className="relative">
                      {avatarUrl ? (
                        <div 
                          className="w-9 h-9 rounded-full bg-cover bg-center border border-white/40"
                          style={{ backgroundImage: `url('${avatarUrl}')` }}
                        ></div>
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-white/20 border border-white/40 flex items-center justify-center font-bold text-xs uppercase">
                          {botName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="w-2.5 h-2.5 bg-emerald-500 border border-white rounded-full absolute bottom-0 right-0 animate-pulse"></div>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold leading-tight">{title}</h4>
                      <p className="text-[9px] opacity-80 mt-0.5">Trực tuyến - phản hồi tức thì</p>
                    </div>
                  </div>

                  {/* Message History Preview */}
                  <div className="flex-1 p-3 overflow-y-auto space-y-2 bg-slate-50/50 flex flex-col">
                    <div className="p-2.5 bg-slate-200/80 text-slate-800 rounded-2xl rounded-bl-sm text-xs leading-relaxed max-w-[85%] self-start">
                      {welcomeMessage}
                    </div>
                    <div 
                      className="p-2.5 text-white rounded-2xl rounded-br-sm text-xs leading-relaxed max-w-[85%] self-end shadow"
                      style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor2})` }}
                    >
                      Xin chào bot! Đây là tin nhắn mẫu từ người truy cập.
                    </div>
                  </div>

                  {/* Input Form Preview */}
                  <div className="p-2 border-t border-slate-100 flex gap-2 bg-white">
                    <input
                      type="text"
                      placeholder="Nhập tin nhắn..."
                      disabled
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 text-xs outline-none"
                    />
                    <div 
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs cursor-not-allowed opacity-80"
                      style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor2})` }}
                    >
                      ➤
                    </div>
                  </div>
                </div>
              )}

              {/* Chat bubble button preview */}
              <button
                type="button"
                onClick={() => setPreviewOpen(!previewOpen)}
                className="w-12 h-12 rounded-full text-white flex items-center justify-center shadow-lg transition transform hover:scale-105 active:scale-95 self-end"
                style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor2})` }}
              >
                <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.598.598 0 01-.655-.07.598.598 0 01-.165-.63l.89-3.21A7.901 7.901 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
