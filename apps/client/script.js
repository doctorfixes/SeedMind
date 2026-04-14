/* global ORCHESTRATOR_URL */
'use strict';

// ─── Configuration ────────────────────────────────────────────────────────────
// ORCHESTRATOR_URL is injected at build time by Vercel env vars.
// Falls back to a relative path for local development.
const ORCHESTRATOR_URL =
  (typeof window !== 'undefined' && window.ORCHESTRATOR_URL) ||
  'https://seedmind-orchestrator.vercel.app/ask';

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

function appendMessage(role, text, isTyping = false) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${role}`;

  const bubble = document.createElement('span');
  bubble.className = 'bubble' + (isTyping ? ' typing' : '');
  bubble.textContent = isTyping ? '' : text;

  wrapper.appendChild(bubble);
  chatWindow.appendChild(wrapper);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return bubble;
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
  } catch (err) {
    typingBubble.classList.remove('typing');
    typingBubble.textContent =
      '⚠️ Something went wrong. Please try again.\n' + err.message;
    typingBubble.style.color = '#c0392b';
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
});

// ─── Submit on Enter (Shift+Enter for newline) ────────────────────────────────
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    inputForm.requestSubmit();
  }
});
