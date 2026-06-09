'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLocale } from '@/context/LocaleContext';
import { apiJson } from '@/lib/api';

interface Workspace {
  id: number;
  name: string;
  role?: string;
  createdAt?: string;
}

export default function WorkspaceSwitcher() {
  const { t } = useLocale();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load workspaces and active workspace info
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch workspaces list
      const list = await apiJson<Workspace[]>('/workspaces');
      setWorkspaces(list);

      // Determine active workspace ID
      let activeId = typeof window !== 'undefined' ? localStorage.getItem('workspaceId') : null;
      
      let current: Workspace | null = null;
      if (activeId) {
        current = list.find(w => w.id === parseInt(activeId!, 10)) || null;
      }

      // If no valid active workspace, fetch '/workspaces/current' to get/provision one
      if (!current) {
        const currentInfo = await apiJson<Workspace>('/workspaces/current');
        current = currentInfo;
        if (typeof window !== 'undefined') {
          localStorage.setItem('workspaceId', currentInfo.id.toString());
        }
      }

      setCurrentWorkspace(current);
    } catch (err: any) {
      console.error('[WorkspaceSwitcher] Error fetching workspaces:', err);
      setError(err?.message || 'Không thể tải danh sách không gian làm việc.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Close dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowNewForm(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitch = (id: number) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('workspaceId', id.toString());
      setIsOpen(false);
      window.location.reload();
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const newWs = await apiJson<Workspace>('/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWorkspaceName.trim() })
      });

      // Switch to the newly created workspace immediately
      if (typeof window !== 'undefined') {
        localStorage.setItem('workspaceId', newWs.id.toString());
        window.location.reload();
      }
    } catch (err: any) {
      console.error('[WorkspaceSwitcher] Error creating workspace:', err);
      setError(err?.message || 'Không thể tạo không gian làm việc mới.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-orange-50/40 border border-orange-100/80 text-left text-slate-800 hover:bg-orange-50 active:scale-[0.98] transition-all duration-200 group"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand to-orange-500 flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-md">
            {currentWorkspace?.name ? currentWorkspace.name.substring(0, 2).toUpperCase() : 'WS'}
          </div>
          <div className="flex flex-col truncate">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              {t('workspace')}
            </span>
            <span className="text-sm font-semibold text-slate-700 truncate leading-tight">
              {currentWorkspace?.name || t('loading')}
            </span>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 group-hover:text-brand ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 z-50 rounded-xl bg-white border border-orange-100 shadow-2xl p-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1.5 border-b border-slate-100">
            {t('workspaceSelect')}
          </div>

          <div className="max-h-[200px] overflow-y-auto custom-scrollbar my-1.5 space-y-0.5">
            {workspaces.map((ws) => {
              const isSelected = ws.id === currentWorkspace?.id;
              return (
                <button
                  key={ws.id}
                  onClick={() => handleSwitch(ws.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-all text-left ${
                    isSelected
                      ? 'bg-brand/10 text-brand font-medium'
                      : 'text-slate-600 hover:bg-orange-50 hover:text-brand'
                  }`}
                >
                  <span className="truncate">{ws.name}</span>
                  {isSelected && (
                    <span className="text-xs text-brand font-bold">Selected</span>
                  )}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="px-2.5 py-1.5 text-xs text-red-500 bg-red-50 rounded-lg mb-2">
              {error}
            </div>
          )}

          {/* Create New Toggle */}
          {!showNewForm ? (
            <button
              onClick={() => setShowNewForm(true)}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-brand hover:text-brand-hover hover:bg-orange-50 rounded-lg transition-all text-left"
            >
              {t('workspaceCreate')}
            </button>
          ) : (
            <form onSubmit={handleCreateWorkspace} className="p-2 border-t border-slate-100 space-y-2 mt-2">
              <input
                type="text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder={t('workspacePlaceholder')}
                required
                disabled={loading}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand transition-all"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  disabled={loading}
                  className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading || !newWorkspaceName.trim()}
                  className="px-2.5 py-1 text-[10px] font-semibold bg-gradient-to-r from-brand to-orange-600 hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none text-white rounded-lg transition-all shadow-md shadow-brand/10"
                >
                  {loading ? t('workspaceCreating') : t('create')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
