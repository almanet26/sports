import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useThemeStore } from '../store/themeStore';

export default function TestimonialsPage() {
  const { theme } = useThemeStore();

  const testimonials = [
    {
      name: 'Rahul Verma',
      role: 'Athlete',
      sport: 'Cricket',
      emoji: '🏏',
      msg: 'The preview and timeline flow helps me focus on key moments without wasting time.',
      outcome: 'Faster review of practice sessions',
      fullStory: 'As a professional cricket player, I needed a tool to quickly review my practice sessions. Cricket Analytics AI has been a game-changer. I can now review hours of footage in minutes and focus on specific moments that matter.',
    },
    {
      name: 'Coach Meera Singh',
      role: 'Coach',
      sport: 'Cricket',
      emoji: '👨🏫',
      msg: 'AI feedback is easy to understand, so I can guide players quickly in training.',
      outcome: 'Better coaching sessions in less time',
      fullStory: 'Coaching multiple players is challenging, but this platform has made it easier. The AI insights are clear and actionable, allowing me to provide better feedback to my players in less time.',
    },
    {
      name: 'Aman Khan',
      role: 'Beginner',
      sport: 'Cricket',
      emoji: '🏏',
      msg: 'I like the dashboard charts. It makes my progress feel clear and motivating.',
      outcome: 'Improved consistency over weeks',
      fullStory: 'Starting my cricket journey, I was unsure about my progress. The visual dashboard and performance charts keep me motivated and help me track my improvement week by week.',
    },
  ];

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gradient-to-br from-[#070A14] via-[#0A0F1C] to-[#0D1117] text-white' : 'bg-gradient-to-br from-gray-50 via-white to-gray-100 text-gray-900'}`}>
      <header className="relative z-10 border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 grid place-items-center">
              <i className="fas fa-trophy text-white"></i>
            </div>
            <span className="font-bold">Cricket Analytics AI</span>
          </Link>
          <Link to="/" className="px-4 py-2 rounded-xl glass border border-white/20 hover:bg-white/10 transition-all">
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Testimonials</h1>
          <p className="text-white/70 text-lg max-w-2xl">Real stories from cricket players and coaches using Cricket Analytics AI to improve their performance.</p>
        </motion.div>

        <div className="grid md:grid-cols-1 gap-8">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-3xl border border-white/20 p-8 backdrop-blur-xl"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="text-5xl">{testimonial.emoji}</div>
                <div>
                  <h3 className="text-2xl font-bold">{testimonial.name}</h3>
                  <p className="text-white/60">{testimonial.role} • {testimonial.sport}</p>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="text-yellow-400">★★★★★</span>
                    <span className="text-white/60">5.0</span>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-lg text-white/80 italic mb-4">"{testimonial.msg}"</p>
                <p className="text-white/70 leading-relaxed">{testimonial.fullStory}</p>
              </div>

              <div className="glass rounded-2xl border border-white/20 p-4 bg-white/5">
                <p className="text-sm text-white/60 mb-1">Outcome:</p>
                <p className="text-white font-semibold">{testimonial.outcome}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-16 text-center">
          <Link to="/register" className="px-8 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all font-semibold">
            Join Our Community
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
