'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';

type Product = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  createdAt: string;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editor states
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'VND',
  });

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiJson<Product[]>('/orders/products');
      setProducts(Array.isArray(data) ? data : []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách sản phẩm.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({ name: '', description: '', price: '', currency: 'VND' });
    setShowEditor(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description || '',
      price: String(p.price),
      currency: p.currency,
    });
    setShowEditor(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price) {
      setError('Tên sản phẩm và Giá bán là bắt buộc.');
      return;
    }

    try {
      if (editingId) {
        await apiJson(`/orders/products/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        setSuccess('Đã cập nhật sản phẩm thành công.');
      } else {
        await apiJson('/orders/products', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        setSuccess('Đã tạo sản phẩm mới thành công.');
      }
      setShowEditor(false);
      loadProducts();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu sản phẩm.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa sản phẩm này không?')) return;
    try {
      await apiJson(`/orders/products/${id}`, { method: 'DELETE' });
      setSuccess('Đã xóa sản phẩm thành công.');
      loadProducts();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa sản phẩm.');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader title="Quản lý Sản phẩm" description="Đăng bán các gói dịch vụ, ebook, khóa học hoặc sản phẩm số để nhận thanh toán tự động." />
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-[#f25c22] hover:bg-[#d94d1a] text-white rounded-lg transition duration-200 shadow-md font-semibold text-sm flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Thêm sản phẩm mới
        </button>
      </div>

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm flex justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="hover:text-white">✕</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="hover:text-white">✕</button>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
              {editingId ? 'Chỉnh sửa sản phẩm' : 'Đăng sản phẩm mới'}
            </h3>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Tên sản phẩm</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ví dụ: Ebook Hướng Dẫn SEO 2026"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f25c22] transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Giá bán</label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="250000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f25c22]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400">Tiền tệ</label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                >
                  <option value="VND">VND (đ)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Mô tả sản phẩm</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Mô tả các giá trị, đặc quyền nhận được khi thanh toán..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f25c22]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-sm transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#f25c22] hover:bg-[#d94d1a] text-white rounded-lg text-sm font-semibold transition"
              >
                Lưu lại
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f25c22]"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-slate-900 border border-slate-800 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h4 className="text-white font-medium mb-1">Chưa có sản phẩm nào</h4>
            <p className="text-slate-400 text-sm mb-4">Hãy bắt đầu tạo sản phẩm dịch vụ/sản phẩm số đầu tiên để triển khai bán hàng.</p>
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-[#f25c22]/10 hover:bg-[#f25c22]/20 border border-[#f25c22]/30 text-[#f25c22] rounded-lg transition text-sm font-semibold"
            >
              Thêm sản phẩm
            </button>
          </div>
        ) : (
          products.map((p) => (
            <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg p-5 flex flex-col justify-between hover:border-slate-700 transition">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-white text-base line-clamp-1">{p.name}</h4>
                  <span className="text-[#f25c22] font-extrabold text-sm whitespace-nowrap">
                    {p.price.toLocaleString('vi-VN')} {p.currency}
                  </span>
                </div>
                <p className="text-slate-400 text-xs line-clamp-3">
                  {p.description || 'Không có mô tả chi tiết.'}
                </p>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-850 pt-3.5 mt-4">
                <button
                  onClick={() => handleOpenEdit(p)}
                  className="text-xs bg-slate-800 hover:bg-slate-750 text-slate-300 px-3 py-1.5 rounded transition"
                >
                  Chỉnh sửa
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-xs bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 px-3 py-1.5 rounded transition"
                >
                  Xóa
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
