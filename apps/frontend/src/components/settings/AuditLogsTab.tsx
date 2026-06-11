'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiJson } from '@/lib/api';
import { useLocale } from '@/context/LocaleContext';

interface AuditLog {
  id: number;
  userId: number;
  workspaceId: number;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  details: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function AuditLogsTab() {
  const { t } = useLocale();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const workspaceId = localStorage.getItem('workspaceId') || '0';
      const url = `/workspaces/current/audit-logs?page=${page}&limit=10&action=${actionFilter}`;
      const res = await apiJson<{ logs: AuditLog[]; pagination: Pagination }>(url, {
        headers: {
          'x-workspace-id': workspaceId
        }
      });
      setLogs(res.logs);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Lỗi khi lấy nhật ký hoạt động:', err);
    }
    setLoading(false);
  }, [page, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionBadgeClass = (action: string) => {
    if (action.startsWith('CREATE')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (action.startsWith('DELETE')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (action.startsWith('UPDATE') || action.startsWith('IMPORT')) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'CREATE_WORKSPACE': return t('Tạo Workspace');
      case 'CREATE_PRODUCT': return t('Thêm sản phẩm');
      case 'UPDATE_PRODUCT': return t('Cập nhật sản phẩm');
      case 'DELETE_PRODUCT': return t('Xóa sản phẩm');
      case 'CREATE_ORDER': return t('Tạo đơn hàng');
      case 'DELETE_ORDER': return t('Xóa đơn hàng');
      case 'CREATE_CUSTOMER': return t('Thêm khách hàng');
      case 'UPDATE_CUSTOMER': return t('Cập nhật khách hàng');
      case 'DELETE_CUSTOMER': return t('Xóa khách hàng');
      case 'IMPORT_CUSTOMERS': return t('Nhập khách hàng hàng loạt');
      case 'UPDATE_GATEWAY_CONFIG': return t('Cập nhật cấu hình cổng thanh toán');
      default: return action;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700">{t('Bộ lọc hành động:')}</label>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-orange-200"
          >
            <option value="">{t('Tất cả hành động')}</option>
            <option value="CREATE_WORKSPACE">{t('Tạo Workspace')}</option>
            <option value="CREATE_PRODUCT">{t('Thêm sản phẩm')}</option>
            <option value="UPDATE_PRODUCT">{t('Cập nhật sản phẩm')}</option>
            <option value="DELETE_PRODUCT">{t('Xóa sản phẩm')}</option>
            <option value="CREATE_ORDER">{t('Tạo đơn hàng')}</option>
            <option value="DELETE_ORDER">{t('Xóa đơn hàng')}</option>
            <option value="CREATE_CUSTOMER">{t('Thêm khách hàng')}</option>
            <option value="UPDATE_CUSTOMER">{t('Cập nhật khách hàng')}</option>
            <option value="DELETE_CUSTOMER">{t('Xóa khách hàng')}</option>
            <option value="IMPORT_CUSTOMERS">{t('Nhập khách hàng hàng loạt')}</option>
            <option value="UPDATE_GATEWAY_CONFIG">{t('Cập nhật cấu hình cổng thanh toán')}</option>
          </select>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="btn-secondary text-sm flex items-center gap-2"
        >
          {loading ? t('Đang tải...') : t('Làm mới')}
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                <th className="p-4">{t('Thời gian')}</th>
                <th className="p-4">{t('Người dùng')}</th>
                <th className="p-4">{t('Hành động')}</th>
                <th className="p-4">{t('Địa chỉ IP')}</th>
                <th className="p-4 text-right">{t('Chi tiết')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                      <p>{t('Đang tải dữ liệu...')}</p>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    {t('Không có nhật ký hoạt động nào phù hợp.')}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 whitespace-nowrap text-xs text-slate-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-slate-900">{log.userName || t('Thành viên')}</div>
                        <div className="text-xs text-slate-400">{log.userEmail}</div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getActionBadgeClass(log.action)}`}>
                          {getActionLabel(log.action)}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-500">
                        <div>{log.ipAddress || '—'}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[150px]" title={log.userAgent || ''}>
                          {log.userAgent || ''}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        {log.details && (
                          <button
                            onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                            className="text-orange-600 hover:text-orange-700 font-medium text-xs focus:outline-none"
                          >
                            {expandedLogId === log.id ? t('Thu gọn') : t('Xem chi tiết')}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedLogId === log.id && log.details && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={5} className="p-4 border-t border-slate-100">
                          <div className="p-4 bg-slate-900 text-slate-200 rounded-lg text-xs font-mono overflow-auto max-h-60 leading-relaxed shadow-inner">
                            <pre>{JSON.stringify(JSON.parse(log.details), null, 2)}</pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controllers */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              {t('Tổng số:')} <strong>{pagination.total}</strong> {t('bản ghi')}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 disabled:opacity-50 hover:bg-slate-50"
              >
                {t('Trước')}
              </button>
              <span className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg">
                {page} / {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 disabled:opacity-50 hover:bg-slate-50"
              >
                {t('Sau')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
