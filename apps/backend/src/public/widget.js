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
      #ai-chat-form {
        position: relative;
      }
      #ai-chat-image-btn {
        background: none;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.2s;
        outline: none;
      }
      #ai-chat-image-btn:hover {
        color: ${themeColor};
      }
      #ai-chat-image-btn svg {
        width: 20px;
        height: 20px;
      }
      #ai-chat-image-preview-container {
        padding: 8px 16px;
        background: white;
        border-top: 1px solid rgba(229, 231, 235, 0.6);
        display: flex;
        align-items: center;
        position: relative;
      }
      #ai-chat-image-preview {
        max-height: 60px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
      }
      #ai-chat-image-preview-close {
        position: absolute;
        top: 4px;
        left: 70px;
        background: rgba(0, 0, 0, 0.6);
        color: white;
        border: none;
        border-radius: 50%;
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        cursor: pointer;
      }
      .ai-message img {
        max-width: 100%;
        max-height: 200px;
        border-radius: 8px;
        margin-top: 8px;
        display: block;
      }
      .ai-message-actions {
        display: flex;
        gap: 6px;
        margin-top: 4px;
        justify-content: flex-end;
      }
      .ai-speak-btn {
        background: none;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        padding: 2px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: color 0.2s;
        outline: none;
      }
      .ai-message.bot .ai-speak-btn {
        color: #8b93a5;
      }
      .ai-message.bot .ai-speak-btn:hover {
        color: ${themeColor};
      }
      #ai-chat-mic-btn {
        background: none;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        outline: none;
      }
      #ai-chat-mic-btn:hover {
        color: ${themeColor};
      }
      #ai-chat-mic-btn svg {
        width: 20px;
        height: 20px;
      }
      #ai-chat-mic-btn.recording {
        color: #ef4444;
        animation: ai-mic-pulse 1.2s infinite alternate;
      }
      @keyframes ai-mic-pulse {
        from { transform: scale(1); }
        to { transform: scale(1.18); }
      }
      .hidden {
        display: none !important;
      }
    `;

    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    // Inject Socket.io script dynamically
    const socketScript = document.createElement('script');
    socketScript.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
    socketScript.onload = () => {
      if (typeof initSocketConnection === 'function') {
        initSocketConnection();
      }
    };
    document.head.appendChild(socketScript);

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
        <div id="ai-chat-image-preview-container" class="hidden">
          <img id="ai-chat-image-preview" src="" alt="Preview" />
          <button type="button" id="ai-chat-image-preview-close" aria-label="Xóa ảnh">×</button>
        </div>
        <form id="ai-chat-form">
          <input type="file" id="ai-chat-image-input" accept="image/*" class="hidden" />
          <button type="button" id="ai-chat-image-btn" aria-label="Tải ảnh">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </button>
          <input type="text" id="ai-chat-input" placeholder="Nhập tin nhắn..." autocomplete="off" />
          <button type="button" id="ai-chat-mic-btn" aria-label="Ghi âm giọng nói">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </button>
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
    const micBtn = document.getElementById('ai-chat-mic-btn');

    const STORAGE_KEY = `cskh_session_id_${workspaceId}`;
    let sessionId = localStorage.getItem(STORAGE_KEY) || '';
    const renderedMessageIds = new Set();
    const pendingVisitorMessages = [];
    let socket = null;

    // --- AI Voice Chat: Speech-to-Text (STT) Logic ---
    let recognition = null;
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'vi-VN';

      recognition.onstart = () => {
        isRecording = true;
        micBtn.classList.add('recording');
        input.placeholder = 'Đang nghe giọng nói của bạn...';
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          input.value = (input.value ? input.value + ' ' : '') + transcript;
        }
      };

      recognition.onerror = (event) => {
        console.error('[WebSpeech STT] Error:', event.error);
        if (event.error !== 'no-speech') {
          startWhisperRecordingFallback();
        }
      };

      recognition.onend = () => {
        isRecording = false;
        micBtn.classList.remove('recording');
        input.placeholder = 'Nhập tin nhắn...';
      };
    }

    async function startWhisperRecordingFallback() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };

        mediaRecorder.onstart = () => {
          isRecording = true;
          micBtn.classList.add('recording');
          input.placeholder = 'Đang ghi âm (Whisper)... Click lại để dừng';
        };

        mediaRecorder.onstop = async () => {
          isRecording = false;
          micBtn.classList.remove('recording');
          input.placeholder = 'Đang nhận dạng giọng nói...';

          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('audio', audioBlob, 'speech.webm');

          try {
            const res = await fetch(`${apiHost}/api/public/cskh/transcribe`, {
              method: 'POST',
              body: formData
            });
            const data = await res.json();
            if (data.text) {
              input.value = (input.value ? input.value + ' ' : '') + data.text;
            } else if (data.error) {
              console.error('[Whisper STT] Error from server:', data.error);
            }
          } catch (err) {
            console.error('[Whisper STT] Net error:', err);
          } finally {
            input.placeholder = 'Nhập tin nhắn...';
            stream.getTracks().forEach(track => track.stop());
          }
        };

        mediaRecorder.start();
      } catch (err) {
        console.error('[MediaRecorder STT] getUserMedia error:', err);
        alert('Không thể truy cập Microphone của bạn.');
        isRecording = false;
        micBtn.classList.remove('recording');
        input.placeholder = 'Nhập tin nhắn...';
      }
    }

    if (micBtn) {
      micBtn.addEventListener('click', () => {
        if (isRecording) {
          if (recognition) {
            recognition.stop();
          } else if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
        } else {
          if (recognition) {
            try {
              recognition.start();
            } catch (e) {
              console.warn('[WebSpeech STT] Failed starting recognition, fallback:', e);
              startWhisperRecordingFallback();
            }
          } else {
            startWhisperRecordingFallback();
          }
        }
      });
    }

    function initSocketConnection() {
      if (typeof io === 'undefined') return;
      if (socket) return; // Prevent double initialization
      
      socket = io(apiHost);
      
      if (sessionId) {
        socket.emit('join_session', sessionId);
      }
      
      socket.on('new_message', (msg) => {
        if (msg.sender === 'visitor') {
          const index = pendingVisitorMessages.indexOf(msg.content);
          if (index !== -1) {
            renderedMessageIds.add(msg.id);
            pendingVisitorMessages.splice(index, 1);
          } else {
            appendMessage(msg.content, 'user', msg.id);
          }
        } else {
          const sender = msg.sender === 'visitor' ? 'user' : 'bot';
          appendMessage(msg.content, sender, msg.id);
          if (msg.sender === 'bot' || msg.sender === 'agent') {
            typingIndicator.classList.add('hidden');
          }
        }
        scrollToBottom();
      });
    }

    async function syncMessages() {
      if (!sessionId) return;
      try {
        const response = await fetch(`${apiHost}/api/public/cskh/chat/sync?sessionId=${sessionId}`);
        if (!response.ok) return;
        const data = await response.json();
        
        if (data && data.success && Array.isArray(data.messages)) {
          const newMessages = data.messages.filter(msg => !renderedMessageIds.has(msg.id));
          if (newMessages.length > 0) {
            newMessages.forEach(msg => {
              appendMessage(msg.content, msg.sender === 'visitor' ? 'user' : 'bot', msg.id);
            });
            scrollToBottom();
          }
        }
      } catch (err) {
        console.error('[CSKH Chat Widget] Lỗi đồng bộ tin nhắn:', err);
      }
    }

    const imageInput = document.getElementById('ai-chat-image-input');
    const imageBtn = document.getElementById('ai-chat-image-btn');
    const imagePreviewContainer = document.getElementById('ai-chat-image-preview-container');
    const imagePreview = document.getElementById('ai-chat-image-preview');
    const imagePreviewClose = document.getElementById('ai-chat-image-preview-close');
    let uploadedImageUrl = '';

    // Handle image selection, preview and upload
    imageBtn.addEventListener('click', () => {
      imageInput.click();
    });

    imageInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Show local preview immediately
      const reader = new FileReader();
      reader.onload = (event) => {
        imagePreview.src = event.target.result;
        imagePreviewContainer.classList.remove('hidden');
      };
      reader.readAsDataURL(file);

      // Upload to server
      const formData = new FormData();
      formData.append('image', file);

      try {
        const res = await fetch(`${apiHost}/api/public/cskh/upload-image`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.imageUrl) {
          uploadedImageUrl = data.imageUrl;
        } else {
          alert(data.error || 'Lỗi tải ảnh lên.');
          clearImagePreview();
        }
      } catch (err) {
        console.error('Error uploading image:', err);
        alert('Lỗi kết nối máy chủ khi tải ảnh.');
        clearImagePreview();
      }
    });

    imagePreviewClose.addEventListener('click', () => {
      clearImagePreview();
    });

    function clearImagePreview() {
      imageInput.value = '';
      imagePreview.src = '';
      imagePreviewContainer.classList.add('hidden');
      uploadedImageUrl = '';
    }

    // Try starting socket connection if script is already loaded
    if (typeof io !== 'undefined') {
      initSocketConnection();
    }

    bubble.addEventListener('click', () => {
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) {
        input.focus();
        syncMessages();
        scrollToBottom();
      }
    });

    closeBtn.addEventListener('click', () => {
      panel.classList.add('hidden');
    });

    function scrollToBottom() {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const messageText = input.value.trim();
      if (!messageText && !uploadedImageUrl) return;

      appendMessage(messageText, 'user', null, uploadedImageUrl);
      if (messageText) {
        pendingVisitorMessages.push(messageText);
      }
      
      const currentImageUrl = uploadedImageUrl;
      clearImagePreview();
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
            message: messageText || 'Ảnh đính kèm',
            imageUrl: currentImageUrl
          })
        });

        const data = await response.json();
        
        if (data.sessionId && data.sessionId !== sessionId) {
          sessionId = data.sessionId;
          localStorage.setItem(STORAGE_KEY, sessionId);
          if (socket) {
            socket.emit('join_session', sessionId);
          }
        }

        // Fallback: If socket is not connected, manually append reply
        if (!socket || !socket.connected) {
          typingIndicator.classList.add('hidden');
          if (data.reply) {
            appendMessage(data.reply, 'bot');
          }
        }
      } catch (err) {
        typingIndicator.classList.add('hidden');
        appendMessage('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.', 'bot');
        console.error('[CSKH Chat Widget] Lỗi gửi tin nhắn:', err);
      }
      scrollToBottom();
    });

    function appendMessage(text, sender, id, imageUrl) {
      if (id && renderedMessageIds.has(id)) return;
      if (id) renderedMessageIds.add(id);

      const msgDiv = document.createElement('div');
      msgDiv.className = `ai-message ${sender} fade-in`;
      
      if (text) {
        const textSpan = document.createElement('span');
        textSpan.innerText = text;
        msgDiv.appendChild(textSpan);
      }
      
      if (imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl.startsWith('/') ? `${apiHost}${imageUrl}` : imageUrl;
        img.alt = 'Ảnh đính kèm';
        msgDiv.appendChild(img);
      }

      // --- AI Voice Chat: Text-to-Speech (TTS) Logic ---
      if (sender === 'bot' && text) {
        const speakBtn = document.createElement('button');
        speakBtn.type = 'button';
        speakBtn.className = 'ai-speak-btn';
        speakBtn.title = 'Nghe đọc tin nhắn';
        speakBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 14px; height: 14px; display: block;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75 0 011.28.53v15.88a.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
          </svg>
        `;
        
        let speaking = false;
        speakBtn.addEventListener('click', () => {
          if (speaking) {
            window.speechSynthesis.cancel();
            speaking = false;
            speakBtn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 14px; height: 14px; display: block;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75 0 011.28.53v15.88a.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
            `;
          } else {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            const voices = window.speechSynthesis.getVoices();
            const viVoice = voices.find(v => v.lang.startsWith('vi') || v.lang.includes('vi-VN'));
            if (viVoice) {
              utterance.voice = viVoice;
            }
            utterance.lang = 'vi-VN';
            
            utterance.onend = () => {
              speaking = false;
              speakBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 14px; height: 14px; display: block;">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75 0 011.28.53v15.88a.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
              `;
            };
            
            speaking = true;
            speakBtn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 14px; height: 14px; display: block;">
                <rect x="6" y="6" width="12" height="12" rx="1.5" />
              </svg>
            `;
            window.speechSynthesis.speak(utterance);
          }
        });
        
        const actionContainer = document.createElement('div');
        actionContainer.className = 'ai-message-actions';
        actionContainer.appendChild(speakBtn);
        msgDiv.appendChild(actionContainer);
      }

      messagesContainer.appendChild(msgDiv);
    }
  }
})();
