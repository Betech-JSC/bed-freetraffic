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
  createdAt: string;
  customer: {
    name: string;
    email: string;
  };
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Payment credentials credentials config state
  const [showConfig, setShowConfig] = useState(false);
  const [configForm, setConfigForm] = useState({
    payosClientId: '',
    payosApiKey: '',
    payosChecksumKey: '',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
  });
  const [configSuccess, setConfigSuccess] = useState('');
  const [configError, setConfigError] = useState('');

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiJson<Order[]>('/orders');
      setOrders(Array.isArray(data) ? data : []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách đơn hàng.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const loadConfig = async () => {
    try {
      const data = await apiJson<any>('/payments/config');
      if (data) {
        setConfigForm({
          payosClientId: data.payosClientId || '',
          payosApiKey: data.payosApiKey || '',
          payosChecksumKey: data.payosChecksumKey || '',
          stripeSecretKey: data.stripeSecretKey || '',
          stripeWebhookSecret: data.stripeWebhookSecret || '',
        });
      }
      setShowConfig(true);
    } catch (err: any) {
      setConfigError(err.message || 'Lỗi tải cấu hình cổng thanh toán.');
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
    } catch (err: any) {
      setConfigError(err.message || 'Lỗi khi lưu cấu hình.');
    }
  };

  const totalRevenue = orders
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
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
          Kết nối cổng thanh toán
        </button>
      </div>

      {/* Revenue Widget */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-850 p-5 rounded-xl space-y-2 shadow-lg">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tổng doanh thu thực tế</span>
          <h2 className="text-2xl font-extrabold text-[#f25c22]">
            {totalRevenue.toLocaleString('vi-VN')} VND
          </h2>
          <p className="text-[10px] text-slate-500">Tính từ các đơn hàng có trạng thái ĐÃ THANH TOÁN (PAID).</p>
        </div>
        <div className="bg-slate-900 border border-slate-850 p-5 rounded-xl space-y-2 shadow-lg">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Số đơn hàng đã bán</span>
          <h2 className="text-2xl font-extrabold text-emerald-400">
            {orders.filter(o => o.status === 'PAID').length} đơn
          </h2>
          <p className="text-[10px] text-slate-500">Tổng số lượng đơn chuyển khoản/thẻ tín dụng thành công.</p>
        </div>
        <div className="bg-slate-900 border border-slate-850 p-5 rounded-xl space-y-2 shadow-lg">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Số đơn đang chờ xử lý</span>
          <h2 className="text-2xl font-extrabold text-amber-400">
            {orders.filter(o => o.status === 'PENDING').length} đơn
          </h2>
          <p className="text-[10px] text-slate-500">Khách đặt hàng nhưng chưa quét QR/thanh toán thẻ.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm">
          <span>{error}</span>
        </div>
      )}

      {/* Gateway credentials setup modal */}
      {showConfig && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveConfig} className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-lg space-y-4 shadow-2xl overflow-y-auto max-h-[85vh]">
            <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
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
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#f25c22]">1. Cấu hình Cổng PayOS (VietQR ngân hàng Việt Nam)</h4>
              <div className="space-y-2 pl-3 border-l-2 border-slate-800">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">PayOS Client ID</label>
                  <input
                    type="text"
                    value={configForm.payosClientId}
                    onChange={(e) => setConfigForm({ ...configForm, payosClientId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">PayOS API Key</label>
                  <input
                    type="password"
                    value={configForm.payosApiKey}
                    onChange={(e) => setConfigForm({ ...configForm, payosApiKey: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">PayOS Checksum Key</label>
                  <input
                    type="password"
                    value={configForm.payosChecksumKey}
                    onChange={(e) => setConfigForm({ ...configForm, payosChecksumKey: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#f25c22]">2. Cấu hình Cổng Stripe (Thẻ tín dụng Quốc tế)</h4>
              <div className="space-y-2 pl-3 border-l-2 border-slate-800">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Stripe Secret Key</label>
                  <input
                    type="password"
                    value={configForm.stripeSecretKey}
                    onChange={(e) => setConfigForm({ ...configForm, stripeSecretKey: e.target.value })}
                    placeholder="sk_test_..."
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Stripe Webhook Secret</label>
                  <input
                    type="password"
                    value={configForm.stripeWebhookSecret}
                    onChange={(e) => setConfigForm({ ...configForm, stripeWebhookSecret: e.target.value })}
                    placeholder="whsec_..."
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-sm transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#f25c22] hover:bg-[#d94d1a] text-white rounded-lg text-sm font-semibold transition"
              >
                Lưu cấu hình
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-slate-900 border border-slate-850 rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f25c22]"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <p className="text-sm">Chưa có giao dịch phát sinh nào.</p>
            <p className="text-xs text-slate-655 mt-1">Đơn đặt hàng sẽ tự xuất hiện sau khi khách quét mã QR/thanh toán thẻ.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-4">Mã đơn hàng</th>
                  <th className="py-3.5 px-4">Thời gian</th>
                  <th className="py-3.5 px-4">Khách hàng</th>
                  <th className="py-3.5 px-4">Số tiền</th>
                  <th className="py-3.5 px-4">Phương thức</th>
                  <th className="py-3.5 px-4">Mã giao dịch</th>
                  <th className="py-3.5 px-4 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-950/20 text-slate-300">
                    <td className="py-3.5 px-4 font-bold text-white font-mono whitespace-nowrap">
                      {o.orderNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200">{o.customer?.name}</div>
                      <div className="text-[10px] text-slate-500">{o.customer?.email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-200 whitespace-nowrap">
                      {o.totalAmount.toLocaleString('vi-VN')} VND
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-xs whitespace-nowrap">
                      {o.paymentMethod || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500 truncate max-w-[120px]" title={o.gatewayTxnId || ''}>
                      {o.gatewayTxnId || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${o.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : o.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                        {o.status === 'PAID' ? 'Đã thanh toán' : o.status === 'PENDING' ? 'Chờ thanh toán' : 'Đã hủy'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
