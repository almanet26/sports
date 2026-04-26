import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, Plus, Trash2, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import FeatureGate from '../components/gates/FeatureGate';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

interface SessionSummary {
  session_id: string;
  last_message: string;
  created_at: string;
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function ChatView() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<string>(() => generateSessionId());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadSessions() {
    try {
      const { data } = await api.get<SessionSummary[]>('/chat/sessions');
      setSessions(data);
    } catch {
      // Non-fatal — user may have no sessions yet
    }
  }

  async function loadSession(sessionId: string) {
    setActiveSession(sessionId);
    setMessages([]);
    setError(null);
    // History is fetched server-side; we reconstruct a minimal view from session list
    const session = sessions.find((s) => s.session_id === sessionId);
    if (session) {
      setMessages([{ role: 'assistant', content: session.last_message }]);
    }
  }

  function newSession() {
    setActiveSession(generateSessionId());
    setMessages([]);
    setError(null);
    inputRef.current?.focus();
  }

  async function deleteSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await api.delete(`/chat/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      if (activeSession === sessionId) newSession();
    } catch {
      // Ignore
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;

    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setStreaming(true);

    const assistantIdx = messages.length + 1;
    setMessages((prev) => [...prev, { role: 'assistant', content: '', streaming: true }]);

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/chat/message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message: text, session_id: activeSession }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const detail = (body as { detail?: string }).detail;
        if (response.status === 402) throw new Error('Subscription required for AI Chat.');
        if (response.status === 403) throw new Error(detail ?? 'Access denied.');
        if (response.status === 429) throw new Error('Monthly quota reached. Resets next month.');
        throw new Error(detail ?? `Server error ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      if (!reader) throw new Error('No response stream');

      let finished = false;
      while (!finished) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') {
            finished = true;
            break;
          }
          try {
            const parsed = JSON.parse(payload) as { delta?: string; error?: string };
            if (parsed.error) {
              setError(parsed.error);
              break;
            }
            if (parsed.delta) {
              accumulated += parsed.delta;
              setMessages((prev) => {
                const next = [...prev];
                next[assistantIdx] = { role: 'assistant', content: accumulated, streaming: true };
                return next;
              });
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      }

      setMessages((prev) => {
        const next = [...prev];
        next[assistantIdx] = { role: 'assistant', content: accumulated, streaming: false };
        return next;
      });

      loadSessions();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
      setMessages((prev) => prev.filter((_, i) => i !== assistantIdx));
    } finally {
      setStreaming(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar */}
      <div className="hidden w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 md:flex">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <span className="text-sm font-semibold text-zinc-300">Sessions</span>
          <button
            onClick={newSession}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title="New session"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {sessions.length === 0 && (
            <p className="px-4 py-3 text-xs text-zinc-600">No saved sessions yet.</p>
          )}
          {sessions.map((s) => (
            <button
              key={s.session_id}
              onClick={() => loadSession(s.session_id)}
              className={`group flex w-full items-start justify-between gap-2 px-4 py-2.5 text-left hover:bg-zinc-800 ${
                activeSession === s.session_id ? 'bg-zinc-800' : ''
              }`}
            >
              <p className="truncate text-xs text-zinc-300">{s.last_message}</p>
              <button
                onClick={(e) => deleteSession(s.session_id, e)}
                className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <MessageSquare className="h-10 w-10 text-zinc-700" />
              <p className="text-sm text-zinc-500">
                Ask me anything about cricket biomechanics, batting technique, bowling technique, or training drills.
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-amber-500 text-zinc-900'
                    : 'bg-zinc-800 text-zinc-200'
                }`}
              >
                {msg.content}
                {msg.streaming && (
                  <span className="ml-1 inline-block h-3 w-0.5 bg-zinc-400 animate-pulse" />
                )}
              </div>
            </div>
          ))}
          {error && (
            <div className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-zinc-800 bg-zinc-950 px-4 py-3">
          <div className="flex items-end gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 focus-within:border-amber-500/60">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about cricket technique…"
              disabled={streaming}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-zinc-100 placeholder-zinc-600 outline-none disabled:opacity-50"
              style={{ maxHeight: '120px' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
              className="shrink-0 rounded-lg bg-amber-500 p-2 text-zinc-900 transition-colors hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-zinc-700">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <FeatureGate requiredTier="basic" feature="ai_chat">
      <ChatView />
    </FeatureGate>
  );
}
