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
          Thêm sản phẩm mới
        </button>
      </div>

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm flex justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="hover:text-white text-xs font-semibold">Đóng</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="hover:text-white text-xs font-semibold">Đóng</button>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="card p-6 w-full max-w-md space-y-4 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand to-orange-500"></div>
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">
              {editingId ? 'Chỉnh sửa sản phẩm' : 'Đăng sản phẩm mới'}
            </h3>

            <div className="space-y-1">
              <label className="label">Tên sản phẩm</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ví dụ: Ebook Hướng Dẫn SEO 2026"
                className="input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="label">Giá bán</label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="250000"
                  className="input"
                />
              </div>

              <div className="space-y-1">
                <label className="label">Tiền tệ</label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="input"
                >
                  <option value="VND">VND (đ)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="label">Mô tả sản phẩm</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Mô tả các giá trị, đặc quyền nhận được khi thanh toán..."
                rows={3}
                className="input"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="btn-secondary px-4 py-1.5 text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="btn-primary px-4 py-1.5 text-sm"
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
          <div className="col-span-full text-center py-16 card p-8 flex flex-col items-center">
            <h4 className="text-slate-800 font-bold mb-1 text-base">Chưa có sản phẩm nào</h4>
            <p className="text-slate-500 text-xs mb-4">Hãy bắt đầu tạo sản phẩm dịch vụ/sản phẩm số đầu tiên để triển khai bán hàng.</p>
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-[#f25c22]/10 hover:bg-[#f25c22]/20 border border-[#f25c22]/30 text-[#f25c22] rounded-lg transition text-xs font-semibold"
            >
              Thêm sản phẩm
            </button>
          </div>
        ) : (
          products.map((p) => (
            <div key={p.id} className="card card-hover p-5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <h4 className="font-bold text-slate-800 text-base line-clamp-1">{p.name}</h4>
                  <span className="text-[#f25c22] font-extrabold text-sm whitespace-nowrap">
                    {p.price.toLocaleString('vi-VN')} {p.currency}
                  </span>
                </div>
                <p className="text-slate-500 text-xs leading-relaxed line-clamp-3">
                  {p.description || 'Không có mô tả chi tiết.'}
                </p>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-3.5 mt-4">
                <button
                  onClick={() => handleOpenEdit(p)}
                  className="text-xs font-bold bg-white hover:bg-slate-50 border border-slate-200 text-slate-650 px-3 py-1.5 rounded transition-all"
                >
                  Chỉnh sửa
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-xs font-bold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 px-3 py-1.5 rounded transition-all"
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
