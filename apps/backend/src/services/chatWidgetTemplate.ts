export function getChatWidgetHtml(workspaceId: number): string {
  return `
<!-- AI Chat Widget Code -->
<div id="ai-chat-widget-root">
  <!-- Chat Bubble Button -->
  <button id="ai-chat-bubble" aria-label="Chat với chúng tôi">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.598.598 0 01-.655-.07.598.598 0 01-.165-.63l.89-3.21A7.901 7.901 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  </button>

  <!-- Chat Panel -->
  <div id="ai-chat-panel" class="hidden">
    <!-- Header -->
    <div id="ai-chat-header">
      <div class="ai-chat-avatar-container">
        <div class="ai-chat-avatar">AI</div>
        <div class="ai-chat-status-dot"></div>
      </div>
      <div class="ai-chat-header-info">
        <h3>Hỗ Trợ Khách Hàng AI</h3>
        <p>Thường trả lời ngay lập tức</p>
      </div>
      <button id="ai-chat-close-btn" aria-label="Đóng chat">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Messages Container -->
    <div id="ai-chat-messages">
      <div class="ai-message bot fade-in">
        Chào bạn! Mình là trợ lý ảo hỗ trợ trực tuyến. Mình có thể giúp gì cho bạn hôm nay?
      </div>
    </div>

    <!-- Typing Indicator -->
    <div id="ai-typing-indicator" class="hidden">
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    </div>

    <!-- Input Form -->
    <form id="ai-chat-form">
      <input type="text" id="ai-chat-input" placeholder="Nhập tin nhắn..." required autocomplete="off" />
      <button type="submit" id="ai-chat-send-btn" aria-label="Gửi">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
        </svg>
      </button>
    </form>
  </div>
</div>

<style>
  /* Root vars & container */
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

  /* Chat Bubble Button */
  #ai-chat-bubble {
    width: 60px;
    height: 60px;
    border-radius: 30px;
    background: linear-gradient(135deg, #6366f1, #06b6d4);
    box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.4), 0 8px 10px -6px rgba(99, 102, 241, 0.4);
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
    box-shadow: 0 20px 25px -5px rgba(99, 102, 241, 0.5);
  }
  #ai-chat-bubble svg {
    width: 28px;
    height: 28px;
  }

  /* Chat Panel */
  #ai-chat-panel {
    position: absolute;
    bottom: 80px;
    right: 0;
    width: 360px;
    height: 520px;
    max-height: calc(100vh - 120px);
    background: rgba(255, 255, 255, 0.85);
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

  /* Header */
  #ai-chat-header {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.95), rgba(6, 180, 212, 0.95));
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
  }
  .ai-chat-status-dot {
    width: 10px;
    height: 10px;
    background-color: #22c55e;
    border: 2px solid #6366f1;
    border-radius: 50%;
    position: absolute;
    bottom: 0;
    right: 0;
    animation: pulse 2s infinite;
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

  /* Messages Container */
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
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    color: white;
    border-bottom-right-radius: 4px;
    box-shadow: 0 4px 10px rgba(99, 102, 241, 0.25);
  }

  /* Form & Input */
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
    border-color: #6366f1;
  }
  #ai-chat-input::placeholder {
    color: #9ca3af !important;
    opacity: 1 !important;
  }
  #ai-chat-send-btn {
    background: linear-gradient(135deg, #6366f1, #4f46e5);
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

  /* Typing Indicator */
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
    animation: typing 1.4s infinite ease-in-out both;
  }
  #ai-typing-indicator .dot:nth-child(1) { animation-delay: -0.32s; }
  #ai-typing-indicator .dot:nth-child(2) { animation-delay: -0.16s; }

  /* Animations */
  .fade-in {
    animation: fadeIn 0.3s ease-out forwards;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
  }
  @keyframes typing {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1.0); }
  }
  .hidden {
    display: none !important;
  }
</style>

<script>
  (function() {
    const bubble = document.getElementById('ai-chat-bubble');
    const panel = document.getElementById('ai-chat-panel');
    const closeBtn = document.getElementById('ai-chat-close-btn');
    const form = document.getElementById('ai-chat-form');
    const input = document.getElementById('ai-chat-input');
    const messagesContainer = document.getElementById('ai-chat-messages');
    const typingIndicator = document.getElementById('ai-typing-indicator');

    const STORAGE_KEY = 'cskh_session_id_${workspaceId}';
    let sessionId = localStorage.getItem(STORAGE_KEY) || '';

    let renderedCount = 0;
    let syncInterval = null;
    
    // Socket.io initialization for real-time order/checkout update
    let socket = null;
    function initSocket() {
      if (socket) return;
      const socketScript = document.createElement('script');
      socketScript.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
      document.head.appendChild(socketScript);
      socketScript.onload = () => {
        const socketIoHost = window.location.origin;
        socket = io(socketIoHost);
        if (sessionId) {
          socket.emit('join_session', sessionId);
        }
        
        socket.on('order_paid', (data) => {
          appendMessage('🎉 Xác nhận thanh toán thành công cho đơn hàng ' + data.orderNumber + '! Hệ thống đã ghi nhận giao dịch của bạn.', 'bot');
          scrollToBottom();
        });

        socket.on('new_message', (msg) => {
          if (msg.sender !== 'visitor') {
            syncMessages();
          }
        });
      };
    }

    async function syncMessages() {
      if (!sessionId) return;
      try {
        const response = await fetch('/api/public/cskh/chat/sync?sessionId=' + sessionId);
        if (!response.ok) return;
        const data = await response.json();
        if (data.success && data.messages && data.messages.length !== renderedCount) {
          messagesContainer.innerHTML = '';
          data.messages.forEach(msg => {
            appendMessage(msg.content, msg.sender === 'visitor' ? 'user' : 'bot');
          });
          renderedCount = data.messages.length;
          scrollToBottom();
        }
      } catch (err) {
        console.error(err);
      }
    }

    // Open/Close toggle
    bubble.addEventListener('click', () => {
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) {
        input.focus();
        initSocket();
        syncMessages();
        scrollToBottom();
        if (!syncInterval) {
          syncInterval = setInterval(syncMessages, 3000);
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

    // Submit Message
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const messageText = input.value.trim();
      if (!messageText) return;

      // Add user message to UI
      appendMessage(messageText, 'user');
      input.value = '';
      scrollToBottom();

      // Show typing indicator
      typingIndicator.classList.remove('hidden');
      scrollToBottom();

      try {
        const response = await fetch('/api/public/cskh/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            workspaceId: ${workspaceId},
            sessionId: sessionId,
            message: messageText
          })
        });

        const data = await response.json();
        
        // Hide typing indicator
        typingIndicator.classList.add('hidden');

        if (data.sessionId) {
          const oldSessionId = sessionId;
          sessionId = data.sessionId;
          localStorage.setItem(STORAGE_KEY, sessionId);
          if (socket && oldSessionId !== sessionId) {
            socket.emit('join_session', sessionId);
          }
        }

        if (data.reply) {
          appendMessage(data.reply, 'bot');
          renderedCount++;
        } else if (data.reply === '') {
          // Agent is active. Do nothing, wait for syncMessages polling to show agent reply.
        } else {
          appendMessage('Rất tiếc, đã có lỗi xảy ra. Vui lòng thử lại.', 'bot');
        }
      } catch (err) {
        typingIndicator.classList.add('hidden');
        appendMessage('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng.', 'bot');
        console.error(err);
      }
      scrollToBottom();
    });

    function appendMessage(text, sender) {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'ai-message ' + sender + ' fade-in';
      
      if (sender === 'bot') {
        // Parse Payment Checkout Cards
        const checkoutUrlMatch = text.match(/(https?:\/\/[^\s]+(?:checkout|pay\.payos\.vn|stripe\.com|pay\.stripe\.com|ORD-)[^\s]*)/i);
        const qrUrlMatch = text.match(/(https?:\/\/img\.vietqr\.io\/image\/[^\s]+)/i);
        
        if (checkoutUrlMatch || qrUrlMatch) {
          const checkoutUrl = checkoutUrlMatch ? checkoutUrlMatch[1].replace(/[.,;:"]$/, '') : '';
          const qrUrl = qrUrlMatch ? qrUrlMatch[1].replace(/[.,;:"]$/, '') : '';
          
          let cleanText = text;
          if (checkoutUrl) cleanText = cleanText.replace(checkoutUrl, '');
          if (qrUrl) cleanText = cleanText.replace(qrUrl, '');
          cleanText = cleanText.replace(/(Link thanh toán:|Mã QR:|Quét mã QR để thanh toán:)/gi, '').trim();
          
          msgDiv.innerHTML = '<div style="margin-bottom:8px;">' + cleanText + '</div>';
          
          const card = document.createElement('div');
          card.style.cssText = "background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; padding:12px; margin-top:8px; box-shadow:0 2px 4px rgba(0,0,0,0.05); display:flex; flex-direction:column; align-items:center; gap:8px;";
          
          const cardTitle = document.createElement('div');
          cardTitle.style.cssText = "font-size:13px; font-weight:700; color:#374151; width:100%; text-align:left; border-bottom:1px solid #f3f4f6; padding-bottom:6px; display:flex; align-items:center; gap:6px;";
          cardTitle.innerHTML = '💳 <span>Đơn Hàng & Thanh Toán</span>';
          card.appendChild(cardTitle);
          
          if (qrUrl) {
            const qrImg = document.createElement('img');
            qrImg.src = qrUrl;
            qrImg.style.cssText = "width:140px; height:140px; border-radius:8px; border:1px solid #f3f4f6; transition:transform 0.2s;";
            qrImg.onmouseover = () => qrImg.style.transform = 'scale(1.05)';
            qrImg.onmouseout = () => qrImg.style.transform = 'scale(1)';
            card.appendChild(qrImg);
            
            const qrHint = document.createElement('div');
            qrHint.style.cssText = "font-size:10px; color:#6b7280; font-style:italic;";
            qrHint.innerText = "Quét mã VietQR bằng ứng dụng ngân hàng";
            card.appendChild(qrHint);
          }
          
          if (checkoutUrl) {
            const payBtn = document.createElement('a');
            payBtn.href = checkoutUrl;
            payBtn.target = "_blank";
            payBtn.style.cssText = "width:100%; text-align:center; padding:8px 12px; background:linear-gradient(135deg, #e85d26, #f97316); color:#fff; border-radius:8px; font-size:12px; font-weight:700; text-decoration:none; box-shadow:0 2px 4px rgba(232,93,38,0.2); transition:all 0.2s;";
            payBtn.innerText = "Thanh toán trực tuyến";
            payBtn.onmouseover = () => { payBtn.style.filter = 'brightness(1.05)'; };
            payBtn.onmouseout = () => { payBtn.style.filter = 'brightness(1)'; };
            card.appendChild(payBtn);
          }
          
          msgDiv.appendChild(card);
          messagesContainer.appendChild(msgDiv);
          return;
        }

        const citationRegex = /\\\*\\(Tham khảo từ:\\s\*([^\\)]+)\\)\\\*/;
        const citationRegexAlt = /\*\(Tham khảo từ:\s*([^\)]+)\)\*/;
        const match = text.match(citationRegex) || text.match(citationRegexAlt);
        if (match) {
          const cleanText = text.replace(citationRegex, '').replace(citationRegexAlt, '').trim();
          const refs = match[1].split(',').map(s => s.trim()).filter(Boolean);
          
          msgDiv.innerText = cleanText;
          
          const refsContainer = document.createElement('div');
          refsContainer.style.marginTop = '6px';
          refsContainer.style.paddingTop = '6px';
          refsContainer.style.borderTop = '1px solid rgba(0,0,0,0.06)';
          refsContainer.style.display = 'flex';
          refsContainer.style.flexWrap = 'wrap';
          refsContainer.style.gap = '4px';
          refsContainer.style.alignItems = 'center';
          
          const label = document.createElement('span');
          label.innerText = '📖 Nguồn:';
          label.style.fontSize = '9px';
          label.style.fontWeight = 'bold';
          label.style.opacity = '0.7';
          refsContainer.appendChild(label);
          
          refs.forEach(ref => {
            const badge = document.createElement('span');
            badge.innerText = ref;
            badge.style.fontSize = '9.5px';
            badge.style.padding = '2px 5px';
            badge.style.borderRadius = '4px';
            badge.style.background = 'rgba(0,0,0,0.06)';
            badge.style.color = '#374151';
            badge.style.fontWeight = '600';
            refsContainer.appendChild(badge);
          });
          
          msgDiv.appendChild(refsContainer);
          messagesContainer.appendChild(msgDiv);
          return;
        }
      }
      
      msgDiv.innerText = text;
      messagesContainer.appendChild(msgDiv);
    }
  })();
</script>
`;
}
