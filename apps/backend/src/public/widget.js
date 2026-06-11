(function() {
  // 1. Xác định host và workspaceId của script nhúng
  const scriptTag = document.currentScript || document.querySelector('script[src*="widget.js"]');
  let apiHost = '';
  if (scriptTag) {
    const src = scriptTag.getAttribute('src');
    try {
      const url = new URL(src, window.location.href);
      apiHost = url.origin;
    } catch (e) {
      apiHost = '';
    }
  }
  
  const workspaceId = scriptTag ? scriptTag.getAttribute('data-workspace-id') : null;
  if (!workspaceId) {
    console.error('[CSKH Chat Widget] Thiếu thuộc tính data-workspace-id trên thẻ script.');
    return;
  }

  // 2. Gọi API lấy cấu hình widget từ backend
  const configUrl = `${apiHost}/api/public/cskh/widget-config?workspaceId=${workspaceId}`;
  fetch(configUrl)
    .then(res => {
      if (!res.ok) throw new Error('Không thể tải cấu hình widget.');
      return res.json();
    })
    .then(config => {
      // Nếu CSKH và AI Chatbot đều bị tắt, không hiển thị bong bóng chat
      if (!config.liveChatEnabled && !config.aiChatbotEnabled) {
        console.log('[CSKH Chat Widget] Chatbot và Livechat đang bị tắt cho Workspace này.');
        return;
      }
      
      initWidget(config, apiHost, workspaceId);
    })
    .catch(err => {
      console.error('[CSKH Chat Widget] Lỗi khởi tạo:', err);
    });

  function initWidget(config, apiHost, workspaceId) {
    const themeColor = config.themeColor || '#6366f1';
    const themeColor2 = config.themeColor2 || '#06b6d4';
    const widgetTitle = config.title || 'Hỗ Trợ Khách Hàng AI';
    const welcomeMsg = config.welcomeMessage || 'Chào bạn! Mình là trợ lý ảo hỗ trợ trực tuyến. Mình có thể giúp gì cho bạn hôm nay?';
    const botName = config.botName || 'AI';
    const avatarUrl = config.avatarUrl || '';

    // 3. Inject CSS
    const css = `
      #ai-chat-widget-root {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 999999;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }
      #ai-chat-bubble {
        width: 60px;
        height: 60px;
        border-radius: 30px;
        background: linear-gradient(135deg, ${themeColor}, ${themeColor2});
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        outline: none;
      }
      #ai-chat-bubble:hover {
        transform: scale(1.1) rotate(5deg);
        box-shadow: 0 15px 30px -5px rgba(0, 0, 0, 0.25);
      }
      #ai-chat-bubble svg {
        width: 28px;
        height: 28px;
      }
      #ai-chat-panel {
        position: absolute;
        bottom: 80px;
        right: 0;
        width: 360px;
        height: 520px;
        max-height: calc(100vh - 120px);
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 20px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        transform-origin: bottom right;
        color: #1f2937;
      }
      #ai-chat-panel.hidden {
        display: none !important;
        opacity: 0;
        transform: scale(0.8) translateY(20px);
      }
      #ai-chat-header {
        background: linear-gradient(135deg, ${themeColor}, ${themeColor2});
        color: white;
        padding: 16px;
        display: flex;
        align-items: center;
        border-top-left-radius: 20px;
        border-top-right-radius: 20px;
      }
      .ai-chat-avatar-container {
        position: relative;
        margin-right: 12px;
      }
      .ai-chat-avatar {
        width: 40px;
        height: 40px;
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
        border: 1.5px solid rgba(255, 255, 255, 0.5);
        background-size: cover;
        background-position: center;
      }
      .ai-chat-status-dot {
        width: 10px;
        height: 10px;
        background-color: #22c55e;
        border: 2px solid ${themeColor};
        border-radius: 50%;
        position: absolute;
        bottom: 0;
        right: 0;
        animation: ai-pulse 2s infinite;
      }
      .ai-chat-header-info h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
      }
      .ai-chat-header-info p {
        margin: 2px 0 0 0;
        font-size: 11px;
        opacity: 0.85;
      }
      #ai-chat-close-btn {
        margin-left: auto;
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        opacity: 0.8;
        transition: opacity 0.2s;
      }
      #ai-chat-close-btn:hover {
        opacity: 1;
      }
      #ai-chat-close-btn svg {
        width: 20px;
        height: 20px;
      }
      #ai-chat-messages {
        flex: 1;
        padding: 16px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .ai-message {
        max-width: 80%;
        padding: 10px 14px;
        border-radius: 16px;
        font-size: 14px;
        line-height: 1.45;
        word-break: break-word;
      }
      .ai-message.bot {
        align-self: flex-start;
        background-color: rgba(243, 244, 246, 0.9);
        color: #1f2937;
        border-bottom-left-radius: 4px;
      }
      .ai-message.user {
        align-self: flex-end;
        background: linear-gradient(135deg, ${themeColor}, ${themeColor2});
        color: white;
        border-bottom-right-radius: 4px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
      }
      #ai-chat-form {
        padding: 12px;
        border-top: 1px solid rgba(229, 231, 235, 0.6);
        display: flex;
        gap: 8px;
        background: white;
      }
      #ai-chat-input {
        flex: 1;
        border: 1px solid rgba(209, 213, 219, 0.8);
        border-radius: 9999px;
        padding: 10px 16px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s;
        color: #1f2937 !important;
        background-color: #ffffff !important;
      }
      #ai-chat-input:focus {
        border-color: ${themeColor};
      }
      #ai-chat-send-btn {
        background: linear-gradient(135deg, ${themeColor}, ${themeColor2});
        border: none;
        color: white;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.2s;
      }
      #ai-chat-send-btn:hover {
        transform: scale(1.05);
      }
      #ai-chat-send-btn svg {
        width: 18px;
        height: 18px;
      }
      #ai-typing-indicator {
        align-self: flex-start;
        background-color: rgba(243, 244, 246, 0.9);
        padding: 10px 16px;
        border-radius: 16px;
        border-bottom-left-radius: 4px;
        display: flex;
        gap: 4px;
        margin-left: 16px;
        margin-bottom: 8px;
      }
      #ai-typing-indicator .dot {
        width: 6px;
        height: 6px;
        background-color: #9ca3af;
        border-radius: 50%;
        animation: ai-typing 1.4s infinite ease-in-out both;
      }
      #ai-typing-indicator .dot:nth-child(1) { animation-delay: -0.32s; }
      #ai-typing-indicator .dot:nth-child(2) { animation-delay: -0.16s; }
      .fade-in {
        animation: ai-fadeIn 0.3s ease-out forwards;
      }
      @keyframes ai-fadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes ai-pulse {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
        70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
      }
      @keyframes ai-typing {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1.0); }
      }
      .hidden {
        display: none !important;
      }
    `;

    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    // 4. Inject HTML
    const widgetRoot = document.createElement('div');
    widgetRoot.id = 'ai-chat-widget-root';

    const avatarHtml = avatarUrl 
      ? `<div class="ai-chat-avatar" style="background-image: url('${avatarUrl}')"></div>`
      : `<div class="ai-chat-avatar">${botName.slice(0, 2).toUpperCase()}</div>`;

    widgetRoot.innerHTML = `
      <button id="ai-chat-bubble" aria-label="Trò chuyện với chúng tôi">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.598.598 0 01-.655-.07.598.598 0 01-.165-.63l.89-3.21A7.901 7.901 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      </button>
      <div id="ai-chat-panel" class="hidden">
        <div id="ai-chat-header">
          <div class="ai-chat-avatar-container">
            ${avatarHtml}
            <div class="ai-chat-status-dot"></div>
          </div>
          <div class="ai-chat-header-info">
            <h3>${widgetTitle}</h3>
            <p>Trực tuyến - phản hồi tức thì</p>
          </div>
          <button id="ai-chat-close-btn" aria-label="Đóng chat">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div id="ai-chat-messages">
          <div class="ai-message bot fade-in">${welcomeMsg}</div>
        </div>
        <div id="ai-typing-indicator" class="hidden">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
        <form id="ai-chat-form">
          <input type="text" id="ai-chat-input" placeholder="Nhập tin nhắn..." required autocomplete="off" />
          <button type="submit" id="ai-chat-send-btn" aria-label="Gửi">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(widgetRoot);

    // 5. JavaScript logic
    const bubble = document.getElementById('ai-chat-bubble');
    const panel = document.getElementById('ai-chat-panel');
    const closeBtn = document.getElementById('ai-chat-close-btn');
    const form = document.getElementById('ai-chat-form');
    const input = document.getElementById('ai-chat-input');
    const messagesContainer = document.getElementById('ai-chat-messages');
    const typingIndicator = document.getElementById('ai-typing-indicator');

    const STORAGE_KEY = `cskh_session_id_${workspaceId}`;
    let sessionId = localStorage.getItem(STORAGE_KEY) || '';
    let renderedCount = 1; // 1 message ban đầu
    let syncInterval = null;

    async function syncMessages() {
      if (!sessionId) return;
      try {
        const response = await fetch(`${apiHost}/api/public/cskh/chat/sync?sessionId=${sessionId}`);
        if (!response.ok) return;
        const data = await response.json();
        
        // Tránh ghi đè nếu dữ liệu rỗng hoặc sai dạng
        if (data && Array.isArray(data)) {
          if (data.length !== renderedCount) {
            messagesContainer.innerHTML = '';
            // Gắn lại welcome message
            appendMessage(welcomeMsg, 'bot');
            
            data.forEach(msg => {
              appendMessage(msg.content, msg.sender === 'visitor' ? 'user' : 'bot');
            });
            renderedCount = data.length + 1;
            scrollToBottom();
          }
        }
      } catch (err) {
        console.error('[CSKH Chat Widget] Lỗi đồng bộ tin nhắn:', err);
      }
    }

    bubble.addEventListener('click', () => {
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) {
        input.focus();
        syncMessages();
        scrollToBottom();
        if (!syncInterval) {
          syncInterval = setInterval(syncMessages, 4000);
        }
      } else {
        if (syncInterval) {
          clearInterval(syncInterval);
          syncInterval = null;
        }
      }
    });

    closeBtn.addEventListener('click', () => {
      panel.classList.add('hidden');
      if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
      }
    });

    function scrollToBottom() {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const messageText = input.value.trim();
      if (!messageText) return;

      appendMessage(messageText, 'user');
      input.value = '';
      scrollToBottom();

      typingIndicator.classList.remove('hidden');
      scrollToBottom();

      try {
        const response = await fetch(`${apiHost}/api/public/cskh/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            workspaceId: parseInt(workspaceId, 10),
            sessionId: sessionId,
            message: messageText
          })
        });

        const data = await response.json();
        typingIndicator.classList.add('hidden');

        if (data.sessionId) {
          sessionId = data.sessionId;
          localStorage.setItem(STORAGE_KEY, sessionId);
        }

        if (data.reply) {
          appendMessage(data.reply, 'bot');
          renderedCount++;
        } else if (data.reply === '') {
          // Trạng thái nhân viên đang tiếp quản, chờ đồng bộ tin nhắn từ worker
        }
      } catch (err) {
        typingIndicator.classList.add('hidden');
        appendMessage('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.', 'bot');
        console.error('[CSKH Chat Widget] Lỗi gửi tin nhắn:', err);
      }
      scrollToBottom();
    });

    function appendMessage(text, sender) {
      const msgDiv = document.createElement('div');
      msgDiv.className = `ai-message ${sender} fade-in`;
      msgDiv.innerText = text;
      messagesContainer.appendChild(msgDiv);
    }
  }
})();
