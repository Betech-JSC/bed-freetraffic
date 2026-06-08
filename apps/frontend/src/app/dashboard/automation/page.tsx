'use client';

import React, { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import Link from 'next/link';
import { apiJson } from '@/lib/api';
import type { FacebookBotStatus } from '@/components/settings/FacebookConnectCard';
import { useLocale } from '@/context/LocaleContext';

function parsePlatforms(platforms: unknown): string[] {
  if (Array.isArray(platforms)) return platforms;
  if (typeof platforms !== 'string') return [];
  try {
    const p = JSON.parse(platforms);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

// No inline SVG icons

export default function AutomationPage() {
  const { t } = useLocale();
  const [tasks, setTasks] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [urlTarget, setUrlTarget] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['facebook']);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [abTestId, setAbTestId] = useState('');
  const [useAi, setUseAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerateImage, setAiGenerateImage] = useState(false);
  const [rssUrl, setRssUrl] = useState('');
  const [abTests, setAbTests] = useState<{ id: number; name: string }[]>([]);
  const [fbBotStatus, setFbBotStatus] = useState<FacebookBotStatus | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [triggeringId, setTriggeringId] = useState<number | null>(null);

  // CRM selection states
  const [crmCustomers, setCrmCustomers] = useState<any[]>([]);
  const [showCustomerSelect, setShowCustomerSelect] = useState(false);

  // Edit bot states
  const [editingTask, setEditingTask] = useState<any | null>(null);

  // Console local states
  const [clearedLogIds, setClearedLogIds] = useState<number[]>([]);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  const fetchData = async (silent = false) => {
    if (!silent) setError('');
    try {
      const [taskData, logData, testsData, fbStatus, customersData] = await Promise.all([
        apiJson<any[]>('/automation/tasks'),
        apiJson<any[]>('/automation/logs'),
        apiJson<{ id: number; name: string }[]>('/abtests/running').catch(() => []),
        apiJson<FacebookBotStatus>('/social/facebook/status').catch(() => null),
        apiJson<any[]>('/customers').catch(() => []),
      ]);
      setFbBotStatus(fbStatus);
      setAbTests(testsData);
      setTasks(Array.isArray(taskData) ? taskData : []);
      setLogs(Array.isArray(logData) ? logData : []);
      setCrmCustomers(Array.isArray(customersData) ? customersData : []);
    } catch (e: unknown) {
      if (!silent) {
        setError(e instanceof Error ? e.message : t('Không tải được dữ liệu Bot'));
      }
      if (!silent) {
        setTasks([]);
        setLogs([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Tự động load lại log mỗi 3 giây (Live-Log)
    const interval = setInterval(() => {
      fetchData(true);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async (id: number) => {
    try {
      await apiJson(`/automation/tasks/${id}/toggle`, { method: 'POST' });
      await fetchData(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không đổi trạng thái Bot'));
    }
  };

  const handleTrigger = async (id: number) => {
    setTriggeringId(id);
    setError('');
    try {
      await apiJson(`/automation/tasks/${id}/trigger`, { method: 'POST' });
      await fetchData(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không chạy được bot'));
    } finally {
      setTriggeringId(null);
    }
  };

  const toggleCustomerEmail = (email: string) => {
    const currentEmails = emailRecipients
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    if (currentEmails.includes(email)) {
      const filtered = currentEmails.filter((e) => e !== email);
      setEmailRecipients(filtered.join(', '));
    } else {
      currentEmails.push(email);
      setEmailRecipients(currentEmails.join(', '));
    }
  };

  const handleOpenCreate = () => {
    setEditingTask(null);
    setName('');
    setUrlTarget('');
    setRssUrl('');
    setEmailRecipients('');
    setAbTestId('');
    setUseAi(false);
    setAiPrompt('');
    setAiGenerateImage(false);
    setPlatforms(['facebook']);
    setShowCustomerSelect(false);
    setShowModal(true);
  };

  const handleOpenEdit = (task: any) => {
    setEditingTask(task);
    setName(task.name);
    setUrlTarget(task.urlTarget);
    setPlatforms(parsePlatforms(task.platforms));
    setEmailRecipients(task.emailRecipients || '');
    setAbTestId(task.abTestId?.toString() || '');
    setUseAi(task.useAi);
    setAiPrompt(task.aiPrompt || '');
    setAiGenerateImage(task.aiGenerateImage);
    setRssUrl(task.rssUrl || '');
    setShowCustomerSelect(false);
    setShowModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await apiJson(`/automation/tasks/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await fetchData(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không xóa được chiến dịch'));
    } finally {
      setDeleting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (platforms.includes('facebook') && (!urlTarget.trim() || urlTarget.trim() === '0')) {
      setError(t('Facebook Bot cần URL đích đầy đủ (vd: https://website-cua-ban.com).'));
      return;
    }

    const body = {
      name,
      urlTarget,
      platforms,
      emailRecipients: platforms.includes('email') ? emailRecipients : undefined,
      abTestId: abTestId ? parseInt(abTestId, 10) : undefined,
      useAi,
      aiPrompt: useAi ? aiPrompt : undefined,
      aiGenerateImage: useAi ? aiGenerateImage : undefined,
      rssUrl: rssUrl.trim() || undefined,
    };

    try {
      if (editingTask) {
        await apiJson(`/automation/tasks/${editingTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await apiJson('/automation/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...body,
            interval: 60,
          }),
        });
      }
      setShowModal(false);
      setName('');
      setUrlTarget('');
      setRssUrl('');
      setEmailRecipients('');
      setAbTestId('');
      setUseAi(false);
      setAiPrompt('');
      setAiGenerateImage(false);
      setPlatforms(['facebook']);
      setEditingTask(null);
      setShowCustomerSelect(false);
      await fetchData(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Không lưu được cấu hình Bot'));
    }
  };

  const togglePlatform = (platform: string) => {
    setPlatforms(prev => 
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
    );
  };

  // Metrics calculation
  const totalBots = tasks.length;
  const activeBots = tasks.filter(task => task.status === 'RUNNING').length;
  
  const totalLogs = logs.length;
  const successLogs = logs.filter(l => l.status === 'SUCCESS').length;
  const successRate = totalLogs > 0 ? Math.round((successLogs / totalLogs) * 100) : 100;

  // Filter logs for Cyberpunk Console
  const visibleLogs = logs
    .filter(l => !clearedLogIds.includes(l.id))
    .filter(l => !showErrorsOnly || l.status !== 'SUCCESS');

  const getPlatformBadge = (p: string) => {
    switch (p.toLowerCase()) {
      case 'facebook':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'email':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'zalo':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'youtube':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200'; // community
    }
  };

  return (
    <div className="space-y-8 page-container">
      <PageHeader
        title="Automation Engine"
        description={t('FR-08 — Cấu hình Bot tự động quét bài đăng kéo traffic định kỳ (Facebook, Zalo, Email, YouTube).')}
        actions={
          <button type="button" onClick={handleOpenCreate} className="btn-primary flex items-center gap-1">
            {t('Tạo chiến dịch')}
          </button>
        }
      />

      {error && <div className="alert-error text-sm">{error}</div>}

      {/* Warnings & Help Banner */}
      {platforms.includes('facebook') && fbBotStatus && !fbBotStatus.botReady && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950 flex items-start gap-3 shadow-sm">
          <div>
            <p className="font-bold">{t('Facebook chưa sẵn sàng — Bot không thể tự động đăng bài')}</p>
            <p className="text-slate-500 mt-0.5">{fbBotStatus.issues[0] || t('Vui lòng hoàn tất kết nối Fanpage trong phần Cài đặt.')}</p>
            <Link href="/dashboard/settings" className="inline-block mt-2 font-bold text-brand hover:underline">
              {t('Đi tới Cài đặt → Facebook')}
            </Link>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-brand/15 shadow-sm flex items-center gap-4 hover:border-brand/35 transition-all">
          <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand flex items-center justify-center text-xs font-extrabold uppercase">BOT</div>
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('Tổng số Bots')}</div>
            <div className="text-2xl font-extrabold text-gray-900 mt-0.5">{totalBots}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{t('Chiến dịch tự động đã cấu hình')}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-brand/15 shadow-sm flex items-center gap-4 hover:border-brand/35 transition-all">
          <div className="w-11 h-11 rounded-xl bg-green-50 text-green-600 flex items-center justify-center text-xs font-extrabold uppercase relative">
            CHẠY
            {activeBots > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500"></span>
              </span>
            )}
          </div>
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('Bots đang hoạt động')}</div>
            <div className="text-2xl font-extrabold text-gray-900 mt-0.5">{activeBots}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{t('Tự động cào quét kéo traffic định kỳ')}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-brand/15 shadow-sm flex items-center gap-4 hover:border-brand/35 transition-all">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xs font-extrabold uppercase">OK</div>
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('Tỷ lệ chạy thành công')}</div>
            <div className="text-2xl font-extrabold text-gray-900 mt-0.5">{successRate}%</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{t('Dựa trên logs chạy tự động gần nhất')}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Bots List Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-base font-bold text-slate-800">{t('Danh sách chiến dịch Bot')}</h2>
          </div>
          
          <div className="table-wrap">
            <table className="table-modern w-full">
              <thead>
                <tr>
                  <th className="p-4 font-bold text-xs text-slate-500 uppercase">{t('Tên Chiến dịch')}</th>
                  <th className="p-4 font-bold text-xs text-slate-500 uppercase">{t('URL Đích')}</th>
                  <th className="p-4 font-bold text-xs text-slate-500 uppercase">{t('Nền tảng')}</th>
                  <th className="p-4 font-bold text-xs text-slate-500 uppercase text-center">{t('Trạng thái')}</th>
                  <th className="p-4 font-bold text-xs text-slate-500 uppercase text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-400 text-xs">
                      {t('Chưa có Bot nào được cấu hình. Hãy tạo mới để bắt đầu tự động hóa kéo Traffic.')}
                    </td>
                  </tr>
                )}
                {tasks.map(task => (
                  <tr key={task.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="p-4 font-semibold text-slate-800">
                      <div className="flex items-center gap-1.5">
                        {task.name}
                        {task.useAi && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-purple-100 text-purple-700 tracking-wide uppercase">
                            AI
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-slate-500 truncate max-w-[180px]">
                      {task.rssUrl ? (
                        <div className="flex flex-col gap-0.5" title={`RSS: ${task.rssUrl}`}>
                          <span className="text-[10px] bg-orange-100 text-orange-850 px-1 py-0.5 rounded font-extrabold w-fit uppercase">RSS</span>
                          <a href={task.rssUrl} target="_blank" rel="noopener noreferrer" className="hover:text-brand hover:underline text-xs truncate block">
                            {task.rssUrl}
                          </a>
                        </div>
                      ) : (
                        <a href={task.urlTarget} target="_blank" rel="noopener noreferrer" className="hover:text-brand hover:underline truncate block" title={task.urlTarget}>
                          {task.urlTarget}
                        </a>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1 flex-wrap">
                        {parsePlatforms(task.platforms).map((p: string) => (
                          <span key={p} className={`px-2 py-0.5 border text-[10px] font-bold rounded-md uppercase tracking-wider ${getPlatformBadge(p)}`}>
                            {t(p)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                        task.status === 'RUNNING' 
                          ? 'bg-green-50 text-green-700 border-green-200' 
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${task.status === 'RUNNING' ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`}></span>
                        {task.status === 'RUNNING' ? t('Hoạt động') : t('Đã dừng')}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleTrigger(task.id)}
                          disabled={triggeringId === task.id}
                          className="p-1.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-600 hover:bg-orange-100 text-xs font-semibold px-2.5 py-1 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                          title={t('Kích hoạt chạy bot ngay lập tức')}
                        >
                          {triggeringId === task.id ? t('Đang chạy...') : t('Chạy ngay')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggle(task.id)}
                          className={`p-1.5 rounded-lg border text-xs font-semibold px-2.5 py-1 transition-all active:scale-95 cursor-pointer ${
                            task.status === 'RUNNING'
                              ? 'bg-red-50 text-red-600 border-red-150 hover:bg-red-100'
                              : 'bg-green-50 text-green-600 border-green-150 hover:bg-green-100'
                          }`}
                          title={task.status === 'RUNNING' ? t('Dừng Bot') : t('Kích hoạt Bot')}
                        >
                          {task.status === 'RUNNING' ? t('Dừng') : t('Chạy')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(task)}
                          className="p-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 text-xs font-semibold px-2.5 py-1 transition-all active:scale-95 cursor-pointer"
                          title={t('Chỉnh sửa cấu hình chiến dịch')}
                        >
                          {t('Sửa')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ id: task.id, name: task.name })}
                          className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-xs font-semibold px-2.5 py-1 transition-colors cursor-pointer active:scale-95"
                          title={t('Xóa chiến dịch')}
                        >
                          {t('Xóa')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: BetechPunk Live */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-base font-bold text-slate-800">BetechPunk Live</h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wider transition-colors cursor-pointer ${
                  showErrorsOnly 
                    ? 'bg-red-50 text-red-700 border-red-200' 
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                }`}
                onClick={() => setShowErrorsOnly(!showErrorsOnly)}
              >
                {showErrorsOnly ? t('Chỉ lỗi') : t('Tất cả')}
              </button>
              <button
                type="button"
                className="text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 uppercase tracking-wider cursor-pointer"
                onClick={() => setClearedLogIds(logs.map(l => l.id))}
              >
                {t('Xóa logs')}
              </button>
            </div>
          </div>
          
          <div className="rounded-2xl bg-slate-950 border border-orange-500/25 shadow-lg shadow-orange-500/5 p-4 h-[420px] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-mono tracking-wider ml-1">betech_bot_stream.log</span>
              </div>
              <span className="text-[9px] text-orange-500 font-mono tracking-widest animate-pulse font-bold">LIVE</span>
            </div>
            
            <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2 pr-1 custom-scrollbar text-white">
              {visibleLogs.length === 0 && (
                <div className="text-slate-500 text-center mt-12 italic">
                  {t('Đang đợi hoạt động của hệ thống bot...')}
                  <span className="inline-block w-1.5 h-3 bg-orange-500 ml-1 align-middle animate-cursor-blink"></span>
                </div>
              )}
              {visibleLogs.map(log => (
                <div key={log.id} className="flex gap-1.5 items-start leading-relaxed border-b border-slate-850/30 pb-1">
                  <span className="text-slate-400 shrink-0 select-none">[{new Date(log.createdAt).toLocaleTimeString()}]</span>
                  <div className="flex-1">
                    <span className="text-orange-400 font-bold">[{log.task?.name ?? 'Bot'}]</span>{' '}
                    <span className={log.status === 'SUCCESS' ? 'text-white' : 'text-red-400 font-bold'}>
                      {log.message}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        variant="danger"
        title={t('Xóa chiến dịch Bot?')}
        description={t('Chiến dịch sẽ bị gỡ khỏi hệ thống và Bot không còn chạy theo lịch đã cấu hình.')}
        highlight={deleteTarget?.name}
        details={[
          t('Toàn bộ nhật ký (logs) liên quan sẽ bị xóa sạch.'),
          t('Hành động này không thể được khôi phục.'),
        ]}
        confirmLabel={t('Xóa vĩnh viễn')}
        cancelLabel={t('Giữ lại')}
        loading={deleting}
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      {/* Modal - Create Campaign */}
      {showModal && (
        <div className="modal-overlay animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="modal-panel max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="text-base font-black text-brand uppercase tracking-wider">
                {editingTask ? t('Chỉnh sửa chiến dịch Bot') : t('Cấu hình Bot mới')}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-650 font-bold cursor-pointer">Đóng</button>
            </div>
            
            <form onSubmit={handleCreate} className="space-y-4 text-xs font-semibold text-slate-700">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('Tên chiến dịch *')}</label>
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="input text-xs w-full py-2"
                  placeholder={t('VD: Kéo Traffic Facebook bài viết Blog mới')}
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('URL Đích (Trang cần kéo traffic) *')}</label>
                <input 
                  type="url" 
                  required
                  value={urlTarget}
                  onChange={e => setUrlTarget(e.target.value)}
                  className="input text-xs w-full py-2"
                  placeholder="https://your-site.com/blog-url"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('Đường dẫn RSS nguồn (tùy chọn)')}</label>
                <input 
                  type="url" 
                  value={rssUrl}
                  onChange={e => setRssUrl(e.target.value)}
                  className="input text-xs w-full py-2"
                  placeholder={t('Ví dụ: https://vnexpress.net/rss/tin-moi-nhat.rss')}
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block font-normal">
                  {t('Nếu nhập RSS, Bot sẽ quét bài viết mới từ RSS để đăng tự động (URL đích của bài đăng sẽ là link bài viết).')}
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">{t('Chọn các kênh chạy tự động')}</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: 'facebook', label: 'Facebook' },
                    { id: 'email', label: 'Email' },
                    { id: 'zalo', label: 'Zalo OA' },
                    { id: 'youtube', label: 'YouTube' },
                    { id: 'community', label: 'Community' },
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePlatform(p.id)}
                      className={`px-3 py-1.5 rounded border transition-all text-[11px] font-bold cursor-pointer ${
                        platforms.includes(p.id)
                          ? 'bg-brand/10 border-brand/20 text-brand'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {t(p.label)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('Chiến dịch A/B test liên kết (tùy chọn)')}</label>
                <select
                  className="input text-xs font-semibold w-full py-2"
                  value={abTestId}
                  onChange={(e) => setAbTestId(e.target.value)}
                >
                  <option value="">{t('Không chạy A/B test')}</option>
                  {abTests.map((abTest) => (
                    <option key={abTest.id} value={abTest.id}>
                      {abTest.name}
                    </option>
                  ))}
                </select>
              </div>

              {platforms.includes('email') && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t('Danh sách Email nhận (phân cách bằng dấu phẩy)')}</label>
                  <input
                    type="text"
                    required
                    value={emailRecipients}
                    onChange={e => setEmailRecipients(e.target.value)}
                    className="input text-xs w-full py-2"
                    placeholder="email1@gmail.com, email2@company.com"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowCustomerSelect(!showCustomerSelect)} 
                    className="text-[10px] text-brand hover:underline font-bold mt-1 block cursor-pointer"
                  >
                    {showCustomerSelect ? 'Ẩn danh sách khách hàng CRM' : 'Chọn từ danh sách khách hàng CRM'}
                  </button>

                  {showCustomerSelect && (
                    <div className="mt-2 max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50 space-y-1.5 custom-scrollbar font-medium">
                      {crmCustomers.length === 0 ? (
                        <p className="text-[10px] text-slate-400 italic">Chưa có khách hàng nào trong CRM.</p>
                      ) : (
                        crmCustomers.map((cust) => {
                          const isSelected = emailRecipients
                            .split(',')
                            .map((e) => e.trim())
                            .filter(Boolean)
                            .includes(cust.email);
                          return (
                            <label key={cust.id} className="flex items-center gap-2 cursor-pointer py-0.5 hover:bg-slate-100 px-1 rounded transition-colors text-[10px] text-slate-700">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleCustomerEmail(cust.email)}
                                className="rounded border-slate-350 text-brand focus:ring-brand"
                              />
                              <span className="truncate">{cust.name} ({cust.email})</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* AI Assistant Toggle */}
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useAi}
                    onChange={(e) => setUseAi(e.target.checked)}
                    className="rounded border-slate-350 text-brand focus:ring-brand"
                  />
                  <span className="font-bold text-slate-700">{t('Tự động viết nội dung bằng AI (Gemini)')}</span>
                </label>
                
                {useAi && (
                  <div className="space-y-3 pl-5 border-l-2 border-brand/20 mt-1">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">{t('Định hướng phong cách / Yêu cầu viết bài')}</label>
                      <input
                        type="text"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        className="input text-xs py-1.5 w-full"
                        placeholder={t('Ví dụ: Giọng văn hài hước, kích thích click...')}
                      />
                    </div>
                    
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={aiGenerateImage}
                        onChange={(e) => setAiGenerateImage(e.target.checked)}
                        className="rounded border-slate-350 text-brand focus:ring-brand"
                      />
                      <span className="text-[11px] font-bold text-slate-650">{t('Sinh hình ảnh minh họa bằng AI (Pollinations)')}</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="pt-3 flex gap-2 border-t">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1 py-2 text-xs"
                >
                  {t('Hủy')}
                </button>
                <button type="submit" className="btn-primary flex-1 py-2 text-xs font-bold">
                  {editingTask ? t('Lưu thay đổi') : t('Kích hoạt Bot')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Local custom blinking cursor animation for cyberpunk console */}
      <style jsx global>{`
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-cursor-blink {
          animation: cursorBlink 1s infinite;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
