'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';

type Order = {
  id: number;
  orderNumber: string;
  totalAmount: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  paymentMethod: string | null;
  gatewayTxnId: string | null;
  source: string;
  createdAt: string;
  customer: {
    name: string;
    email: string;
  };
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Payment credentials credentials config state
  const [showConfig, setShowConfig] = useState(false);
  const [configForm, setConfigForm] = useState({
    payosClientId: '',
    payosApiKey: '',
    payosChecksumKey: '',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    sepayBankCode: '',
    sepayAccountNumber: '',
    sepayAccountName: '',
    sepayApikey: '',
    sepayWebhookSecret: '',
  });
  const [configSuccess, setConfigSuccess] = useState('');
  const [configError, setConfigError] = useState('');

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      interface PaginatedResponse {
        data: Order[];
        meta: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        };
      }

      const res = await apiJson<PaginatedResponse>(`/orders?${query.toString()}`);
      if (res && Array.isArray(res.data)) {
        setOrders(res.data);
        setTotal(res.meta.total);
        setTotalPages(res.meta.totalPages);
      } else {
        setOrders([]);
        setTotal(0);
        setTotalPages(1);
      }
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách đơn hàng.');
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    setTimeout(() => {
      loadOrders();
    }, 0);
  }, [loadOrders]);

  const loadConfig = async () => {
    try {
      const data = await apiJson<Record<string, string | null>>('/payments/config');
      if (data) {
        setConfigForm({
          payosClientId: data.payosClientId || '',
          payosApiKey: data.payosApiKey || '',
          payosChecksumKey: data.payosChecksumKey || '',
          stripeSecretKey: data.stripeSecretKey || '',
          stripeWebhookSecret: data.stripeWebhookSecret || '',
          sepayBankCode: data.sepayBankCode || '',
          sepayAccountNumber: data.sepayAccountNumber || '',
          sepayAccountName: data.sepayAccountName || '',
          sepayApikey: data.sepayApikey || '',
          sepayWebhookSecret: data.sepayWebhookSecret || '',
        });
      }
      setShowConfig(true);
    } catch (err: unknown) {
      setConfigError(err instanceof Error ? err.message : 'Lỗi tải cấu hình cổng thanh toán.');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiJson('/payments/config', {
        method: 'POST',
        body: JSON.stringify(configForm),
      });
      setConfigSuccess('Đã lưu cấu hình cổng thanh toán thành công.');
      setConfigError('');
      setTimeout(() => setShowConfig(false), 1500);
    } catch (err: unknown) {
      setConfigError(err instanceof Error ? err.message : 'Lỗi khi lưu cấu hình.');
    }
  };

  const filteredOrders = orders.filter(
    o => sourceFilter === 'ALL' || (o.source || 'WEB').toUpperCase() === sourceFilter
  );

  const totalRevenue = filteredOrders
    .filter(o => o.status === 'PAID')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader title="Quản lý Đơn hàng & Doanh thu" description="Theo dõi lịch sử đơn hàng và đối soát thanh toán trực tuyến VietQR/Stripe." />
        <button
          onClick={loadConfig}
          className="px-4 py-2 bg-[#f25c22] hover:bg-[#d94d1a] text-white rounded-lg transition duration-200 shadow-md font-semibold text-sm flex items-center gap-2"
        >
          Kết nối cổng thanh toán
        </button>
      </div>

      {/* Revenue Widget */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-5 space-y-2">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Tổng doanh thu thực tế</span>
          <h2 className="text-2xl font-extrabold text-[#f25c22]">
            {totalRevenue.toLocaleString('vi-VN')} VND
          </h2>
          <p className="text-[10px] text-slate-400">Tính từ các đơn hàng có trạng thái ĐÃ THANH TOÁN (PAID).</p>
        </div>
        <div className="card p-5 space-y-2">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Số đơn hàng đã bán</span>
          <h2 className="text-2xl font-extrabold text-brand">
            {filteredOrders.filter(o => o.status === 'PAID').length} đơn
          </h2>
          <p className="text-[10px] text-slate-400">Tổng số lượng đơn chuyển khoản/thẻ tín dụng thành công.</p>
        </div>
        <div className="card p-5 space-y-2">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Số đơn đang chờ xử lý</span>
          <h2 className="text-2xl font-extrabold text-amber-600">
            {filteredOrders.filter(o => o.status === 'PENDING').length} đơn
          </h2>
          <p className="text-[10px] text-slate-400">Khách đặt hàng nhưng chưa quét QR/thanh toán thẻ.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm">
          <span>{error}</span>
        </div>
      )}

      {/* Gateway credentials setup modal */}
      {showConfig && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveConfig} className="card p-6 w-full max-w-lg space-y-4 shadow-2xl relative overflow-y-auto max-h-[85vh]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand to-orange-500"></div>
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
              Kết nối cổng thanh toán Web All-in-One
            </h3>

            {configSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-xs">
                {configSuccess}
              </div>
            )}
            {configError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded text-xs">
                {configError}
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand">1. Cấu hình Cổng PayOS (VietQR ngân hàng Việt Nam)</h4>
              <div className="space-y-2 pl-3 border-l-2 border-slate-100">
                <div className="space-y-1">
                  <label className="label mb-0.5 text-[11px]">PayOS Client ID</label>
                  <input
                    type="text"
                    value={configForm.payosClientId}
                    onChange={(e) => setConfigForm({ ...configForm, payosClientId: e.target.value })}
                    className="input text-xs py-1.5 px-2.5 bg-slate-50/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="label mb-0.5 text-[11px]">PayOS API Key</label>
                  <input
                    type="password"
                    value={configForm.payosApiKey}
                    onChange={(e) => setConfigForm({ ...configForm, payosApiKey: e.target.value })}
                    className="input text-xs py-1.5 px-2.5 bg-slate-50/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="label mb-0.5 text-[11px]">PayOS Checksum Key</label>
                  <input
                    type="password"
                    value={configForm.payosChecksumKey}
                    onChange={(e) => setConfigForm({ ...configForm, payosChecksumKey: e.target.value })}
                    className="input text-xs py-1.5 px-2.5 bg-slate-50/50"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand">2. Cấu hình Cổng Stripe (Thẻ tín dụng Quốc tế)</h4>
              <div className="space-y-2 pl-3 border-l-2 border-slate-100">
                <div className="space-y-1">
                  <label className="label mb-0.5 text-[11px]">Stripe Secret Key</label>
                  <input
                    type="password"
                    value={configForm.stripeSecretKey}
                    onChange={(e) => setConfigForm({ ...configForm, stripeSecretKey: e.target.value })}
                    placeholder="sk_test_..."
                    className="input text-xs py-1.5 px-2.5 bg-slate-50/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="label mb-0.5 text-[11px]">Stripe Webhook Secret</label>
                  <input
                    type="password"
                    value={configForm.stripeWebhookSecret}
                    onChange={(e) => setConfigForm({ ...configForm, stripeWebhookSecret: e.target.value })}
                    placeholder="whsec_..."
                    className="input text-xs py-1.5 px-2.5 bg-slate-50/50"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand">3. Cấu hình Cổng SePay (VietQR tự động đối soát)</h4>
              <div className="space-y-2 pl-3 border-l-2 border-slate-100">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="label mb-0.5 text-[11px]">Ngân hàng thụ hưởng</label>
                    <input
                      type="text"
                      value={configForm.sepayBankCode}
                      onChange={(e) => setConfigForm({ ...configForm, sepayBankCode: e.target.value })}
                      placeholder="Vietcombank, MBBank..."
                      className="input text-xs py-1.5 px-2.5 bg-slate-50/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="label mb-0.5 text-[11px]">Số tài khoản</label>
                    <input
                      type="text"
                      value={configForm.sepayAccountNumber}
                      onChange={(e) => setConfigForm({ ...configForm, sepayAccountNumber: e.target.value })}
                      placeholder="1017588888"
                      className="input text-xs py-1.5 px-2.5 bg-slate-50/50"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="label mb-0.5 text-[11px]">Tên chủ tài khoản</label>
                  <input
                    type="text"
                    value={configForm.sepayAccountName}
                    onChange={(e) => setConfigForm({ ...configForm, sepayAccountName: e.target.value })}
                    placeholder="NGUYEN VAN A"
                    className="input text-xs py-1.5 px-2.5 bg-slate-50/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="label mb-0.5 text-[11px]">SePay API Key / Token</label>
                  <input
                    type="password"
                    value={configForm.sepayApikey}
                    onChange={(e) => setConfigForm({ ...configForm, sepayApikey: e.target.value })}
                    placeholder="Nhập API Key nếu sử dụng"
                    className="input text-xs py-1.5 px-2.5 bg-slate-50/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="label mb-0.5 text-[11px]">SePay Webhook Secret (HMAC-SHA256)</label>
                  <input
                    type="password"
                    value={configForm.sepayWebhookSecret}
                    onChange={(e) => setConfigForm({ ...configForm, sepayWebhookSecret: e.target.value })}
                    placeholder="Nhập Webhook Secret để kiểm tra chữ ký"
                    className="input text-xs py-1.5 px-2.5 bg-slate-50/50"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="btn-secondary px-4 py-1.5 text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="btn-primary px-4 py-1.5 text-sm"
              >
                Lưu cấu hình
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Orders Table */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
          <h4 className="text-sm font-bold text-slate-800">Danh sách giao dịch</h4>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-semibold">Nguồn đơn:</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-white outline-none focus:border-brand font-medium text-slate-700"
            >
              <option value="ALL">Tất cả kênh</option>
              <option value="WEB">Web Store</option>
              <option value="TIKTOKSHOP">TikTok Shop</option>
              <option value="ZALO">Zalo OA</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-4 space-y-2.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 rounded-xl bg-slate-100/80 animate-pulse" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <p className="text-sm font-semibold">Chưa có giao dịch phát sinh nào.</p>
            <p className="text-xs text-slate-400 mt-1">Đơn đặt hàng sẽ tự xuất hiện sau khi khách quét mã QR/thanh toán thẻ.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-650 uppercase tracking-wider font-bold">
                  <th className="py-3.5 px-4">Mã đơn hàng</th>
                  <th className="py-3.5 px-4">Nguồn</th>
                  <th className="py-3.5 px-4">Thời gian</th>
                  <th className="py-3.5 px-4">Khách hàng</th>
                  <th className="py-3.5 px-4">Số tiền</th>
                  <th className="py-3.5 px-4">Phương thức</th>
                  <th className="py-3.5 px-4">Mã giao dịch</th>
                  <th className="py-3.5 px-4 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-brand-light/30 text-slate-700 transition-colors duration-150">
                    <td className="py-3.5 px-4 font-bold text-slate-800 font-mono whitespace-nowrap">
                      {o.orderNumber}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {(o.source || 'WEB').toUpperCase() === 'TIKTOKSHOP' ? (
                        <span className="px-2 py-0.5 rounded bg-black text-white text-[10px] font-bold">TikTok Shop</span>
                      ) : (o.source || 'WEB').toUpperCase() === 'ZALO' ? (
                        <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold">Zalo OA</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-[10px] font-bold">Web Store</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-700">{o.customer?.name}</div>
                      <div className="text-[10px] text-slate-400 font-semibold">{o.customer?.email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-800 whitespace-nowrap">
                      {o.totalAmount.toLocaleString('vi-VN')} VND
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-xs whitespace-nowrap">
                      {o.paymentMethod || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500 truncate max-w-[120px]" title={o.gatewayTxnId || ''}>
                      {o.gatewayTxnId || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${o.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : o.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {o.status === 'PAID' ? 'Đã thanh toán' : o.status === 'PENDING' ? 'Chờ thanh toán' : 'Đã hủy'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-500">
              Trang {page} / {totalPages} (tổng số {total} đơn hàng)
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Trước
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Sau
              </button>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
