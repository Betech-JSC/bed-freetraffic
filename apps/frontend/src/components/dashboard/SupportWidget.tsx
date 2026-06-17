'use client';

import React, { useState, useEffect, useRef } from 'react';
import { apiJson, apiUrl } from '@/lib/api';

interface Message {
  id?: number;
  sender: 'visitor' | 'bot' | 'agent';
  content: string;
  createdAt: string;
}

export function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Quick suggestions for platform help
  const faqs = [
    'Cách chạy AI Social Listening?',
    'Làm thế nào để kết nối Telegram?',
    'Tính năng RAG Email hoạt động ra sao?',
    'Cách xuất bản bài viết đa kênh?'
  ];

  // Initialize and load chat history if exists
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedSession = localStorage.getItem('betraffic_support_session_id');
      if (storedSession) {
        setSessionId(storedSession);
        // Fetch history
        fetch(apiUrl(`/api/cskh/system-support/history/${storedSession}`), {
          headers: {
            'Authorization': `Bearer ${getCookie('token')}`
          }
        })
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data) && data.length > 0) {
              setMessages(data.map((msg: any) => ({
                id: msg.id,
                sender: msg.sender,
                content: msg.content,
                createdAt: msg.createdAt
              })));
            } else {
              // Fallback to greeting
              showGreeting();
            }
          })
          .catch(() => showGreeting());
      } else {
        showGreeting();
      }
    }
  }, []);

  // Scroll to bottom when message list changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const getCookie = (name: string) => {
    if (typeof document === 'undefined') return '';
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
    return '';
  };

  const showGreeting = () => {
    setMessages([
      {
        sender: 'bot',
        content: 'Xin chào! 👋 Tôi là Trợ lý AI hỗ trợ kỹ thuật của Be Traffic.\n\nTôi có thể giúp bạn giải đáp các thắc mắc về cách sử dụng tính năng, kết nối kênh tiếp cận, hoặc cấu hình robot AI trong hệ thống. Bạn cần tôi hỗ trợ gì hôm nay?',
        createdAt: new Date().toISOString()
      }
    ]);
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    
    // Add user message locally
    const userMsg: Message = {
      sender: 'visitor',
      content: text,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const res = await apiJson<any>('/cskh/system-support/message', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          sessionId: sessionId || undefined
        })
      });

      if (res.sessionId && res.sessionId !== sessionId) {
        setSessionId(res.sessionId);
        localStorage.setItem('betraffic_support_session_id', res.sessionId);
      }

      const botMsg: Message = {
        sender: 'bot',
        content: res.reply || 'Xin lỗi bạn, tôi không nhận được câu trả lời từ máy chủ AI.',
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, botMsg]);

    } catch (err: any) {
      console.error('[Support Widget] Send error:', err);
      const errMsg: Message = {
        sender: 'bot',
        content: 'Trợ lý AI đang bận xử lý hoặc kết nối gián đoạn. Bạn vui lòng thử lại sau vài giây nhé!',
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-gradient-to-br from-brand to-orange-500 hover:from-brand-hover hover:to-orange-600 text-white flex items-center justify-center shadow-lg shadow-brand/20 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer relative group"
        title="Trợ giúp Be Traffic AI"
      >
        <span className="absolute inset-0 rounded-full bg-brand/35 animate-ping opacity-60 scale-105 group-hover:hidden" />
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </button>

      {/* Chat Window Panel */}
      {isOpen && (
        <div className="absolute bottom-18 right-0 w-[360px] sm:w-[400px] h-[550px] bg-white rounded-3xl border border-slate-200/80 shadow-2xl flex flex-col justify-between overflow-hidden animate-[modalIn_0.25s_ease-out] relative">
          
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-950 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center font-black text-sm text-white shadow-md shadow-brand/10">Be</div>
              <div>
                <h4 className="text-xs font-black tracking-wide text-white">Trợ lý Be Traffic AI</h4>
                <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  Hỗ trợ trực tuyến
                </p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1"
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Messages List Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 custom-scrollbar">
            {messages.map((msg, idx) => {
              const isUser = msg.sender === 'visitor';
              return (
                <div 
                  key={idx} 
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-[fadeIn_0.2s_ease-out]`}
                >
                  <div className={`max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed font-semibold whitespace-pre-wrap shadow-sm ${
                    isUser
                      ? 'bg-brand text-white rounded-tr-none'
                      : 'bg-white text-slate-700 border border-slate-150 rounded-tl-none'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {/* AI Typing Indicator */}
            {loading && (
              <div className="flex justify-start animate-pulse">
                <div className="bg-white border border-slate-150 rounded-2xl rounded-tl-none p-3 shadow-sm flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick FAQ suggestions list */}
          {messages.length === 1 && !loading && (
            <div className="p-3 bg-white border-t border-slate-100 shrink-0 space-y-1.5">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Các câu hỏi thường gặp</p>
              <div className="flex flex-wrap gap-1.5">
                {faqs.map((faq, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(faq)}
                    className="text-[10px] text-slate-600 bg-slate-50 border border-slate-200/80 hover:border-brand/35 hover:text-brand font-bold py-1.5 px-2.5 rounded-xl transition-all cursor-pointer text-left"
                  >
                    💡 {faq}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message Input Box */}
          <div className="p-3 bg-white border-t border-slate-200/80 shrink-0 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputText)}
              placeholder="Nhập câu hỏi của bạn..."
              disabled={loading}
              className="flex-1 px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/60 focus:bg-white text-xs border border-slate-200 focus:border-brand/40 outline-none rounded-xl transition-all focus:ring-4 focus:ring-brand/5"
            />
            <button
              onClick={() => handleSendMessage(inputText)}
              disabled={!inputText.trim() || loading}
              className="w-9 h-9 rounded-xl bg-brand hover:bg-brand-hover text-white flex items-center justify-center shrink-0 shadow-md shadow-brand/10 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
