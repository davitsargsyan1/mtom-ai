(function () {
  'use strict';

  // Prevent multiple widget loads
  if (window.MTOMAIWidget) {
    console.warn('MTOM AI Widget is already loaded');
    return;
  }

  // Get script tag attributes
  const currentScript =
    document.currentScript ||
    (function () {
      const scripts = document.getElementsByTagName('script');
      return scripts[scripts.length - 1];
    })();

  const widgetId = currentScript.getAttribute('data-widget-id');
  const apiKey = currentScript.getAttribute('data-api-key');
  // Fix baseUrl construction - remove /widget path to get server base URL
  const scriptUrl = currentScript.src;
  const baseUrl = scriptUrl.substring(0, scriptUrl.indexOf('/widget'));

  if (!widgetId || !apiKey) {
    console.error('MTOM AI Widget: Missing required attributes (data-widget-id, data-api-key)');
    return;
  }

  // Widget configuration
  let config = null;
  let socket = null;
  let sessionId = null;
  let isOpen = false;
  let isMinimized = true;
  let messageCount = 0;

  // Widget HTML structure
  const widgetHTML = `
    <div id="mtom-ai-widget" style="position: fixed; z-index: 2147483647; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Widget Button -->
      <div id="mtom-widget-button" style="
        position: fixed;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: #3B82F6;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        border: none;
        outline: none;
      ">
        <svg id="mtom-chat-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: white;">
          <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z" fill="currentColor"/>
          <circle cx="12" cy="10" r="1" fill="currentColor"/>
          <circle cx="8" cy="10" r="1" fill="currentColor"/>
          <circle cx="16" cy="10" r="1" fill="currentColor"/>
        </svg>
        <svg id="mtom-close-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: white; display: none;">
          <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor"/>
        </svg>
      </div>
      
      <!-- Widget Chat Panel -->
      <div id="mtom-widget-panel" style="
        position: fixed;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        display: none;
        flex-direction: column;
        overflow: hidden;
        transition: all 0.3s ease;
        border: 1px solid #E5E7EB;
      ">
        <!-- Header -->
        <div id="mtom-widget-header" style="
          background: #3B82F6;
          color: white;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        ">
          <div style="display: flex; align-items: center;">
            <div style="
              width: 8px;
              height: 8px;
              background: #10B981;
              border-radius: 50%;
              margin-right: 8px;
            "></div>
            <span id="mtom-widget-title" style="font-weight: 600; font-size: 14px;">Support Chat</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button id="mtom-email-button" style="
              background: none;
              border: none;
              color: white;
              cursor: pointer;
              padding: 4px;
              border-radius: 4px;
              transition: background 0.2s;
              display: none;
            " title="Email transcript">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="L22 6L12 13L2 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button id="mtom-feedback-button" style="
              background: none;
              border: none;
              color: white;
              cursor: pointer;
              padding: 4px;
              border-radius: 4px;
              transition: background 0.2s;
              display: none;
            " title="Rate your experience">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button id="mtom-minimize-button" style="
              background: none;
              border: none;
              color: white;
              cursor: pointer;
              padding: 4px;
              border-radius: 4px;
              transition: background 0.2s;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 13H5V11H19V13Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
        
        <!-- Messages Container -->
        <div id="mtom-messages-container" style="
          flex: 1;
          padding: 16px;
          max-height: 400px;
          overflow-y: auto;
          background: #F9FAFB;
        ">
          <div id="mtom-messages"></div>
          <div id="mtom-typing-indicator" style="display: none; margin-top: 8px;">
            <div style="
              background: white;
              border-radius: 16px;
              padding: 8px 12px;
              display: inline-block;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            ">
              <div style="display: flex; align-items: center; gap: 2px;">
                <div style="width: 4px; height: 4px; background: #6B7280; border-radius: 50%; animation: mtom-pulse 1.4s infinite;"></div>
                <div style="width: 4px; height: 4px; background: #6B7280; border-radius: 50%; animation: mtom-pulse 1.4s infinite 0.2s;"></div>
                <div style="width: 4px; height: 4px; background: #6B7280; border-radius: 50%; animation: mtom-pulse 1.4s infinite 0.4s;"></div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Input Container -->
        <div id="mtom-input-container" style="
          padding: 16px;
          border-top: 1px solid #E5E7EB;
          background: white;
        ">
          <div style="display: flex; align-items: center; gap: 8px;">
            <input id="mtom-message-input" type="text" placeholder="Type your message..." style="
              flex: 1;
              border: 1px solid #D1D5DB;
              border-radius: 20px;
              padding: 8px 16px;
              outline: none;
              font-size: 14px;
              transition: border-color 0.2s;
            ">
            <button id="mtom-send-button" style="
              background: #3B82F6;
              color: white;
              border: none;
              border-radius: 50%;
              width: 36px;
              height: 36px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: background 0.2s;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // CSS animations
  const widgetCSS = `
    @keyframes mtom-pulse {
      0%, 60%, 100% { opacity: 0.3; }
      30% { opacity: 1; }
    }
    
    #mtom-widget-button:hover {
      transform: scale(1.05);
    }
    
    #mtom-message-input:focus {
      border-color: #3B82F6;
    }
    
    #mtom-send-button:hover {
      background: #2563EB;
    }
    
    #mtom-minimize-button:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    
    .mtom-message {
      margin-bottom: 12px;
      animation: mtom-slide-up 0.3s ease;
    }
    
    .mtom-message-user {
      text-align: right;
    }
    
    .mtom-message-bubble {
      display: inline-block;
      max-width: 80%;
      padding: 8px 12px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.4;
    }
    
    .mtom-message-user .mtom-message-bubble {
      background: #3B82F6;
      color: white;
    }
    
    .mtom-message-assistant .mtom-message-bubble {
      background: white;
      color: #1F2937;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .mtom-feedback-buttons {
      margin-top: 6px;
      text-align: right;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .mtom-feedback-buttons:hover {
      opacity: 1;
    }

    .mtom-feedback-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px 6px;
      margin: 0 2px;
      border-radius: 12px;
      font-size: 16px;
      transition: all 0.2s;
      opacity: 0.6;
    }

    .mtom-feedback-btn:hover {
      opacity: 1;
      transform: scale(1.1);
    }

    .mtom-feedback-btn.rated {
      opacity: 1;
      background: rgba(59, 130, 246, 0.1);
    }

    .mtom-feedback-btn.positive:hover {
      background: rgba(34, 197, 94, 0.2);
    }

    .mtom-feedback-btn.negative:hover {
      background: rgba(239, 68, 68, 0.2);
    }

    .mtom-feedback-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 2147483648;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .mtom-feedback-content {
      background: white;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }

    .mtom-rating-stars {
      display: flex;
      gap: 4px;
      margin: 12px 0;
      justify-content: center;
    }

    .mtom-rating-star {
      font-size: 24px;
      cursor: pointer;
      color: #e5e7eb;
      transition: color 0.2s;
    }

    .mtom-rating-star:hover,
    .mtom-rating-star.active {
      color: #fbbf24;
    }

    @keyframes mtom-slide-up {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;

  // Initialize widget
  async function initWidget() {
    console.log('🚀 MTOM AI Widget: Starting initialization...');
    console.log('📋 Widget ID:', widgetId);
    console.log('🔗 Base URL:', baseUrl);

    try {
      // Load configuration
      console.log('📡 Fetching widget configuration...');
      const configUrl = `${baseUrl}/api/widget/${widgetId}/config`;
      console.log('🌐 Config URL:', configUrl);
      console.log('🔑 API Key:', apiKey);
      console.log('📍 Current origin:', window.location.origin);

      const configResponse = await fetch(configUrl, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        credentials: 'include',
      });

      console.log('📡 Config response status:', configResponse.status);
      console.log(
        '📡 Config response headers:',
        Object.fromEntries(configResponse.headers.entries()),
      );

      if (!configResponse.ok) {
        const errorText = await configResponse.text();
        console.error('❌ Config response error:', errorText);
        console.error('❌ Full response details:', {
          status: configResponse.status,
          statusText: configResponse.statusText,
          url: configResponse.url,
          headers: Object.fromEntries(configResponse.headers.entries()),
        });
        throw new Error(`Failed to load widget config: ${configResponse.status} - ${errorText}`);
      }

      config = await configResponse.json();
      console.log('✅ Widget configuration loaded:', config);

      // Create widget elements
      console.log('🎨 Creating widget elements...');
      createWidget();

      // Apply configuration
      console.log('⚙️ Applying configuration...');
      applyConfiguration();

      // Initialize WebSocket connection
      console.log('🔌 Initializing WebSocket...');
      await initializeWebSocket();

      // Start session
      console.log('🎯 Starting widget session...');
      await startSession();

      console.log('✅ MTOM AI Widget initialized successfully');
      console.log('🎮 Widget ready! Use MTOMAIWidget.isReady() to check status');
    } catch (error) {
      console.error('❌ MTOM AI Widget initialization failed:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        widgetId,
        baseUrl,
        apiKey: apiKey ? 'Present' : 'Missing',
      });

      // Only show fallback widget if no widget button exists at all
      if (!document.getElementById('mtom-widget-button')) {
        console.log('🆘 Creating fallback widget as last resort...');
        createFallbackWidget();
      } else {
        console.log('🔍 Widget button already exists, not creating fallback');
      }

      // Re-throw to ensure error is visible
      throw error;
    }
  }

  function createWidget() {
    console.log('🎨 Adding widget CSS...');
    // Add CSS
    const style = document.createElement('style');
    style.textContent = widgetCSS;
    document.head.appendChild(style);

    console.log('🏗️ Creating widget HTML...');

    // Remove any existing fallback widget first
    const existingButton = document.getElementById('mtom-widget-button');
    if (existingButton && existingButton.onclick) {
      console.log('🗑️ Removing existing fallback widget...');
      existingButton.remove();
    }

    // Add HTML
    const widgetContainer = document.createElement('div');
    widgetContainer.innerHTML = widgetHTML.trim();

    // Ensure the widget is properly added to the body
    const widgetElement = widgetContainer.firstElementChild;
    if (widgetElement) {
      document.body.appendChild(widgetElement);
      console.log('✅ MTOM AI Widget HTML injected successfully');

      // Verify elements were created
      const button = document.getElementById('mtom-widget-button');
      const panel = document.getElementById('mtom-widget-panel');
      const input = document.getElementById('mtom-message-input');

      if (button && panel && input) {
        console.log('✅ All widget elements created successfully');
        console.log('📋 Button element:', button);
        console.log('📋 Panel element:', panel);
        console.log('📋 Input element:', input);
      } else {
        console.error('❌ Some widget elements missing:', {
          button: !!button,
          panel: !!panel,
          input: !!input,
        });
        throw new Error('Critical widget elements are missing');
      }
    } else {
      console.error('❌ Failed to create widget element');
      throw new Error('Failed to create widget element');
    }

    // Wait a moment for elements to be available, then bind events
    setTimeout(() => {
      console.log('🔗 Binding widget events...');
      bindEvents();
    }, 100);
  }

  function createFallbackWidget() {
    console.log('🆘 Creating fallback widget...');

    // Create a simple fallback widget
    const fallbackHTML = `
      <div id="mtom-widget-button" style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: #3B82F6;
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
      " onclick="alert('Chat widget is temporarily unavailable. Please refresh the page.')">
        💬
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', fallbackHTML);
    console.log('✅ Fallback widget created');
  }

  function applyConfiguration() {
    const settings = config.settings;
    const button = document.getElementById('mtom-widget-button');
    const panel = document.getElementById('mtom-widget-panel');
    const title = document.getElementById('mtom-widget-title');
    const input = document.getElementById('mtom-message-input');

    // Position
    const positions = {
      'bottom-right': { bottom: settings.marginY + 'px', right: settings.marginX + 'px' },
      'bottom-left': { bottom: settings.marginY + 'px', left: settings.marginX + 'px' },
      'top-right': { top: settings.marginY + 'px', right: settings.marginX + 'px' },
      'top-left': { top: settings.marginY + 'px', left: settings.marginX + 'px' },
    };

    const pos = positions[settings.position];
    Object.assign(button.style, pos);

    // Panel position
    const panelPos = { ...pos };
    if (settings.position.includes('bottom')) {
      panelPos.bottom = settings.marginY + 80 + 'px';
    } else {
      panelPos.top = settings.marginY + 80 + 'px';
    }
    panelPos.width = settings.width + 'px';
    panelPos.height = settings.height + 'px';
    Object.assign(panel.style, panelPos);

    // Colors
    button.style.background = settings.primaryColor;
    document.getElementById('mtom-widget-header').style.background = settings.primaryColor;

    // Text
    title.textContent = settings.companyName;
    input.placeholder = settings.placeholderText;

    // Auto-open
    if (settings.autoOpen) {
      setTimeout(() => {
        if (!isOpen) {
          toggleWidget();
        }
      }, settings.autoOpenDelay);
    }

    // Welcome message
    if (settings.showWelcomeMessage && settings.welcomeMessage) {
      setTimeout(() => {
        addMessage('assistant', settings.welcomeMessage);
      }, 500);
    }
  }

  function bindEvents() {
    const button = document.getElementById('mtom-widget-button');
    const minimizeBtn = document.getElementById('mtom-minimize-button');
    const sendBtn = document.getElementById('mtom-send-button');
    const input = document.getElementById('mtom-message-input');
    const emailBtn = document.getElementById('mtom-email-button');
    const feedbackBtn = document.getElementById('mtom-feedback-button');

    console.log('🔍 Checking widget elements:', {
      button: !!button,
      minimizeBtn: !!minimizeBtn,
      sendBtn: !!sendBtn,
      input: !!input,
      emailBtn: !!emailBtn,
      feedbackBtn: !!feedbackBtn,
    });

    if (!button || !minimizeBtn || !sendBtn || !input || !emailBtn || !feedbackBtn) {
      console.error('❌ Widget elements not found, retrying in 500ms...');
      setTimeout(bindEvents, 500);
      return;
    }

    console.log('✅ All elements found, binding events...');

    try {
      button.addEventListener('click', toggleWidget);
      minimizeBtn.addEventListener('click', toggleWidget);
      sendBtn.addEventListener('click', sendMessage);
      emailBtn.addEventListener('click', showEmailModal);
      feedbackBtn.addEventListener('click', showSessionFeedbackModal);

      input.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
          sendMessage();
        }
      });

      input.addEventListener('input', () => {
        if (socket && sessionId) {
          socket.emit('typing_start', { sessionId });
          clearTimeout(window.mtomTypingTimeout);
          window.mtomTypingTimeout = setTimeout(() => {
            socket.emit('typing_stop', { sessionId });
          }, 1000);
        }
      });

      console.log('✅ Events bound successfully');

      // Mark widget as ready
      window.MTOMAIWidgetReady = true;
      console.log('🎉 Widget is now ready for use!');
    } catch (error) {
      console.error('❌ Error binding events:', error);
    }
  }

  function toggleWidget() {
    const button = document.getElementById('mtom-widget-button');
    const panel = document.getElementById('mtom-widget-panel');
    const chatIcon = document.getElementById('mtom-chat-icon');
    const closeIcon = document.getElementById('mtom-close-icon');

    // Check if elements exist before trying to access their properties
    if (!button || !panel || !chatIcon || !closeIcon) {
      console.error('Widget elements not found in toggleWidget');
      return;
    }

    isOpen = !isOpen;

    if (isOpen) {
      panel.style.display = 'flex';
      chatIcon.style.display = 'none';
      closeIcon.style.display = 'block';

      const input = document.getElementById('mtom-message-input');
      if (input) input.focus();

      // Track widget open event
      trackEvent('widget_open');
    } else {
      panel.style.display = 'none';
      chatIcon.style.display = 'block';
      closeIcon.style.display = 'none';

      // Track widget close event
      trackEvent('widget_close');
    }
  }

  async function initializeWebSocket() {
    const wsUrl = baseUrl.replace(/^http/, 'ws');
    socket = io(wsUrl);

    socket.on('connect', () => {
      console.log('WebSocket connected to MTOM AI');
      if (sessionId) {
        socket.emit('customer_join', { sessionId });
      }
    });

    socket.on('new_message', data => {
      if (data.sessionId === sessionId && data.message.role === 'assistant') {
        addMessage('assistant', data.message.content, data.message.id);
        hideTypingIndicator();
      }
    });

    socket.on('staff_joined', data => {
      addMessage('system', data.message);
    });

    socket.on('user_typing', data => {
      if (data.sessionId === sessionId && data.userId !== 'customer') {
        showTypingIndicator();
      }
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected from MTOM AI');
    });
  }

  async function startSession() {
    try {
      const response = await fetch(`${baseUrl}/api/widget/${widgetId}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        mode: 'cors',
        credentials: 'include',
        body: JSON.stringify({
          pageUrl: window.location.href,
          referrer: document.referrer,
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start session: ${response.status}`);
      }

      const data = await response.json();
      sessionId = data.sessionId;

      if (socket && socket.connected) {
        socket.emit('customer_join', { sessionId });
      }
    } catch (error) {
      console.error('Failed to start widget session:', error);
    }
  }

  async function sendMessage() {
    const input = document.getElementById('mtom-message-input');
    if (!input) {
      console.error('Message input not found');
      return;
    }

    const message = input.value.trim();

    if (!message) return;

    // Add user message to UI
    addMessage('user', message);
    input.value = '';

    // Increment message count
    messageCount++;

    try {
      // Send via WebSocket if available
      if (socket && socket.connected && sessionId) {
        console.log('📡 Sending message via WebSocket...', {
          sessionId,
          socketConnected: socket.connected,
        });
        socket.emit('send_message', {
          sessionId,
          message,
          role: 'customer',
        });
      } else {
        console.log('📡 WebSocket not available, using HTTP fallback...', {
          hasSocket: !!socket,
          socketConnected: socket?.connected,
          hasSessionId: !!sessionId,
        });
        // Fallback to HTTP API
        console.log('📡 Using HTTP fallback for message sending...');
        const response = await fetch(`${baseUrl}/api/chat/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          mode: 'cors',
          credentials: 'include',
          body: JSON.stringify({
            sessionId,
            message,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          addMessage('assistant', data.response);
          console.log('✅ HTTP response received:', data.response);
        } else {
          const errorText = await response.text();
          console.error('❌ HTTP API error:', response.status, errorText);
          addMessage('system', 'Sorry, there was an error sending your message. Please try again.');
        }
      }

      // Track message event
      trackEvent('message_sent', { message: message.substring(0, 100) });
    } catch (error) {
      console.error('Failed to send message:', error);
      addMessage('system', 'Sorry, there was an error sending your message. Please try again.');
    }
  }

  function addMessage(role, content, messageId = null) {
    const messagesContainer = document.getElementById('mtom-messages');
    if (!messagesContainer) {
      console.error('Messages container not found');
      return;
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `mtom-message mtom-message-${role}`;
    if (messageId) {
      messageDiv.setAttribute('data-message-id', messageId);
    }

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'mtom-message-bubble';
    bubbleDiv.textContent = content;

    messageDiv.appendChild(bubbleDiv);

    // Add feedback buttons for assistant messages
    if (role === 'assistant' && messageId) {
      const feedbackDiv = document.createElement('div');
      feedbackDiv.className = 'mtom-feedback-buttons';
      feedbackDiv.innerHTML = `
        <button class="mtom-feedback-btn positive" onclick="window.MTOMAIWidget.rateMessage('${messageId}', 'positive')" title="Helpful">
          👍
        </button>
        <button class="mtom-feedback-btn negative" onclick="window.MTOMAIWidget.rateMessage('${messageId}', 'negative')" title="Not helpful">
          👎
        </button>
      `;
      messageDiv.appendChild(feedbackDiv);
    }

    messagesContainer.appendChild(messageDiv);

    // Show email button and feedback button if there are messages
    const emailBtn = document.getElementById('mtom-email-button');
    const feedbackBtn = document.getElementById('mtom-feedback-button');
    if (emailBtn && messageCount > 0) {
      emailBtn.style.display = 'block';
    }
    if (feedbackBtn && messageCount > 0 && role === 'assistant') {
      feedbackBtn.style.display = 'block';
    }

    // Scroll to bottom
    const scrollContainer = document.getElementById('mtom-messages-container');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }

  function showTypingIndicator() {
    const indicator = document.getElementById('mtom-typing-indicator');
    const scrollContainer = document.getElementById('mtom-messages-container');

    if (indicator) indicator.style.display = 'block';
    if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }

  function hideTypingIndicator() {
    const indicator = document.getElementById('mtom-typing-indicator');
    if (indicator) indicator.style.display = 'none';
  }

  async function trackEvent(type, data = {}) {
    try {
      const response = await fetch(`${baseUrl}/api/widget/${widgetId}/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        mode: 'cors',
        credentials: 'include',
        body: JSON.stringify({
          type,
          data,
          pageUrl: window.location.href,
          sessionId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Event tracking failed for type ${type}: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.log('Event tracking failed:', error);
    }
  }

  function showEmailModal() {
    if (!sessionId || messageCount === 0) {
      addMessage('system', 'Please send at least one message before requesting a transcript.');
      return;
    }

    // Show email button if there are messages
    const emailBtn = document.getElementById('mtom-email-button');
    if (emailBtn && messageCount > 0) {
      emailBtn.style.display = 'block';
    }

    const modal = document.createElement('div');
    modal.id = 'mtom-email-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
      ">
        <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
          📧 Email Chat Transcript
        </h3>
        <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px;">
          We'll send a copy of this conversation to your email address.
        </p>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; color: #374151; font-size: 14px; font-weight: 500;">
            Your Name (optional)
          </label>
          <input type="text" id="mtom-email-name" placeholder="Enter your name" style="
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            outline: none;
            box-sizing: border-box;
          ">
        </div>
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 6px; color: #374151; font-size: 14px; font-weight: 500;">
            Email Address *
          </label>
          <input type="email" id="mtom-email-address" placeholder="Enter your email" required style="
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            outline: none;
            box-sizing: border-box;
          ">
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button id="mtom-email-cancel" style="
            padding: 8px 16px;
            border: 1px solid #d1d5db;
            background: white;
            color: #374151;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          ">Cancel</button>
          <button id="mtom-email-send" style="
            padding: 8px 16px;
            border: none;
            background: #3b82f6;
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          ">Send Transcript</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Bind modal events
    const emailInput = document.getElementById('mtom-email-address');
    const nameInput = document.getElementById('mtom-email-name');
    const cancelBtn = document.getElementById('mtom-email-cancel');
    const sendEmailBtn = document.getElementById('mtom-email-send');

    const closeModal = () => {
      document.body.removeChild(modal);
    };

    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal();
    });

    sendEmailBtn.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      const name = nameInput.value.trim();

      if (!email) {
        emailInput.style.borderColor = '#ef4444';
        return;
      }

      sendEmailBtn.textContent = 'Sending...';
      sendEmailBtn.disabled = true;

      try {
        const response = await fetch(`${baseUrl}/api/chat/session/${sessionId}/email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          mode: 'cors',
          credentials: 'include',
          body: JSON.stringify({
            recipientEmail: email,
            recipientName: name || undefined,
          }),
        });

        if (response.ok) {
          addMessage('system', `✅ Transcript sent to ${email}`);
          closeModal();
          trackEvent('transcript_email_sent', { email });
        } else {
          const errorData = await response.json();
          addMessage(
            'system',
            `❌ Failed to send transcript: ${errorData.error || 'Unknown error'}`,
          );
        }
      } catch (error) {
        console.error('Email send error:', error);
        addMessage('system', '❌ Failed to send transcript. Please try again.');
      } finally {
        sendEmailBtn.textContent = 'Send Transcript';
        sendEmailBtn.disabled = false;
      }
    });

    emailInput.focus();
  }

  function showSessionFeedbackModal() {
    if (!sessionId || messageCount === 0) {
      addMessage('system', 'Please send at least one message before providing feedback.');
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'mtom-feedback-modal';
    modal.className = 'mtom-feedback-modal';

    modal.innerHTML = `
      <div class="mtom-feedback-content">
        <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px; font-weight: 600; text-align: center;">
          ⭐ Rate Your Experience
        </h3>
        <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px; text-align: center;">
          Help us improve by sharing your feedback about this conversation.
        </p>
        
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; color: #374151; font-size: 14px; font-weight: 500; text-align: center;">
            Overall Experience
          </label>
          <div class="mtom-rating-stars" id="mtom-overall-rating">
            <span class="mtom-rating-star" data-rating="1">⭐</span>
            <span class="mtom-rating-star" data-rating="2">⭐</span>
            <span class="mtom-rating-star" data-rating="3">⭐</span>
            <span class="mtom-rating-star" data-rating="4">⭐</span>
            <span class="mtom-rating-star" data-rating="5">⭐</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
          <div>
            <label style="display: block; margin-bottom: 6px; color: #374151; font-size: 12px; font-weight: 500;">
              Responsiveness
            </label>
            <div class="mtom-rating-stars" id="mtom-responsiveness-rating">
              <span class="mtom-rating-star" data-rating="1">⭐</span>
              <span class="mtom-rating-star" data-rating="2">⭐</span>
              <span class="mtom-rating-star" data-rating="3">⭐</span>
              <span class="mtom-rating-star" data-rating="4">⭐</span>
              <span class="mtom-rating-star" data-rating="5">⭐</span>
            </div>
          </div>
          <div>
            <label style="display: block; margin-bottom: 6px; color: #374151; font-size: 12px; font-weight: 500;">
              Helpfulness
            </label>
            <div class="mtom-rating-stars" id="mtom-helpfulness-rating">
              <span class="mtom-rating-star" data-rating="1">⭐</span>
              <span class="mtom-rating-star" data-rating="2">⭐</span>
              <span class="mtom-rating-star" data-rating="3">⭐</span>
              <span class="mtom-rating-star" data-rating="4">⭐</span>
              <span class="mtom-rating-star" data-rating="5">⭐</span>
            </div>
          </div>
          <div>
            <label style="display: block; margin-bottom: 6px; color: #374151; font-size: 12px; font-weight: 500;">
              Accuracy
            </label>
            <div class="mtom-rating-stars" id="mtom-accuracy-rating">
              <span class="mtom-rating-star" data-rating="1">⭐</span>
              <span class="mtom-rating-star" data-rating="2">⭐</span>
              <span class="mtom-rating-star" data-rating="3">⭐</span>
              <span class="mtom-rating-star" data-rating="4">⭐</span>
              <span class="mtom-rating-star" data-rating="5">⭐</span>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 6px; color: #374151; font-size: 14px; font-weight: 500;">
            Additional Comments
          </label>
          <textarea id="mtom-feedback-text" placeholder="Share your thoughts, suggestions, or what we could improve..." style="
            width: 100%;
            min-height: 80px;
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            font-family: inherit;
            outline: none;
            resize: vertical;
            box-sizing: border-box;
          "></textarea>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button id="mtom-feedback-cancel" style="
            padding: 8px 16px;
            border: 1px solid #d1d5db;
            background: white;
            color: #374151;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          ">Cancel</button>
          <button id="mtom-feedback-submit" style="
            padding: 8px 16px;
            border: none;
            background: #3b82f6;
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          ">Submit Feedback</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Rating state
    const ratings = {
      overall: 0,
      responsiveness: 0,
      helpfulness: 0,
      accuracy: 0,
    };

    // Setup rating stars
    ['overall', 'responsiveness', 'helpfulness', 'accuracy'].forEach(category => {
      const container = document.getElementById(`mtom-${category}-rating`);
      const stars = container.querySelectorAll('.mtom-rating-star');

      stars.forEach((star, index) => {
        star.addEventListener('click', () => {
          const rating = parseInt(star.dataset.rating);
          ratings[category] = rating;

          // Update visual state
          stars.forEach((s, i) => {
            s.classList.toggle('active', i < rating);
          });
        });

        star.addEventListener('mouseenter', () => {
          const rating = parseInt(star.dataset.rating);
          stars.forEach((s, i) => {
            s.classList.toggle('active', i < rating);
          });
        });
      });

      container.addEventListener('mouseleave', () => {
        const currentRating = ratings[category];
        stars.forEach((s, i) => {
          s.classList.toggle('active', i < currentRating);
        });
      });
    });

    // Modal events
    const cancelBtn = document.getElementById('mtom-feedback-cancel');
    const submitBtn = document.getElementById('mtom-feedback-submit');
    const feedbackText = document.getElementById('mtom-feedback-text');

    const closeModal = () => {
      document.body.removeChild(modal);
    };

    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal();
    });

    submitBtn.addEventListener('click', async () => {
      // Validate ratings
      if (ratings.overall === 0) {
        alert('Please provide an overall rating');
        return;
      }

      const feedback = feedbackText.value.trim();
      if (!feedback) {
        alert('Please provide some feedback');
        return;
      }

      submitBtn.textContent = 'Submitting...';
      submitBtn.disabled = true;

      try {
        const response = await fetch(`${baseUrl}/api/feedback/session/feedback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          mode: 'cors',
          credentials: 'include',
          body: JSON.stringify({
            sessionId,
            overallRating: ratings.overall,
            feedback,
            categories: {
              responsiveness: ratings.responsiveness || ratings.overall,
              helpfulness: ratings.helpfulness || ratings.overall,
              accuracy: ratings.accuracy || ratings.overall,
              overall: ratings.overall,
            },
          }),
        });

        if (response.ok) {
          addMessage('system', '✅ Thank you for your feedback! It helps us improve.');
          closeModal();
          trackEvent('feedback_submitted', {
            overallRating: ratings.overall,
            hasDetailedRatings:
              ratings.responsiveness > 0 || ratings.helpfulness > 0 || ratings.accuracy > 0,
          });
        } else {
          const errorData = await response.json();
          addMessage(
            'system',
            `❌ Failed to submit feedback: ${errorData.error || 'Unknown error'}`,
          );
        }
      } catch (error) {
        console.error('Feedback submit error:', error);
        addMessage('system', '❌ Failed to submit feedback. Please try again.');
      } finally {
        submitBtn.textContent = 'Submit Feedback';
        submitBtn.disabled = false;
      }
    });
  }

  // Load Socket.IO
  function loadSocketIO() {
    return new Promise((resolve, reject) => {
      if (window.io) {
        console.log('🔌 Socket.IO already loaded');
        resolve();
        return;
      }

      console.log('📦 Loading Socket.IO...');
      const script = document.createElement('script');
      script.src = `${baseUrl}/socket.io/socket.io.js`;
      script.onload = () => {
        console.log('✅ Socket.IO loaded successfully');
        resolve();
      };
      script.onerror = error => {
        console.warn('⚠️ Socket.IO failed to load, continuing without WebSocket support:', error);
        // Don't reject, just resolve without Socket.IO
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      await loadSocketIO();
      await initWidget();
    });
  } else {
    // DOM is already ready
    (async () => {
      await loadSocketIO();
      await initWidget();
    })();
  }

  // Export widget API immediately (before initialization)
  window.MTOMAIWidget = {
    open: () => {
      console.log('🎯 Widget open requested');
      if (!window.MTOMAIWidgetReady) {
        console.error('❌ Widget not ready - cannot open. Use MTOMAIWidget.debug() for details.');
        return false;
      }
      if (!isOpen) {
        toggleWidget();
        return true;
      }
      console.log('ℹ️ Widget is already open');
      return true;
    },
    close: () => {
      console.log('🎯 Widget close requested');
      if (!window.MTOMAIWidgetReady) {
        console.error('❌ Widget not ready - cannot close. Use MTOMAIWidget.debug() for details.');
        return false;
      }
      if (isOpen) {
        toggleWidget();
        return true;
      }
      console.log('ℹ️ Widget is already closed');
      return true;
    },
    sendMessage: message => {
      console.log('🎯 Send message requested:', message);
      if (!window.MTOMAIWidgetReady) {
        console.error(
          '❌ Widget not ready - cannot send message. Use MTOMAIWidget.debug() for details.',
        );
        return false;
      }
      const input = document.getElementById('mtom-message-input');
      if (input) {
        input.value = message;
        sendMessage();
        return true;
      } else {
        console.error('❌ Message input not found');
        return false;
      }
    },
    getSessionId: () => sessionId,
    isOpen: () => isOpen,
    isReady: () => {
      return window.MTOMAIWidgetReady || false;
    },

    // Feedback methods
    rateMessage: async (messageId, rating) => {
      console.log('👍 Rating message:', messageId, rating);
      if (!window.MTOMAIWidgetReady) {
        console.error('❌ Widget not ready - cannot rate message');
        return false;
      }

      try {
        const response = await fetch(`${baseUrl}/api/feedback/message/rate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          mode: 'cors',
          credentials: 'include',
          body: JSON.stringify({
            messageId,
            sessionId,
            rating,
          }),
        });

        if (response.ok) {
          // Update UI to show rated state
          const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
          if (messageElement) {
            const buttons = messageElement.querySelectorAll('.mtom-feedback-btn');
            buttons.forEach(btn => {
              btn.classList.remove('rated');
              if (btn.classList.contains(rating)) {
                btn.classList.add('rated');
              }
            });
          }
          console.log('✅ Message rated successfully');
          return true;
        } else {
          const error = await response.text();
          console.error('❌ Failed to rate message:', error);
          return false;
        }
      } catch (error) {
        console.error('❌ Error rating message:', error);
        return false;
      }
    },

    showFeedbackModal: () => {
      console.log('📝 Showing feedback modal');
      if (!window.MTOMAIWidgetReady) {
        console.error('❌ Widget not ready - cannot show feedback modal');
        return false;
      }

      if (!sessionId || messageCount === 0) {
        addMessage('system', 'Please send at least one message before providing feedback.');
        return false;
      }

      showSessionFeedbackModal();
      return true;
    },

    debug: () => {
      const debugInfo = {
        ready: window.MTOMAIWidgetReady || false,
        isOpen,
        sessionId,
        config,
        elements: {
          button: !!document.getElementById('mtom-widget-button'),
          panel: !!document.getElementById('mtom-widget-panel'),
          input: !!document.getElementById('mtom-message-input'),
          header: !!document.getElementById('mtom-widget-header'),
          messages: !!document.getElementById('mtom-messages'),
        },
        socketConnected: socket && socket.connected,
        widgetId,
        baseUrl,
        userAgent: navigator.userAgent,
        pageUrl: window.location.href,
      };
      console.log('🔍 Widget Debug Info:', debugInfo);
      return debugInfo;
    },
  };
})();
