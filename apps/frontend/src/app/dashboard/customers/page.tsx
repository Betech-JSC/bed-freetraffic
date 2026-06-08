'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLocale } from '@/context/LocaleContext';

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Mới',
  ACTIVE: 'Đang chăm sóc',
  NEED_FOLLOWUP: 'Cần follow-up',
  VIP: 'VIP',
  INACTIVE: 'Ngừng liên hệ',
};

const DEFAULT_CARE_HTML = `<p>Xin chào {ten},</p>
<p>Chúng tôi liên hệ để chăm sóc và hỗ trợ bạn.</p>
<p>Ghi chú: {ghi_chu}</p>
<p>Trân trọng,<br/>Đội ngũ Be Traffic</p>`;

type CustomerRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  status: string;
  lastContactAt: string | null;
  notes: { content: string; createdAt: string }[];
  _count: { emailLogs: number; notes: number };
};

type CustomerNote = { id: number; content: string; createdAt: string };

type CustomerDetail = Omit<CustomerRow, 'notes'> & {
  notes: CustomerNote[];
  emailLogs: {
    id: number;
    subject: string;
    status: string;
    errorMessage: string | null;
    sentAt: string;
    channel: string;
  }[];
};

export default function CustomersPage() {
  const [allCustomers, setAllCustomers] = useState<CustomerRow[]>([]);
  const { t, locale } = useLocale();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  // Client-side filtering
  const customers = allCustomers.filter((c) => {
    if (filterStatus && c.status !== filterStatus) return false;
    if (searchDebounced) {
      const q = searchDebounced.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.company && c.company.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', phone: '', company: '', status: 'NEW', note: '' });

  // Mailchimp sync states
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [mcLists, setMcLists] = useState<any[]>([]);
  const [selectedMcListId, setSelectedMcListId] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState('');

  // Import states
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  const [newNote, setNewNote] = useState('');
  const [careSubject, setCareSubject] = useState('Chúng tôi luôn sẵn sàng hỗ trợ bạn');
  const [careHtml, setCareHtml] = useState(DEFAULT_CARE_HTML);
  const [sending, setSending] = useState(false);
  const [careChannel, setCareChannel] = useState<'email' | 'zalo' | 'messenger'>('email');

  const insertPlaceholder = (ph: string) => {
    setCareHtml((prev) => prev + ph);
  };

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadList = useCallback(async () => {
    const data = await apiJson<CustomerRow[]>('/customers');
    setAllCustomers(Array.isArray(data) ? data : []);
    setLoadError('');
  }, []);

  const loadDetail = async (id: number) => {
    setDetail(await apiJson<CustomerDetail>(`/customers/${id}`));
  };

  const refreshList = useCallback(() => {
    setLoading(true);
    loadList()
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : 'Lỗi tải danh sách');
        setAllCustomers([]);
      })
      .finally(() => setLoading(false));
  }, [loadList]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    loadDetail(selectedId).catch(() => setDetail(null));
  }, [selectedId]);

  const toggleCheck = (id: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (checked.size === customers.length) setChecked(new Set());
    else setChecked(new Set(customers.map((c) => c.id)));
  };

  const addCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    try {
      await apiJson('/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      setShowAdd(false);
      setAddForm({ name: '', email: '', phone: '', company: '', status: 'NEW', note: '' });
      setSuccess('Đã thêm khách hàng');
      await loadList();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Không thêm được');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa khách hàng này không? Mọi thông tin ghi chú và nhật ký tương tác sẽ bị xóa vĩnh viễn.')) return;
    setActionError('');
    setSuccess('');
    try {
      await apiJson(`/customers/${id}`, { method: 'DELETE' });
      setSuccess('Đã xóa khách hàng thành công');
      setSelectedId(null);
      setChecked((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await loadList();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Không thể xóa khách hàng');
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    setActionError('');
    setSuccess('');
    try {
      await apiJson(`/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setSuccess('Đã cập nhật trạng thái khách hàng');
      await loadDetail(id);
      await loadList();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Không thể cập nhật trạng thái');
    }
  };

  const addNote = async () => {
    if (!selectedId || !newNote.trim()) return;
    setActionError('');
    try {
      await apiJson(`/customers/${selectedId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote }),
      });
      setNewNote('');
      setSuccess('Đã lưu ghi chú');
      await loadDetail(selectedId);
      await loadList();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Không lưu ghi chú');
    }
  };

  const sendCare = async () => {
    const ids = checked.size > 0 ? [...checked] : selectedId ? [selectedId] : [];
    if (ids.length === 0) {
      setActionError('Chọn khách (ô tick) hoặc mở hồ sơ một khách để gửi');
      return;
    }
    
    if (careChannel === 'zalo') {
      if (checked.size === 0 && selectedId && detail && !detail.phone) {
        setActionError('Khách hàng này chưa có số điện thoại để nhận tin nhắn Zalo.');
        return;
      }
    }

    setSending(true);
    setActionError('');
    setSuccess('');
    try {
      const r = await apiJson<{ message: string; sent: number; total: number; errors?: string[] }>(
        '/customers/send-care',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerIds: ids,
            subject: careSubject,
            htmlContent: careHtml,
            channel: careChannel,
          }),
        }
      );
      setSuccess(r.message);
      if (r.errors?.length) setActionError(r.errors.join('\n'));
      setChecked(new Set());
      await loadList();
      if (selectedId) await loadDetail(selectedId);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Gửi chăm sóc thất bại');
    } finally {
      setSending(false);
    }
  };

  const openSyncModal = async () => {
    setSyncError('');
    setSuccess('');
    try {
      setSyncLoading(true);
      const data = await apiJson<any[]>('/integrations/mailchimp/lists');
      setMcLists(data);
      if (data.length > 0) {
        setSelectedMcListId(data[0].id);
      }
      setShowSyncModal(true);
    } catch (e: any) {
      setActionError(e.message || t('Chưa cấu hình Mailchimp trong Cài đặt hoặc không thể kết nối.'));
    } finally {
      setSyncLoading(false);
    }
  };

  const handleMailchimpSync = async () => {
    if (!selectedMcListId) return;
    setSyncLoading(true);
    setSyncError('');
    try {
      const res = await apiJson<{ message: string }>('/integrations/mailchimp/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listId: selectedMcListId })
      });
      setSuccess(res.message);
      setShowSyncModal(false);
      refreshList();
    } catch (e: any) {
      setSyncError(e.message || t('Đồng bộ thất bại'));
    } finally {
      setSyncLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setImportText(text);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImportLoading(true);
    setImportError('');
    setImportSuccess('');

    let parsedCustomers: any[] = [];
    const text = importText.trim();

    if (!text) {
      setImportError('Vui lòng dán dữ liệu hoặc tải file CSV/JSON.');
      setImportLoading(false);
      return;
    }

    if (text.startsWith('[') && text.endsWith(']')) {
      try {
        parsedCustomers = JSON.parse(text);
      } catch (err: any) {
        setImportError('Định dạng JSON không hợp lệ: ' + err.message);
        setImportLoading(false);
        return;
      }
    } else {
      const lines = text.split('\n');
      if (lines.length === 0) {
        setImportError('Dữ liệu rỗng.');
        setImportLoading(false);
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const hasHeader = headers.includes('email') || headers.includes('name') || headers.includes('tên');

      const startIdx = hasHeader ? 1 : 0;
      
      let nameIdx = 0;
      let emailIdx = 1;
      let phoneIdx = 2;
      let companyIdx = 3;
      let statusIdx = 4;

      if (hasHeader) {
        nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('tên') || h.includes('họ tên'));
        emailIdx = headers.findIndex((h) => h.includes('email') || h.includes('thư'));
        phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('sđt') || h.includes('điện thoại'));
        companyIdx = headers.findIndex((h) => h.includes('company') || h.includes('công ty'));
        statusIdx = headers.findIndex((h) => h.includes('status') || h.includes('trạng thái'));
      }

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) => {
          let val = c.trim();
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1).trim();
          }
          return val;
        });

        const name = cols[nameIdx] || '';
        const email = cols[emailIdx] || '';
        const phone = phoneIdx !== -1 ? cols[phoneIdx] || null : null;
        const company = companyIdx !== -1 ? cols[companyIdx] || null : null;
        const status = statusIdx !== -1 && cols[statusIdx] ? cols[statusIdx].toUpperCase() : 'NEW';

        if (name && email) {
          parsedCustomers.push({ name, email, phone, company, status });
        }
      }
    }

    if (parsedCustomers.length === 0) {
      setImportError('Không tìm thấy bản ghi khách hàng nào hợp lệ (cần ít nhất cột Tên và Email).');
      setImportLoading(false);
      return;
    }

    try {
      const res = await apiJson<{ message: string }>('/customers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customers: parsedCustomers }),
      });

      setImportSuccess(res.message);
      setImportText('');
      setTimeout(() => {
        setShowImport(false);
        setImportSuccess('');
      }, 2000);
      await loadList();
    } catch (err: any) {
      setImportError(err.message || 'Lỗi khi gửi dữ liệu lên server.');
    } finally {
      setImportLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status.toUpperCase()) {
      case 'NEW':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'ACTIVE':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'NEED_FOLLOWUP':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'VIP':
        return 'bg-purple-50 text-purple-700 border-purple-200 font-extrabold shadow-sm';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const needsBackendRestart = loadError.includes('404') || loadError.includes('Không kết nối');

  // Compute metrics
  const totalCustomers = allCustomers.length;
  const vipCustomers = allCustomers.filter((c) => c.status === 'VIP').length;
  const needFollowUpCustomers = allCustomers.filter((c) => c.status === 'NEED_FOLLOWUP').length;

  return (
    <div className="page-container">
      <PageHeader
        title={t('customerTitle')}
        description={t('customerDesc')}
        actions={
          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex items-center gap-1.5" onClick={() => setShowImport(true)}>
              📥 Import Khách Hàng
            </button>
            <button type="button" className="btn-secondary flex items-center gap-1.5" onClick={openSyncModal} disabled={syncLoading}>
              {syncLoading ? t('Đang tải...') : t('Đồng bộ Mailchimp')}
            </button>
            <button type="button" className="btn-primary" onClick={() => setShowAdd(true)}>
              + {t('addCustomer')}
            </button>
          </div>
        }
      />

      {loadError && (
        <div className="alert-error flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span>{loadError}</span>
          {needsBackendRestart && (
            <code className="text-xs bg-red-100/80 px-2 py-1 rounded-lg shrink-0">
              npm run dev -w apps/backend
            </code>
          )}
          <button type="button" className="btn-secondary text-xs shrink-0" onClick={refreshList}>
            Thử lại
          </button>
        </div>
      )}
      {actionError && <p className="alert-error text-sm whitespace-pre-wrap">{actionError}</p>}
      {success && <p className="alert-info text-sm">{success}</p>}

      {/* Onboarding Guide Banner */}
      <div className="bg-brand/5 border border-brand/10 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
        <div>
          <h4 className="font-bold text-slate-800 text-sm">Hướng dẫn chăm sóc khách hàng</h4>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Chọn một khách hàng ở danh sách bên trái để xem hồ sơ chi tiết. Khi soạn email gửi hàng loạt hoặc cá nhân, bạn có thể bấm vào để chèn nhanh: 
            <button
              type="button"
              className="mx-1 bg-brand/10 border border-brand/20 px-1.5 py-0.5 rounded text-brand font-mono text-[10px] font-bold transition-all hover:bg-brand/20 hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
              title="Click để chèn {ten}"
              onClick={() => insertPlaceholder('{ten}')}
            >
              {'{ten}'}
            </button>
            để gọi tên khách, hoặc 
            <button
              type="button"
              className="mx-1 bg-brand/10 border border-brand/20 px-1.5 py-0.5 rounded text-brand font-mono text-[10px] font-bold transition-all hover:bg-brand/20 hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
              title="Click để chèn {ghi_chu}"
              onClick={() => insertPlaceholder('{ghi_chu}')}
            >
              {'{ghi_chu}'}
            </button>
            để đính kèm ghi chú chăm sóc mới nhất của họ. (Yêu cầu cấu hình SMTP trong Cài đặt).
          </p>
        </div>
      </div>

      {/* Summary CRM Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-brand/20 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center text-xs font-bold uppercase">CRM</div>
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase">{t('totalCustomers')}</div>
            <div className="text-2xl font-extrabold text-gray-900">{totalCustomers}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-brand/20 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-xs font-bold uppercase">VIP</div>
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase">{t('vipCustomers')}</div>
            <div className="text-2xl font-extrabold text-gray-900">{vipCustomers}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-brand/20 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-xs font-bold uppercase">ACT</div>
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase">{t('needFollowUp')}</div>
            <div className="text-2xl font-extrabold text-gray-900">{needFollowUpCustomers}</div>
          </div>
        </div>
      </div>

      {loadError && !loading ? (
        <div className="card p-12 text-center text-slate-500 max-w-lg mx-auto">
          <p className="text-lg font-semibold text-slate-800">Chưa kết nối được API khách hàng</p>
          <p className="text-sm mt-2 leading-relaxed">
            Thường do backend chưa chạy đúng phiên bản. Bạn hãy tắt terminal cũ và chạy lại lệnh khởi động.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Customer List Card */}
          <div className="lg:col-span-2 card p-0 overflow-hidden flex flex-col min-h-[420px] shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80">
              <h2 className="text-sm font-bold text-slate-800">{t('customerList')}</h2>
              <div className="flex gap-2 mt-3">
                <input
                  className="input flex-1 text-sm !py-2"
                  placeholder={t('searchPlaceholderCustomers')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Tìm khách hàng"
                />
                <select
                  className="input w-[7.5rem] text-sm !py-2 shrink-0 font-medium"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  aria-label="Lọc trạng thái"
                >
                  <option value="">Tất cả trạng thái</option>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              {customers.length > 0 && (
                <button type="button" className="text-xs text-brand font-bold mt-2 hover:underline" onClick={selectAll}>
                  {checked.size === customers.length 
                    ? (locale === 'en' ? 'Deselect all' : 'Bỏ chọn tất cả')
                    : t('selectCustomersToEmail')}
                </button>
              )}
            </div>

            {loading ? (
              <div className="p-8 space-y-3 flex-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : customers.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <p className="font-bold text-slate-800">{t('noCustomers')}</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                  {locale === 'en' 
                    ? 'Add your first customer to start tracking notes and email interactions.' 
                    : 'Nhập khách hàng đầu tiên để bắt đầu lưu vết ghi chú và tương tác email.'}
                </p>
                <button type="button" className="btn-primary text-xs mt-4" onClick={() => setShowAdd(true)}>
                  + {t('addCustomer')}
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto custom-scrollbar flex-1">
                {customers.map((c) => (
                  <li key={c.id}>
                    <div
                      className={`flex gap-3 p-3.5 cursor-pointer border-l-4 transition-all ${
                        selectedId === c.id ? 'bg-brand/5 border-brand' : 'hover:bg-slate-50 border-transparent'
                      }`}
                      onClick={() => setSelectedId(c.id)}
                    >
                      <input
                        type="checkbox"
                        checked={checked.has(c.id)}
                        onChange={() => toggleCheck(c.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                        aria-label={`Chọn ${c.name}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-1">
                          <p className="font-bold text-slate-800 text-sm truncate">{c.name}</p>
                          <span className={`px-2 py-0.5 border rounded text-[9px] font-extrabold uppercase tracking-wide shrink-0 ${getStatusBadgeClass(c.status)}`}>
                            {STATUS_LABELS[c.status] || c.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{c.email}</p>
                        {c.notes[0] && (
                          <p className="text-[10px] text-slate-400 truncate mt-2 bg-slate-50 p-1 border rounded" title={c.notes[0].content}>
                            {c.notes[0].content}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Customer Details & Care Cards */}
          <div className="lg:col-span-3 space-y-5 min-h-[420px]">
            {detail ? (
              <>
                {/* Info Card */}
                <div className="card p-5 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-black text-slate-800">{detail.name}</h3>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">{detail.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <select
                        value={detail.status}
                        onChange={(e) => handleStatusChange(detail.id, e.target.value)}
                        className={`text-xs font-bold px-2 py-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 cursor-pointer transition-all ${getStatusBadgeClass(detail.status)}`}
                      >
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k} className="bg-white text-slate-800 font-medium">
                            {v}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleDelete(detail.id)}
                        className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-2.5 py-1 rounded-lg font-bold transition-all shadow-sm"
                      >
                        🗑️ Xóa khách hàng
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t text-slate-600">
                    <div>
                      <span className="font-bold text-slate-400 uppercase tracking-wide">Số điện thoại:</span>
                      <p className="text-slate-800 font-medium mt-0.5">{detail.phone || '—'}</p>
                    </div>
                    <div>
                      <span className="font-bold text-slate-400 uppercase tracking-wide">Công ty:</span>
                      <p className="text-slate-800 font-medium mt-0.5">{detail.company || '—'}</p>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 pt-2 border-t">
                    {detail.notes.length} ghi chú · {detail.emailLogs.length} email chăm sóc đã gửi
                    {detail.lastContactAt && ` · Tương tác gần nhất: ${new Date(detail.lastContactAt).toLocaleString('vi-VN')}`}
                  </p>
                </div>

                {/* Notes Card */}
                <div className="card p-5 space-y-3 shadow-sm">
                  <h4 className="font-bold text-slate-800 text-sm">Ghi chú chăm sóc tiến độ</h4>
                  <div className="flex gap-2">
                    <textarea
                      className="input flex-1 min-h-[64px] text-xs py-2"
                      placeholder="Nhập ghi chú mới (Ví dụ: Đã gọi điện tư vấn, khách thích gói Pro, hẹn gọi lại...)"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                    />
                    <button type="button" className="btn-secondary px-4 text-xs font-bold border-slate-200" onClick={addNote}>
                      Lưu Note
                    </button>
                  </div>
                  <ul className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {detail.notes.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        Chưa có ghi chú nào. Hãy tạo note mới để lưu lịch sử làm việc với khách.
                      </p>
                    ) : (
                      detail.notes.map((n) => (
                        <li key={n.id} className="text-xs bg-slate-50/50 hover:bg-slate-50 rounded-lg p-2.5 border border-slate-100 transition-colors">
                          <p className="text-slate-700 leading-relaxed">{n.content}</p>
                          <p className="text-[10px] text-slate-400 mt-1.5 font-medium">{new Date(n.createdAt).toLocaleString('vi-VN')}</p>
                        </li>
                      ))
                    )}
                  </ul>
                </div>

                {/* Composer card */}
                <div className="card p-5 space-y-4 shadow-sm">
                  <h4 className="font-bold text-slate-800 text-sm">Soạn Tin Nhắn / Email Chăm Sóc Khách Hàng</h4>
                  
                  {/* Channel selection */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Chọn kênh gửi chăm sóc</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setCareChannel('email')}
                        className={`py-2 px-3 rounded-lg border text-center transition-all text-xs font-semibold ${
                          careChannel === 'email'
                            ? 'bg-orange-500/10 border-orange-500/30 text-[#f25c22]'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/50'
                        }`}
                      >
                        Email
                      </button>
                      <button
                        type="button"
                        onClick={() => setCareChannel('zalo')}
                        className={`py-2 px-3 rounded-lg border text-center transition-all text-xs font-semibold ${
                          careChannel === 'zalo'
                            ? 'bg-orange-500/10 border-orange-500/30 text-[#f25c22]'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/50'
                        }`}
                      >
                        Zalo
                      </button>
                      <button
                        type="button"
                        onClick={() => setCareChannel('messenger')}
                        className={`py-2 px-3 rounded-lg border text-center transition-all text-xs font-semibold ${
                          careChannel === 'messenger'
                            ? 'bg-orange-500/10 border-orange-500/30 text-[#f25c22]'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/50'
                        }`}
                      >
                        Messenger
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <input
                      className="input text-xs font-medium w-full"
                      value={careSubject}
                      onChange={(e) => setCareSubject(e.target.value)}
                      placeholder={careChannel === 'email' ? 'Tiêu đề thư' : 'Tiêu đề tin nhắn chăm sóc'}
                    />
                    <textarea
                      className="input min-h-[140px] text-xs font-mono w-full p-3 bg-slate-50 focus:bg-white"
                      value={careHtml}
                      onChange={(e) => setCareHtml(e.target.value)}
                    />
                  </div>
                  <button type="button" className="btn-primary w-full py-2.5 text-xs font-bold" disabled={sending} onClick={sendCare}>
                    {sending
                      ? 'Đang thực hiện gửi...'
                      : checked.size > 0
                      ? `Gửi qua ${careChannel.toUpperCase()} cho ${checked.size} khách hàng đã chọn`
                      : `Gửi tin nhắn ${careChannel.toUpperCase()} cho khách hàng này`}
                  </button>
                </div>

                {/* Interaction log history card */}
                <div className="card p-5 shadow-sm">
                  <h4 className="font-bold text-slate-800 text-sm mb-3">Lịch sử tương tác chăm sóc</h4>
                  {detail.emailLogs.length === 0 ? (
                    <p className="text-xs text-slate-400">Chưa có lịch sử chăm sóc nào được gửi cho khách hàng này.</p>
                  ) : (
                    <ul className="space-y-3 text-xs max-h-40 overflow-y-auto custom-scrollbar">
                      {detail.emailLogs.map((log) => (
                        <li key={log.id} className="border-b border-slate-100 pb-2.5 last:border-b-0 space-y-1.5">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex gap-2 items-center flex-1 min-w-0">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider shrink-0 ${
                                log.channel === 'zalo'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : log.channel === 'messenger'
                                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                  : 'bg-orange-50 text-[#f25c22] border border-orange-200/60'
                              }`}>
                                {log.channel === 'zalo' ? 'Zalo' : log.channel === 'messenger' ? 'Mess' : 'Mail'}
                              </span>
                              <span className="font-semibold text-slate-700 truncate">{log.subject}</span>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                              log.status === 'SENT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {log.status === 'SENT' ? 'Thành công' : 'Lỗi'}
                            </span>
                          </div>
                          <span className="block text-[10px] text-slate-400">{new Date(log.sentAt).toLocaleString('vi-VN')}</span>
                          {log.errorMessage && <span className="text-[10px] text-red-500 block font-medium">{log.errorMessage}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <div className="card p-12 text-center text-slate-500 h-full flex flex-col items-center justify-center min-h-[420px] shadow-sm border border-dashed border-slate-200">
                <p className="text-lg font-bold text-slate-700">Chưa mở hồ sơ chi tiết</p>
                <p className="text-xs text-slate-400 mt-1.5">Chọn một khách hàng trong danh sách bên trái hoặc bấm <strong>+ Thêm khách hàng</strong> mới để bắt đầu chăm sóc.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <form className="modal-panel max-w-md space-y-4" onClick={(e) => e.stopPropagation()} onSubmit={addCustomer}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-brand">Thêm khách hàng mới</h3>
              <button type="button" onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-650 font-bold">Đóng</button>
            </div>
            
            <div className="space-y-3">
              <input className="input text-xs py-2.5" placeholder="Họ tên khách hàng *" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} required />
              <input className="input text-xs py-2.5" type="email" placeholder="Địa chỉ Email *" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} required />
              <input className="input text-xs py-2.5" placeholder="Số điện thoại" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} />
              <input className="input text-xs py-2.5" placeholder="Tên công ty" value={addForm.company} onChange={(e) => setAddForm({ ...addForm, company: e.target.value })} />
              
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Trạng thái chăm sóc</label>
                <select className="input text-xs font-semibold py-2.5 w-full" value={addForm.status} onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                className="input text-xs min-h-[80px] p-2"
                placeholder="Ghi chú đầu tiên (Ví dụ: Khách quan tâm dịch vụ, nguồn giới thiệu từ facebook...)"
                value={addForm.note}
                onChange={(e) => setAddForm({ ...addForm, note: e.target.value })}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowAdd(false)}>
                Hủy
              </button>
              <button type="submit" className="btn-primary flex-1">
                Lưu khách hàng
              </button>
            </div>
          </form>
        </div>
      )}
      {showSyncModal && (
        <div className="modal-overlay" onClick={() => setShowSyncModal(false)}>
          <div className="modal-panel max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-teal-800 flex items-center gap-2">
                {t('Đồng bộ Mailchimp')}
              </h3>
              <button type="button" onClick={() => setShowSyncModal(false)} className="text-gray-400 hover:text-gray-650 font-bold">Đóng</button>
            </div>
            
            <p className="text-xs text-slate-500">
              {t('Đồng bộ toàn bộ danh sách khách hàng trong CRM lên danh sách Audience của Mailchimp.')}
            </p>

            {syncError && <p className="alert-error text-xs">{syncError}</p>}

            {mcLists.length === 0 ? (
              <p className="text-xs text-amber-600 font-medium">
                {t('Không tìm thấy Audience List nào. Hãy tạo danh sách trên Mailchimp trước.')}
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    {t('Chọn Audience List')}
                  </label>
                  <select 
                    className="input text-xs font-semibold py-2.5 w-full" 
                    value={selectedMcListId} 
                    onChange={(e) => setSelectedMcListId(e.target.value)}
                  >
                    {mcLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name} ({list.memberCount} {t('thành viên')})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowSyncModal(false)}>
                {t('Hủy')}
              </button>
              <button 
                type="button" 
                className="btn-primary flex-1 bg-teal-700 hover:bg-teal-800 text-white font-bold" 
                disabled={syncLoading || mcLists.length === 0}
                onClick={handleMailchimpSync}
              >
                {syncLoading ? t('Đang đồng bộ...') : t('Đồng bộ ngay')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="modal-overlay animate-fade-in" onClick={() => setShowImport(false)}>
          <div className="modal-panel max-w-lg space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="text-base font-black text-brand uppercase tracking-wider">📥 Nhập khách hàng hàng loạt</h3>
              <button type="button" onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-650 font-bold cursor-pointer">Đóng</button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Bạn có thể dán trực tiếp dữ liệu danh sách khách hàng dưới dạng **CSV** (dòng đầu chứa tiêu đề: <code className="font-mono text-brand">name, email, phone, company, status</code>) hoặc định dạng **JSON Array** của các đối tượng khách hàng. Hoặc bấm chọn file để tải lên.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tải file từ máy tính (CSV/JSON)</label>
                <input 
                  type="file" 
                  accept=".csv,.json"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Dán dữ liệu trực tiếp *</label>
                <textarea
                  className="input font-mono text-xs w-full min-h-[160px] p-2 bg-slate-50 focus:bg-white"
                  placeholder="name,email,phone,company,status&#10;Nguyen Van A,a@gmail.com,0901234567,ABC Corp,NEW&#10;Nguyen Van B,b@gmail.com,0987654321,XYZ Co,VIP"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
              </div>
            </div>

            {importError && <p className="alert-error text-xs whitespace-pre-wrap">{importError}</p>}
            {importSuccess && <p className="alert-info text-xs">{importSuccess}</p>}

            <div className="flex gap-2 pt-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowImport(false)}>
                Hủy
              </button>
              <button 
                type="button" 
                className="btn-primary flex-1 font-bold" 
                disabled={importLoading || !importText.trim()}
                onClick={handleImport}
              >
                {importLoading ? 'Đang import...' : 'Bắt đầu Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
