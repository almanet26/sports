import { useRef, useState } from 'react';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import FeatureGate from '../components/gates/FeatureGate';
import { useSubscriptionStore } from '../stores/authStore';
import { TIER_HIERARCHY } from '../types/plans';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming: boolean;
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Core chat UI — only rendered when FeatureGate passes (paid tier)
// ---------------------------------------------------------------------------

function ChatView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom whenever messages change
  function scrollToBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;

    setInput('');
    setError(null);

    const userMsg: Message = { id: generateId(), role: 'user', content: text, streaming: false };
    const assistantMsg: Message = { id: generateId(), role: 'assistant', content: '', streaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);
    scrollToBottom();

    const assistantId = assistantMsg.id;

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
          // No session_id — stateless. Only current message is sent.
          body: JSON.stringify({ message: text }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const detail = (body as { detail?: string | { message?: string } }).detail;
        const detailMsg = typeof detail === 'object' && detail !== null
          ? (detail as { message?: string }).message ?? JSON.stringify(detail)
          : (detail as string | undefined);

        if (response.status === 402) throw new Error('Subscription required for AI Chat.');
        if (response.status === 403) throw new Error(detailMsg ?? 'Access denied.');
        if (response.status === 429) throw new Error('Monthly quota reached. Resets next month.');
        throw new Error(detailMsg ?? `Server error ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response stream');

      let accumulated = '';
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
              finished = true;
              break;
            }
            if (parsed.delta) {
              accumulated += parsed.delta;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: accumulated, streaming: true } : m,
                ),
              );
              scrollToBottom();
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      }

      // Mark assistant message as done streaming
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, streaming: false } : m,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
      // Remove the empty/failed assistant message
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
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
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <MessageSquare className="h-10 w-10 text-zinc-700" />
            <p className="text-sm text-zinc-500 max-w-xs">
              Ask me anything about cricket technique, batting, bowling, or training drills.
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
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
          Press Enter to send · Shift+Enter for new line · Conversation resets on page refresh
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page exports — account-type-aware FeatureGate
// ---------------------------------------------------------------------------

/**
 * PlayerChatPage — gated behind "basic" (first paid player tier).
 * Free players who navigate to /player/chat see UpgradePrompt immediately.
 */
export default function ChatPage() {
  const accountType = useSubscriptionStore((s) => s.accountType);

  // Coaches navigated to /player/chat path (shouldn't normally happen due to
  // RoleGuard in routes.tsx, but defend here) get the coach gate.
  if (accountType === 'COACH') {
    return (
      <FeatureGate requiredTier="coach_starter" feature="ai_chat">
        <ChatView />
      </FeatureGate>
    );
  }

  return (
    <FeatureGate requiredTier="basic" feature="ai_chat">
      <ChatView />
    </FeatureGate>
  );
}

/**
 * CoachChatPage — gated behind "coach_starter" (first paid coach tier).
 * Free coaches who navigate to /coach/chat see UpgradePrompt immediately.
 */
export function CoachChatPage() {
  const subscriptionTier = useSubscriptionStore((s) => s.subscriptionTier);

  if (TIER_HIERARCHY[subscriptionTier] >= TIER_HIERARCHY['coach_starter']) {
    return <ChatView />;
  }

  return (
    <FeatureGate requiredTier="coach_starter" feature="ai_chat">
      <ChatView />
    </FeatureGate>
  );
}
