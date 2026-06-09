'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiJson } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLocale } from '@/context/LocaleContext';

type User = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
};

export default function UsersPage() {
  const { t } = useLocale();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'EDITOR' });

  const load = useCallback(async () => {
    try {
      setUsers(await apiJson<User[]>('/users'));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Chỉ ADMIN mới xem được trang này'));
    }
  }, [t]);

  useEffect(() => {
    setTimeout(() => {
      load();
    }, 0);
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiJson('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ email: '', password: '', name: '', role: 'EDITOR' });
    load();
  };

  return (
    <div className="space-y-8">
      <PageHeader title={t('Người dùng')} description="Phase 1 — FR-10 RBAC (ADMIN / EDITOR / VIEWER)" />
      {error && <div className="rounded-xl bg-amber-50 text-amber-800 px-4 py-3 text-sm">{error}</div>}
      <form onSubmit={create} className="card p-6 grid md:grid-cols-4 gap-3">
        <input className="input" placeholder={t('Email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="input" type="password" placeholder={t('Mật khẩu')} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <input className="input" placeholder={t('Tên')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="ADMIN">ADMIN</option>
          <option value="EDITOR">EDITOR</option>
          <option value="VIEWER">VIEWER</option>
        </select>
        <button type="submit" className="btn-primary md:col-span-4">
          {t('Thêm user')}
        </button>
      </form>
      <div className="table-wrap">
        <table className="table-modern">
          <thead>
            <tr>
              <th>{t('Email')}</th>
              <th>{t('Tên')}</th>
              <th>{t('Role')}</th>
              <th>{t('Active')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name}</td>
                <td>{u.role}</td>
                <td>{u.isActive ? 'Hoạt động' : 'Khóa'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
