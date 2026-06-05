'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLocale } from '@/context/LocaleContext';

type BlogPost = {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  content: string;
  published: boolean;
  publishedAt: string | null;
  authorName: string;
  tags: string | null;
  createdAt: string;
};

export default function BlogPage() {
  const { t } = useLocale();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states for creation / editing
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    summary: '',
    content: '',
    authorName: 'Admin',
    tags: '',
    published: false,
  });

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiJson<BlogPost[]>('/blog');
      setPosts(Array.isArray(data) ? data : []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách bài viết.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleCreateNew = () => {
    setIsEditing(true);
    setSelectedPostId(null);
    setForm({
      title: '',
      slug: '',
      summary: '',
      content: '',
      authorName: 'Admin',
      tags: '',
      published: false,
    });
  };

  const handleEdit = (post: BlogPost) => {
    setIsEditing(true);
    setSelectedPostId(post.id);
    setForm({
      title: post.title,
      slug: post.slug,
      summary: post.summary || '',
      content: post.content,
      authorName: post.authorName,
      tags: post.tags || '',
      published: post.published,
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) return;
    try {
      await apiJson(`/blog/${id}`, { method: 'DELETE' });
      setSuccess('Đã xóa bài viết thành công.');
      loadPosts();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa bài viết.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.slug || !form.content) {
      setError('Vui lòng nhập đầy đủ Tiêu đề, Đường dẫn và Nội dung.');
      return;
    }

    try {
      if (selectedPostId) {
        await apiJson(`/blog/${selectedPostId}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        setSuccess('Cập nhật bài viết thành công.');
      } else {
        await apiJson('/blog', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        setSuccess('Tạo bài viết mới thành công.');
      }
      setIsEditing(false);
      loadPosts();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu bài viết.');
    }
  };

  const togglePublish = async (post: BlogPost) => {
    try {
      await apiJson(`/blog/${post.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...post,
          published: !post.published,
        }),
      });
      setSuccess(`Đã ${!post.published ? 'xuất bản' : 'gỡ'} bài viết thành công.`);
      loadPosts();
    } catch (err: any) {
      setError(err.message || 'Lỗi thay đổi trạng thái xuất bản.');
    }
  };

  // Automatically suggest a slug based on title
  useEffect(() => {
    if (!selectedPostId && form.title) {
      const slugified = form.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      setForm((prev) => ({ ...prev, slug: slugified }));
    }
  }, [form.title, selectedPostId]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader title="Quản lý CMS Blog (SEO)" description="Tạo và xuất bản bài viết chất lượng cao để kéo traffic tự nhiên." />
        {!isEditing && (
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-[#f25c22] hover:bg-[#d94d1a] text-white rounded-lg transition duration-200 shadow-md font-semibold text-sm flex items-center gap-2"
          >
            Tạo bài viết mới
          </button>
        )}
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

      {isEditing ? (
        <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl">
          <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3">
            {selectedPostId ? 'Chỉnh sửa bài viết' : 'Viết bài mới'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Tiêu đề bài viết</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Nhập tiêu đề hấp dẫn..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#f25c22] transition"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Đường dẫn thân thiện (URL Slug)</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="vi-du-duong-dan-bai-viet"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#f25c22] transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Tác giả</label>
              <input
                type="text"
                value={form.authorName}
                onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#f25c22] transition"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Tags (ngăn cách bởi dấu phẩy)</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="seo, marketing, traffic"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#f25c22] transition"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Mô tả tóm tắt (SEO Meta Description)</label>
            <textarea
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="Nhập mô tả tóm tắt bài viết giúp thu hút người đọc trên Google Search..."
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#f25c22] transition"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-slate-300">Nội dung bài viết (Hỗ trợ Markdown)</label>
              <span className="text-xs text-slate-500">Mẹo: Sử dụng # cho Heading, * cho In nghiêng, ** cho In đậm</span>
            </div>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Nhập nội dung bài viết bằng Markdown..."
              rows={12}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-white font-mono text-sm focus:outline-none focus:border-[#f25c22] transition"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="published"
              checked={form.published}
              onChange={(e) => setForm({ ...form, published: e.target.checked })}
              className="h-4 w-4 bg-slate-950 border-slate-800 rounded accent-[#f25c22]"
            />
            <label htmlFor="published" className="text-sm text-slate-300 select-none cursor-pointer">
              Xuất bản bài viết này lên trang chủ ngay lập tức
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg transition"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-[#f25c22] hover:bg-[#d94d1a] text-white rounded-lg font-semibold shadow-md transition"
            >
              Lưu bài viết
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full flex justify-center py-12 text-slate-400 text-sm font-semibold">
              Đang tải bài viết...
            </div>
          ) : posts.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-slate-900 border border-slate-800 rounded-xl">
              <h4 className="text-white font-medium mb-1">Chưa có bài viết nào</h4>
              <p className="text-slate-400 text-sm mb-4">Hãy bắt đầu tạo bài viết blog đầu tiên chuẩn SEO của bạn.</p>
              <button
                onClick={handleCreateNew}
                className="px-4 py-2 bg-[#f25c22]/10 hover:bg-[#f25c22]/20 border border-[#f25c22]/30 text-[#f25c22] rounded-lg transition text-sm font-semibold"
              >
                Tạo bài viết
              </button>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg hover:border-slate-700 transition flex flex-col justify-between">
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${post.published ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                      {post.published ? 'Đã xuất bản' : 'Bản nháp'}
                    </span>
                    <span className="text-xs text-slate-500">{new Date(post.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <h4 className="font-bold text-white text-base line-clamp-2 hover:text-[#f25c22] cursor-pointer" onClick={() => handleEdit(post)}>
                    {post.title}
                  </h4>
                  <p className="text-slate-400 text-xs line-clamp-3">
                    {post.summary || 'Không có mô tả tóm tắt.'}
                  </p>
                  {post.tags && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {post.tags.split(',').map((tag, idx) => (
                        <span key={idx} className="bg-slate-850 text-slate-400 text-[10px] px-2 py-0.5 rounded border border-slate-800">
                          #{tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-850 flex justify-between items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => togglePublish(post)}
                      className={`text-xs px-2.5 py-1 rounded border transition ${post.published ? 'hover:bg-amber-500/10 border-amber-500/20 text-amber-400' : 'hover:bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}
                      title={post.published ? 'Gỡ xuất bản' : 'Xuất bản'}
                    >
                      {post.published ? 'Gỡ' : 'Đăng'}
                    </button>
                    <a
                      href={`/api/public/blog/posts/${post.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs border border-slate-800 hover:bg-slate-900 text-slate-400 px-2.5 py-1 rounded transition"
                    >
                      Xem
                    </a>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(post)}
                      className="text-slate-400 hover:text-white text-xs font-semibold px-2 py-1 bg-slate-800 rounded hover:bg-slate-750 transition"
                      title="Sửa"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="text-slate-400 hover:text-rose-400 text-xs font-semibold px-2 py-1 bg-slate-800 rounded hover:bg-slate-750 transition"
                      title="Xóa"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
