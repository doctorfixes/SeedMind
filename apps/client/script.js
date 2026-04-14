/* global ORCHESTRATOR_URL */
'use strict';

// ─── Configuration ────────────────────────────────────────────────────────────
// ORCHESTRATOR_URL defaults to /ask on the same Vercel deployment (unified
// monorepo). Override by setting window.ORCHESTRATOR_URL before this script
// loads (e.g. for a standalone orchestrator deployment).
const ORCHESTRATOR_URL =
  (typeof window !== 'undefined' && window.ORCHESTRATOR_URL) ||
  '/ask';

const MAX_MESSAGE_LENGTH = 4000;
const CHAR_WARN_THRESHOLD = 3600;
const CHAR_DANGER_THRESHOLD = 3900;

// ─── Persistent user ID ───────────────────────────────────────────────────────
function getUserId() {
  let id = localStorage.getItem('seedmind_user_id');
  if (!id) {
    id = 'u_' + crypto.randomUUID().replace(/-/g, '');
    localStorage.setItem('seedmind_user_id', id);
  }
  return id;
}

// ─── DOM helpers ─────────────────────────────────────────────────────────────
const chatWindow = document.getElementById('chatWindow');
const inputForm  = document.getElementById('inputForm');
const userInput  = document.getElementById('userInput');
const sendBtn    = document.getElementById('sendBtn');
const charCount  = document.getElementById('charCount');

function appendMessage(role, text, isTyping = false) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${role}`;
  wrapper.setAttribute('role', 'listitem');

  const bubble = document.createElement('span');
  bubble.className = 'bubble' + (isTyping ? ' typing' : '');

  if (isTyping) {
    bubble.setAttribute('aria-label', 'SeedMind is thinking…');
  } else if (role === 'user') {
    bubble.textContent = text;
    bubble.setAttribute('aria-label', `You: ${text}`);
  } else {
    bubble.textContent = text;
    bubble.setAttribute('aria-label', `SeedMind: ${text}`);
  }

  wrapper.appendChild(bubble);
  chatWindow.appendChild(wrapper);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return bubble;
}

function setErrorBubble(bubble, message) {
  bubble.classList.remove('typing');
  bubble.classList.add('error');
  bubble.textContent = message;
  bubble.setAttribute('aria-label', `Error: ${message}`);
}

// ─── Character counter ────────────────────────────────────────────────────────
function updateCharCount() {
  const len = userInput.value.length;
  if (len === 0) {
    charCount.textContent = '';
    charCount.className = 'char-count';
    return;
  }
  const remaining = MAX_MESSAGE_LENGTH - len;
  charCount.textContent = `${remaining} characters remaining`;

  if (len >= CHAR_DANGER_THRESHOLD) {
    charCount.className = 'char-count danger';
  } else if (len >= CHAR_WARN_THRESHOLD) {
    charCount.className = 'char-count warning';
  } else {
    charCount.className = 'char-count';
  }
}

// ─── Submit handler ───────────────────────────────────────────────────────────
inputForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const message = userInput.value.trim();
  if (!message) return;

  // Show user message
  appendMessage('user', message);
  userInput.value = '';
  userInput.style.height = 'auto';
  updateCharCount();

  // Disable controls while waiting
  sendBtn.disabled = true;
  userInput.disabled = true;

  // Show typing indicator
  const typingBubble = appendMessage('assistant', '', true);

  try {
    const res = await fetch(ORCHESTRATOR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getUserId(), message }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Server error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    typingBubble.classList.remove('typing');
    typingBubble.textContent = data.response ?? '(empty response)';
    typingBubble.setAttribute('aria-label', `SeedMind: ${typingBubble.textContent}`);
  } catch (err) {
    setErrorBubble(
      typingBubble,
      '⚠️ Something went wrong. Please try again.\n' + err.message,
    );
  } finally {
    sendBtn.disabled = false;
    userInput.disabled = false;
    userInput.focus();
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
});

// ─── Auto-grow textarea ───────────────────────────────────────────────────────
userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 160) + 'px';
  updateCharCount();
});

// ─── Submit on Enter (Shift+Enter for newline) ────────────────────────────────
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    inputForm.requestSubmit();
  }
});
