import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { api, resolveMediaUrl } from '../lib/api';
import { useAuthStore } from '../store/authStore';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message_text: string;
  is_read: boolean;
  created_at: string;
  sender_name: string;
  sender_avatar: string | null;
  receiver_name: string;
  receiver_avatar: string | null;
}

interface Conversation {
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  user_role: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

interface Player {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  team: string | null;
}

export default function CoachMessagesPage() {
  const { theme } = useThemeStore();
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);

  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';
  const cardBg = theme === 'dark' ? 'glass border-white/10' : 'bg-gray-50 border-gray-200';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';

  useEffect(() => {
    fetchConversations();
    if (user?.role === 'COACH') {
      fetchPlayers();
    }
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      fetchMessages(selectedUserId);
    }
  }, [selectedUserId]);

  const fetchConversations = async () => {
    try {
      const res = await api.get('/messages/conversations');
      setConversations(res.data);
      if (res.data.length > 0 && !selectedUserId) {
        setSelectedUserId(res.data[0].user_id);
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    try {
      const res = await api.get('/messages/players');
      setPlayers(res.data);
    } catch (err) {
      console.error('Failed to fetch players:', err);
    }
  };

  const fetchMessages = async (userId: string) => {
    try {
      const res = await api.get(`/messages/conversation/${userId}`);
      setMessages(res.data);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const send = async () => {
    if (!input.trim() || !selectedUserId || sending) return;
    setSending(true);
    try {
      await api.post('/messages/send', {
        receiver_id: selectedUserId,
        message_text: input
      });
      setInput('');
      await fetchMessages(selectedUserId);
      await fetchConversations();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const startNewConversation = (playerId: string) => {
    setSelectedUserId(playerId);
    setMessages([]);
    setShowNewMessage(false);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const selectedConversation = conversations.find(c => c.user_id === selectedUserId);
  const selectedPlayer = players.find(p => p.id === selectedUserId);

  if (loading) {
    return (
      <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
        <div className="flex items-center justify-center h-96">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl p-6 mb-6 border ${glass}`}>
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          <i className="fas fa-comments text-purple-400"></i>Messages
        </h1>
        <p className={`mt-1 text-sm ${sub}`}>Chat with your athletes</p>
      </motion.div>

      <div className={`rounded-3xl border overflow-hidden flex h-[600px] min-h-0 ${glass}`}>
        {/* Sidebar */}
        <div className={`w-72 flex-shrink-0 border-r ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'} flex flex-col`}>
          <div className={`p-3 border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <div className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl ${theme === 'dark' ? 'glass border border-white/10' : 'bg-gray-100'}`}>
                <i className={`fas fa-search text-xs ${sub}`}></i>
                <input placeholder="Search..." className={`bg-transparent text-sm outline-none flex-1 ${theme === 'dark' ? 'text-white placeholder-white/30' : 'text-gray-700 placeholder-gray-400'}`} />
              </div>
              {user?.role === 'COACH' && (
                <button
                  onClick={() => setShowNewMessage(!showNewMessage)}
                  className="w-9 h-9 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white hover:opacity-90 transition-opacity"
                  title="New Message"
                >
                  <i className={`fas ${showNewMessage ? 'fa-times' : 'fa-plus'} text-sm`}></i>
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {showNewMessage ? (
              <div className="p-3">
                <p className="text-sm font-semibold mb-3">Select Player</p>
                {players.length === 0 ? (
                  <p className={`text-xs ${sub} text-center py-4`}>No players found</p>
                ) : (
                  players.map(p => (
                    <button
                      key={p.id}
                      onClick={() => startNewConversation(p.id)}
                      className={`w-full flex items-center gap-3 p-3 text-left transition-all rounded-xl mb-2 ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                    >
                      {p.avatar ? (
                        <img src={resolveMediaUrl(p.avatar)} alt={p.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{p.name}</p>
                        <p className={`text-xs ${sub} truncate`}>{p.team || p.email}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center">
                <i className={`fas fa-inbox text-3xl ${sub} mb-2`}></i>
                <p className={`text-sm ${sub}`}>No conversations yet</p>
              </div>
            ) : (
              conversations.map(c => (
                <button key={c.user_id} onClick={() => setSelectedUserId(c.user_id)}
                  className={`w-full flex items-center gap-3 p-4 text-left transition-all border-b ${theme === 'dark' ? 'border-white/5 hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'} ${selectedUserId === c.user_id ? (theme === 'dark' ? 'bg-white/10' : 'bg-blue-50') : ''}`}>
                  {c.user_avatar ? (
                    <img src={resolveMediaUrl(c.user_avatar)} alt={c.user_name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {c.user_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold truncate">{c.user_name}</span>
                      <span className={`text-xs ${sub}`}>{formatTime(c.last_message_time)}</span>
                    </div>
                    <p className={`text-xs truncate mt-0.5 ${sub}`}>{c.last_message}</p>
                  </div>
                  {c.unread_count > 0 && (
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {c.unread_count}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col min-h-0">
          {(selectedConversation || selectedPlayer) ? (
            <>
              <div className={`flex items-center gap-3 p-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                {(selectedConversation?.user_avatar || selectedPlayer?.avatar) ? (
                  <img src={resolveMediaUrl((selectedConversation?.user_avatar || selectedPlayer?.avatar)!)} alt={(selectedConversation?.user_name || selectedPlayer?.name)!} className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-r from-purple-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                    {(selectedConversation?.user_name || selectedPlayer?.name || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm">{selectedConversation?.user_name || selectedPlayer?.name}</p>
                  <p className={`text-xs ${sub}`}>{selectedConversation?.user_role || 'PLAYER'}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className={`text-sm ${sub}`}>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${m.sender_id === user?.id
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-br-sm'
                        : theme === 'dark' ? 'glass border border-white/10 rounded-bl-sm' : 'bg-gray-100 rounded-bl-sm'}`}>
                        <p>{m.message_text}</p>
                        <p className={`text-xs mt-1 ${m.sender_id === user?.id ? 'text-white/60' : sub}`}>{formatTime(m.created_at)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className={`p-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border ${cardBg}`}>
                  <input
                    value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && send()}
                    placeholder="Type a message..."
                    disabled={sending}
                    className={`flex-1 bg-transparent text-sm outline-none ${theme === 'dark' ? 'text-white placeholder-white/30' : 'text-gray-700 placeholder-gray-400'}`}
                  />
                  <button onClick={send} disabled={sending} className="w-8 h-8 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white hover:opacity-90 transition-opacity disabled:opacity-50">
                    {sending ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <i className="fas fa-paper-plane text-xs"></i>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <i className={`fas fa-comments text-5xl ${sub} mb-4`}></i>
                <p className={`text-lg ${sub}`}>Select a conversation</p>
                <p className={`text-sm ${sub} mt-2`}>Choose a player to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
