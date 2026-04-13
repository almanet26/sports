import { useState } from 'react';
import { motion } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';

interface Message {
  id: string;
  sender: string;
  avatar: string;
  preview: string;
  time: string;
  unread: boolean;
  messages: { from: 'me' | 'them'; text: string; time: string }[];
}

const MOCK: Message[] = [
  {
    id: '1', sender: 'Arjun Sharma', avatar: 'A', preview: 'Can we reschedule tomorrow?', time: '10:32 AM', unread: true,
    messages: [
      { from: 'them', text: 'Hi coach! Can we reschedule tomorrow\'s session?', time: '10:30 AM' },
      { from: 'me', text: 'Sure, what time works for you?', time: '10:31 AM' },
      { from: 'them', text: 'Can we reschedule tomorrow?', time: '10:32 AM' },
    ],
  },
  {
    id: '2', sender: 'Priya Patel', avatar: 'P', preview: 'Thanks for the feedback!', time: 'Yesterday', unread: false,
    messages: [
      { from: 'them', text: 'Thanks for the feedback on my batting stance!', time: 'Yesterday' },
      { from: 'me', text: 'Keep practicing the follow-through. Great progress!', time: 'Yesterday' },
    ],
  },
  {
    id: '3', sender: 'Rahul Verma', avatar: 'R', preview: 'Uploaded my bowling video', time: 'Mon', unread: false,
    messages: [
      { from: 'them', text: 'Uploaded my bowling video for review.', time: 'Mon' },
    ],
  },
];

export default function CoachMessagesPage() {
  const { theme } = useThemeStore();
  const [selected, setSelected] = useState<Message>(MOCK[0]);
  const [input, setInput] = useState('');
  const [conversations, setConversations] = useState<Message[]>(MOCK);

  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';
  const cardBg = theme === 'dark' ? 'glass border-white/10' : 'bg-gray-50 border-gray-200';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';

  const send = () => {
    if (!input.trim()) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setConversations(prev => prev.map(c =>
      c.id === selected.id
        ? { ...c, preview: input, time: now, messages: [...c.messages, { from: 'me', text: input, time: now }] }
        : c
    ));
    setSelected(prev => ({ ...prev, preview: input, time: now, messages: [...prev.messages, { from: 'me', text: input, time: now }] }));
    setInput('');
  };

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl p-6 mb-6 border ${glass}`}>
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          <i className="fas fa-comments text-purple-400"></i>Messages
        </h1>
        <p className={`mt-1 text-sm ${sub}`}>Chat with your athletes</p>
      </motion.div>

      <div className={`rounded-3xl border overflow-hidden flex h-[600px] ${glass}`}>
        {/* Sidebar */}
        <div className={`w-72 flex-shrink-0 border-r ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'} flex flex-col`}>
          <div className={`p-3 border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${theme === 'dark' ? 'glass border border-white/10' : 'bg-gray-100'}`}>
              <i className={`fas fa-search text-xs ${sub}`}></i>
              <input placeholder="Search..." className={`bg-transparent text-sm outline-none flex-1 ${theme === 'dark' ? 'text-white placeholder-white/30' : 'text-gray-700 placeholder-gray-400'}`} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.map(c => (
              <button key={c.id} onClick={() => { setSelected(c); setConversations(prev => prev.map(x => x.id === c.id ? { ...x, unread: false } : x)); }}
                className={`w-full flex items-center gap-3 p-4 text-left transition-all border-b ${theme === 'dark' ? 'border-white/5 hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'} ${selected.id === c.id ? (theme === 'dark' ? 'bg-white/10' : 'bg-blue-50') : ''}`}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {c.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold truncate">{c.sender}</span>
                    <span className={`text-xs ${sub}`}>{c.time}</span>
                  </div>
                  <p className={`text-xs truncate mt-0.5 ${sub}`}>{c.preview}</p>
                </div>
                {c.unread && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col">
          <div className={`flex items-center gap-3 p-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-r from-purple-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
              {selected.avatar}
            </div>
            <div>
              <p className="font-semibold text-sm">{selected.sender}</p>
              <p className={`text-xs ${sub}`}>Athlete</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {selected.messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${m.from === 'me'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-br-sm'
                  : theme === 'dark' ? 'glass border border-white/10 rounded-bl-sm' : 'bg-gray-100 rounded-bl-sm'}`}>
                  <p>{m.text}</p>
                  <p className={`text-xs mt-1 ${m.from === 'me' ? 'text-white/60' : sub}`}>{m.time}</p>
                </div>
              </div>
            ))}
          </div>

          <div className={`p-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border ${cardBg}`}>
              <input
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="Type a message..."
                className={`flex-1 bg-transparent text-sm outline-none ${theme === 'dark' ? 'text-white placeholder-white/30' : 'text-gray-700 placeholder-gray-400'}`}
              />
              <button onClick={send} className="w-8 h-8 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white hover:opacity-90 transition-opacity">
                <i className="fas fa-paper-plane text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
