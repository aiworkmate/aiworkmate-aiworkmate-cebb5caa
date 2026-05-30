const MAX_RENDERED_MESSAGES = 160;

const state = {
  user: null,
  csrfToken: null,
  config: {},
  mode: 'general',
  conversationId: null,
  conversationPromise: null,
  conversations: [],
  uploadIds: [],
  uploads: [],
  streaming: false,
  authMode: 'register',
  metrics: null,
  streamController: null,
  streamDraft: '',
  streamFrame: null,
  currentAssistant: null,
  realtimeTimer: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const els = {
  authView: $('#authView'),
  app: $('#app'),
  authForm: $('#authForm'),
  authSwitch: $('#authSwitch'),
  authError: $('#authError'),
  nameField: $('#nameField'),
  messageList: $('#messageList'),
  composer: $('#composer'),
  promptInput: $('#promptInput'),
  fileInput: $('#fileInput'),
  attachButton: $('#attachButton'),
  uploadViewButton: $('#uploadViewButton'),
  uploadDrop: $('#uploadDrop'),
  uploadList: $('#uploadList'),
  attachedFiles: $('#attachedFiles'),
  contextFeed: $('#contextFeed'),
  conversationList: $('#conversationList'),
  toolCount: $('#toolCount'),
  fileCount: $('#fileCount'),
  recallCount: $('#recallCount'),
  liveToggle: $('#liveToggle'),
  memoryToggle: $('#memoryToggle'),
  liveStatus: $('#liveStatus'),
  memoryStatus: $('#memoryStatus'),
  providerStatus: $('#providerStatus'),
  toast: $('#toast'),
  memoryForm: $('#memoryForm'),
  memoryInput: $('#memoryInput'),
  memoryList: $('#memoryList'),
  dashboardCards: $('#dashboardCards'),
  activityBars: $('#activityBars'),
  adminSummary: $('#adminSummary'),
  auditList: $('#auditList'),
  settingsForm: $('#settingsForm'),
  settingsName: $('#settingsName'),
  settingsMode: $('#settingsMode'),
  settingsTheme: $('#settingsTheme'),
  themeButton: $('#themeButton'),
  voiceButton: $('#voiceButton'),
  mobileMenu: $('#mobileMenu'),
  sendButton: $('.send-button')
};

boot();

async function boot() {
  bindEvents();
  applyTheme(localStorage.getItem('wm_theme') || 'system');
  try {
    const session = await api('/api/session');
    applySession(session);
  } catch (error) {
    showAuth();
  }
}

function bindEvents() {
  els.authForm.addEventListener('submit', onAuth);
  els.authSwitch.addEventListener('click', toggleAuthMode);
  els.composer.addEventListener('submit', onSend);
  els.promptInput.addEventListener('input', autoSizePrompt);
  els.promptInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      els.composer.requestSubmit();
    }
  });
  els.attachButton.addEventListener('click', () => els.fileInput.click());
  els.uploadViewButton.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', () => handleFiles([...els.fileInput.files]));
  els.uploadDrop.addEventListener('click', () => els.fileInput.click());
  els.uploadDrop.addEventListener('dragover', (event) => {
    event.preventDefault();
    els.uploadDrop.classList.add('dragging');
  });
  els.uploadDrop.addEventListener('dragleave', () => els.uploadDrop.classList.remove('dragging'));
  els.uploadDrop.addEventListener('drop', (event) => {
    event.preventDefault();
    els.uploadDrop.classList.remove('dragging');
    handleFiles([...event.dataTransfer.files]);
  });
  els.memoryForm.addEventListener('submit', saveManualMemory);
  els.settingsForm.addEventListener('submit', saveSettings);
  $('#logoutButton').addEventListener('click', logout);
  $('#newChatButton').addEventListener('click', () => createConversationOptimistic());
  $('#refreshMetrics').addEventListener('click', loadMetrics);
  $('#refreshAdmin').addEventListener('click', loadAdmin);
  $('#refreshMemory').addEventListener('click', loadMemory);
  els.themeButton.addEventListener('click', cycleTheme);
  els.voiceButton.addEventListener('click', voiceInput);
  els.mobileMenu.addEventListener('click', () => $('.sidebar').classList.toggle('open'));
  els.liveToggle.addEventListener('change', refreshStatusChips);
  els.memoryToggle.addEventListener('change', refreshStatusChips);
  $$('.nav-item').forEach((button) => button.addEventListener('click', () => openView(button.dataset.view)));
  $$('.mode-button').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(state.csrfToken ? { 'x-csrf-token': state.csrfToken } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function applySession(session) {
  state.user = session.user;
  state.csrfToken = session.csrfToken;
  state.config = session.config || {};
  if (!state.user) return showAuth();
  els.authView.hidden = true;
  els.app.hidden = false;
  els.providerStatus.textContent = state.config.aiConfigured ? 'AI provider ready' : 'Local core';
  $('#uploadLimit').textContent = `Limit ${Math.round((state.config.maxUploadBytes || 0) / 1024 / 1024)} MB per file`;
  hydrateSettings();
  setMode(state.user.settings?.defaultMode || 'general');
  els.liveToggle.checked = state.user.settings?.liveData !== false;
  els.memoryToggle.checked = state.user.settings?.memory !== false;
  refreshStatusChips();
  initialChat();
  Promise.allSettled([loadUploads(), loadConversations(), loadMemory(), loadMetrics()]);
  startRealtimeRefresh();
}

function showAuth() {
  stopRealtimeRefresh();
  els.authView.hidden = false;
  els.app.hidden = true;
}

async function onAuth(event) {
  event.preventDefault();
  els.authError.textContent = '';
  const data = new FormData(els.authForm);
  const payload = {
    name: data.get('name'),
    email: data.get('email'),
    password: data.get('password')
  };
  try {
    const session = await api(state.authMode === 'register' ? '/api/auth/register' : '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    applySession(session);
  } catch (error) {
    els.authError.textContent = error.message;
  }
}

function toggleAuthMode() {
  state.authMode = state.authMode === 'register' ? 'login' : 'register';
  els.nameField.hidden = state.authMode === 'login';
  els.authForm.querySelector('button').textContent = state.authMode === 'register' ? 'Create Secure Workspace' : 'Sign In';
  els.authSwitch.textContent = state.authMode === 'register' ? 'Use Existing Account' : 'Create New Workspace';
  els.authError.textContent = '';
}

async function logout() {
  stopActiveStream();
  stopRealtimeRefresh();
  await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => {});
  state.user = null;
  state.csrfToken = null;
  state.conversationId = null;
  showAuth();
}

function initialChat() {
  els.messageList.innerHTML = '';
  addMessage('assistant', 'AI WorkMate is online. Live tools, memory, file understanding, and medical assistive mode are ready.');
  resetContext('Ready');
}

function createConversationOptimistic(title = 'New conversation') {
  if (state.conversationPromise && state.conversationId?.startsWith('temp_')) return state.conversationPromise;
  stopActiveStream();
  const tempId = `temp_${Date.now()}`;
  const optimistic = {
    id: tempId,
    title,
    mode: state.mode,
    messageCount: 0,
    updatedAt: new Date().toISOString(),
    optimistic: true
  };
  state.conversationId = tempId;
  state.uploadIds = [];
  state.conversations = [optimistic, ...state.conversations.filter((item) => item.id !== tempId)];
  renderAttachedFiles();
  initialChat();
  renderConversations();
  focusPrompt();

  const request = (async () => {
    try {
      const result = await api('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ title, mode: state.mode })
      });
      state.conversationId = result.conversation.id;
      state.conversations = [
        { ...result.conversation, messageCount: 0 },
        ...state.conversations.filter((item) => item.id !== tempId && item.id !== result.conversation.id)
      ];
      renderConversations();
      focusPrompt();
      return result.conversation.id;
    } catch (error) {
      toast(`New chat will start locally: ${error.message}`);
      return null;
    } finally {
      if (state.conversationPromise === request) state.conversationPromise = null;
    }
  })();
  state.conversationPromise = request;
  return request;
}

async function ensureConversation(title) {
  if (state.conversationId && !state.conversationId.startsWith('temp_')) return state.conversationId;
  if (state.conversationPromise) return await state.conversationPromise;
  const created = await createConversationOptimistic(title || 'New conversation');
  return created || null;
}

function stopActiveStream() {
  if (state.streamController) state.streamController.abort();
  state.streamController = null;
  state.streaming = false;
  state.currentAssistant = null;
  setComposerBusy(false);
}

async function onSend(event) {
  event.preventDefault();
  if (state.streaming) {
    stopActiveStream();
    toast('Response stopped');
    return;
  }

  const message = els.promptInput.value.trim();
  if (!message) return;
  const conversationId = await ensureConversation(titleFromMessage(message));
  state.streaming = true;
  state.streamController = new AbortController();
  state.streamDraft = '';
  els.promptInput.value = '';
  autoSizePrompt();
  addMessage('user', message);
  state.currentAssistant = addMessage('assistant', '');
  setComposerBusy(true);
  resetContext('Thinking');

  try {
    await streamChat({
      message,
      conversationId,
      mode: state.mode,
      uploadIds: state.uploadIds,
      enableLive: els.liveToggle.checked,
      enableMemory: els.memoryToggle.checked
    });
    await Promise.allSettled([loadConversations(), loadMemory(), loadMetrics()]);
  } catch (error) {
    if (error.name === 'AbortError') return;
    state.currentAssistant.content.textContent = `Request failed: ${error.message}`;
    toast(error.message);
  } finally {
    flushStreamDraft();
    state.streaming = false;
    state.streamController = null;
    state.currentAssistant = null;
    setComposerBusy(false);
    focusPrompt();
  }
}

async function streamChat(payload) {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    credentials: 'same-origin',
    signal: state.streamController.signal,
    headers: {
      'content-type': 'application/json',
      ...(state.csrfToken ? { 'x-csrf-token': state.csrfToken } : {})
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Stream failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      handleSseBlock(block);
    }
  }
}

function handleSseBlock(block) {
  let event = 'message';
  const data = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) data.push(line.slice(5).trim());
  }
  const payload = data.length ? JSON.parse(data.join('\n')) : {};

  if (event === 'meta') {
    renderContext(payload);
    return;
  }
  if (event === 'token') {
    queueAssistantText(payload.text || '');
    return;
  }
  if (event === 'done') {
    if (payload.conversationId) state.conversationId = payload.conversationId;
    renderContext({ ...payload, phase: 'Answer ready' });
    return;
  }
  if (event === 'error') {
    throw new Error(payload.error || 'Stream error');
  }
}

function queueAssistantText(text) {
  state.streamDraft += text;
  if (!state.streamFrame) {
    state.streamFrame = requestAnimationFrame(flushStreamDraft);
  }
}

function flushStreamDraft() {
  if (state.streamFrame) cancelAnimationFrame(state.streamFrame);
  state.streamFrame = null;
  if (!state.currentAssistant) return;
  state.currentAssistant.content.textContent = state.streamDraft;
  if (state.streaming) state.currentAssistant.content.classList.add('streaming-cursor');
  scrollMessages();
}

function addMessage(role, content) {
  const item = document.createElement('article');
  item.className = `message ${role}`;
  const label = document.createElement('div');
  label.className = 'role';
  label.textContent = role === 'user' ? 'You' : 'AI WorkMate';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = content;
  item.append(label, bubble);
  els.messageList.append(item);
  compactMessageDom();
  scrollMessages();
  return { item, content: bubble };
}

function compactMessageDom() {
  const messages = Array.from(els.messageList.querySelectorAll('.message'));
  const overflow = messages.length - MAX_RENDERED_MESSAGES;
  if (overflow <= 0) return;
  messages.slice(0, overflow).forEach((item) => item.remove());
  let marker = els.messageList.querySelector('.virtual-marker');
  if (!marker) {
    marker = document.createElement('div');
    marker.className = 'virtual-marker';
    els.messageList.prepend(marker);
  }
  marker.textContent = `${overflow} older messages are collapsed to keep this chat fast.`;
}

function scrollMessages() {
  els.messageList.scrollTop = els.messageList.scrollHeight;
}

function setComposerBusy(isBusy) {
  els.promptInput.disabled = isBusy;
  els.attachButton.disabled = isBusy;
  els.voiceButton.disabled = isBusy;
  els.sendButton.disabled = false;
  els.sendButton.classList.toggle('is-stop', isBusy);
  els.sendButton.setAttribute('aria-label', isBusy ? 'Stop response' : 'Send');
  els.sendButton.innerHTML = isBusy
    ? '<svg><use href="#i-close"></use></svg>'
    : '<svg><use href="#i-send"></use></svg>';
}

function autoSizePrompt() {
  els.promptInput.style.height = 'auto';
  els.promptInput.style.height = `${Math.min(180, Math.max(44, els.promptInput.scrollHeight))}px`;
}

function focusPrompt() {
  setTimeout(() => els.promptInput.focus(), 60);
}

async function handleFiles(files) {
  for (const file of files) {
    if (state.config.maxUploadBytes && file.size > state.config.maxUploadBytes) {
      toast(`${file.name} exceeds the upload limit.`);
      continue;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await api('/api/uploads', {
        method: 'POST',
        body: JSON.stringify({ name: file.name, type: file.type || 'application/octet-stream', dataUrl })
      });
      state.uploads.unshift(result.upload);
      state.uploadIds.push(result.upload.id);
      toast(`Uploaded ${file.name}`);
    } catch (error) {
      toast(error.message);
    }
  }
  renderUploads();
  renderAttachedFiles();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function loadUploads() {
  const data = await api('/api/uploads');
  state.uploads = data.uploads || [];
  renderUploads();
}

function renderUploads() {
  els.uploadList.innerHTML = state.uploads.map((item) => `
    <div class="list-item">
      <strong>${escapeHtml(item.name)}</strong>
      <p>${escapeHtml(item.summary || '')}</p>
      <span class="chip">${escapeHtml(item.mime)} <strong>${formatBytes(item.size)}</strong></span>
    </div>
  `).join('') || emptyItem('No files yet');
}

function renderAttachedFiles() {
  const attached = state.uploads.filter((item) => state.uploadIds.includes(item.id));
  els.fileCount.textContent = attached.length;
  els.attachedFiles.innerHTML = attached.map((item) => `
    <span class="chip"><strong>${escapeHtml(item.name)}</strong><button class="chip-x" data-remove-upload="${item.id}" type="button" aria-label="Remove file"><svg><use href="#i-close"></use></svg></button></span>
  `).join('');
  els.attachedFiles.querySelectorAll('[data-remove-upload]').forEach((button) => {
    button.addEventListener('click', () => {
      state.uploadIds = state.uploadIds.filter((id) => id !== button.dataset.removeUpload);
      renderAttachedFiles();
    });
  });
}

async function loadConversations() {
  const data = await api('/api/conversations');
  const remote = data.conversations || [];
  const optimistic = state.conversations.filter((item) => item.optimistic && !remote.some((row) => row.id === item.id));
  state.conversations = [...optimistic, ...remote];
  renderConversations();
}

function renderConversations() {
  els.conversationList.innerHTML = state.conversations.slice(0, 14).map((item) => `
    <div class="list-item ${item.id === state.conversationId ? 'active-conversation' : ''}" data-conv="${item.id}">
      <strong>${escapeHtml(item.optimistic ? 'Creating new chat...' : item.title)}</strong>
      <p>${escapeHtml(item.messageCount ?? 0)} messages / ${escapeHtml(item.mode || state.mode)}</p>
    </div>
  `).join('') || emptyItem('No conversations yet');
  els.conversationList.querySelectorAll('[data-conv]').forEach((item) => {
    item.addEventListener('click', () => loadConversation(item.dataset.conv));
  });
}

async function loadConversation(id) {
  if (id.startsWith('temp_')) return;
  const data = await api(`/api/conversations/${id}`);
  state.conversationId = id;
  els.messageList.innerHTML = '';
  const messages = data.messages || [];
  if (messages.length > MAX_RENDERED_MESSAGES) {
    const marker = document.createElement('div');
    marker.className = 'virtual-marker';
    marker.textContent = `${messages.length - MAX_RENDERED_MESSAGES} older messages are collapsed to keep this chat fast.`;
    els.messageList.append(marker);
  }
  for (const message of messages.slice(-MAX_RENDERED_MESSAGES)) addMessage(message.role, message.content);
  renderConversations();
  openView('chat');
  focusPrompt();
}

async function loadMemory() {
  const data = await api('/api/memory');
  renderMemory(data.memories || []);
}

function renderMemory(memories) {
  els.memoryList.innerHTML = memories.map((item) => `
    <div class="list-item">
      <strong>${escapeHtml(item.kind || 'memory')}</strong>
      <p>${escapeHtml(item.content)}</p>
      <span class="chip">${escapeHtml(new Date(item.createdAt).toLocaleString())}</span>
    </div>
  `).join('') || emptyItem('No saved memory yet');
}

async function saveManualMemory(event) {
  event.preventDefault();
  const content = els.memoryInput.value.trim();
  if (!content) return;
  await api('/api/memory', { method: 'POST', body: JSON.stringify({ content, kind: 'manual' }) });
  els.memoryInput.value = '';
  await loadMemory();
}

async function loadMetrics() {
  try {
    const data = await api('/api/admin/metrics');
    state.metrics = data.summary;
    renderDashboard(data.summary);
  } catch {
    renderDashboard({ totalEvents: 0, averageLatencyMs: 0, errorRate: 0, tokensEstimated: 0, byTool: {}, byMode: {} });
  }
}

async function loadAdmin() {
  try {
    const [metrics, audit] = await Promise.all([api('/api/admin/metrics'), api('/api/admin/audit')]);
    renderAdmin(metrics.summary, audit.audit || []);
  } catch (error) {
    els.adminSummary.innerHTML = emptyItem(error.message);
    els.auditList.innerHTML = '';
  }
}

function renderDashboard(summary) {
  els.dashboardCards.innerHTML = cards([
    ['Events', summary.totalEvents || 0],
    ['Avg Latency', `${summary.averageLatencyMs || 0} ms`],
    ['Error Rate', `${Math.round((summary.errorRate || 0) * 100)}%`],
    ['Tokens', summary.tokensEstimated || 0],
    ['Live Tools', Object.values(summary.byTool || {}).reduce((a, b) => a + b, 0)],
    ['Medical Mode', summary.byMode?.medical || 0]
  ]);
  renderBars(els.activityBars, summary.byTool || {});
}

function renderAdmin(summary, audit) {
  els.adminSummary.innerHTML = cards([
    ['Events', summary.totalEvents || 0],
    ['Latency', `${summary.averageLatencyMs || 0} ms`],
    ['Errors', `${Math.round((summary.errorRate || 0) * 100)}%`]
  ]);
  els.auditList.innerHTML = audit.map((item) => `
    <div class="list-item">
      <strong>${escapeHtml(item.type)}</strong>
      <p>${escapeHtml(item.status)} / ${escapeHtml(new Date(item.at).toLocaleString())}</p>
    </div>
  `).join('') || emptyItem('No audit events');
}

function cards(items) {
  return items.map(([label, value]) => `<div class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
}

function renderBars(target, values) {
  const entries = Object.entries(values);
  const max = Math.max(1, ...entries.map(([, value]) => value));
  target.innerHTML = entries.map(([label, value]) => `
    <div class="bar-row"><span>${escapeHtml(label)}</span><div class="bar"><span data-width="${Math.max(8, (value / max) * 100)}"></span></div><strong>${value}</strong></div>
  `).join('') || emptyItem('No tool activity yet');
  target.querySelectorAll('[data-width]').forEach((item) => {
    item.style.width = `${item.dataset.width}%`;
  });
}

function renderContext(meta = {}) {
  els.toolCount.textContent = String(meta.toolCount ?? 0);
  els.recallCount.textContent = String(meta.memoryCount ?? 0);
  els.fileCount.textContent = String(meta.uploadCount ?? state.uploadIds.length);
  els.contextFeed.innerHTML = `
    <div class="feed-item"><strong>${escapeHtml(meta.phase || 'Answer ready')}</strong><p>Streaming response, bounded context, and memory routing are active.</p></div>
    <div class="feed-item"><strong>Priority context</strong><p>Project state, pinned memory, recent turns, summaries.</p></div>
  `;
}

function resetContext(label = 'Preparing answer') {
  els.toolCount.textContent = '0';
  els.recallCount.textContent = '0';
  els.fileCount.textContent = String(state.uploadIds.length);
  els.contextFeed.innerHTML = `<div class="feed-item live-feed"><strong>${escapeHtml(label)}</strong><p>Memory, files, and tools are being assembled.</p></div>`;
}

function openView(name) {
  $$('.view').forEach((view) => view.classList.remove('active-view'));
  $(`#${name}View`).classList.add('active-view');
  $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
  $('.sidebar').classList.remove('open');
  if (name === 'admin') loadAdmin();
  if (name === 'dashboard') loadMetrics();
  if (name === 'uploads') loadUploads();
  if (name === 'memory') loadMemory();
}

function setMode(mode) {
  state.mode = mode;
  $$('.mode-button').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
}

function refreshStatusChips() {
  els.liveStatus.textContent = els.liveToggle.checked ? 'Ready' : 'Off';
  els.memoryStatus.textContent = els.memoryToggle.checked ? 'On' : 'Off';
}

function hydrateSettings() {
  els.settingsName.value = state.user?.name || '';
  els.settingsMode.value = state.user?.settings?.defaultMode || 'general';
  els.settingsTheme.value = state.user?.settings?.theme || localStorage.getItem('wm_theme') || 'system';
}

async function saveSettings(event) {
  event.preventDefault();
  const theme = els.settingsTheme.value;
  const result = await api('/api/account', {
    method: 'PUT',
    body: JSON.stringify({
      name: els.settingsName.value,
      settings: {
        defaultMode: els.settingsMode.value,
        theme,
        liveData: els.liveToggle.checked,
        memory: els.memoryToggle.checked
      }
    })
  });
  state.user = result.user;
  localStorage.setItem('wm_theme', theme);
  applyTheme(theme);
  setMode(els.settingsMode.value);
  toast('Settings saved');
}

function applyTheme(theme) {
  const effective = theme === 'system'
    ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : theme;
  document.documentElement.dataset.theme = effective;
}

function cycleTheme() {
  const current = localStorage.getItem('wm_theme') || 'system';
  const next = current === 'system' ? 'dark' : current === 'dark' ? 'light' : 'system';
  localStorage.setItem('wm_theme', next);
  applyTheme(next);
  els.settingsTheme.value = next;
}

function voiceInput() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return toast('Voice input is not available in this browser.');
  const recognition = new Recognition();
  recognition.lang = navigator.language || 'en-US';
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    els.promptInput.value = event.results[0][0].transcript;
    autoSizePrompt();
  };
  recognition.onerror = () => toast('Voice input stopped.');
  recognition.start();
}

function startRealtimeRefresh() {
  stopRealtimeRefresh();
  state.realtimeTimer = setInterval(() => {
    if (!state.user || state.streaming || document.hidden) return;
    Promise.allSettled([loadConversations(), loadMemory(), loadMetrics()]);
  }, 12_000);
}

function stopRealtimeRefresh() {
  if (state.realtimeTimer) clearInterval(state.realtimeTimer);
  state.realtimeTimer = null;
}

function titleFromMessage(message) {
  return message.length > 58 ? `${message.slice(0, 58)}...` : message || 'New conversation';
}

function emptyItem(text) {
  return `<div class="list-item"><p>${escapeHtml(text)}</p></div>`;
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    els.toast.hidden = true;
  }, 3500);
}
