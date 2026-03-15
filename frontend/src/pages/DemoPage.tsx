import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useThemeStore } from '../store/themeStore';

export default function DemoPage() {
  const { theme } = useThemeStore();

  const steps = [
    {
      icon: '⬆️',
      title: 'Upload Video',
      desc: 'Upload your cricket session video (demo upload flow).',
      details: 'Start by uploading your cricket training or match video. Our platform supports multiple formats and automatically processes your content.',
    },
    {
      icon: '✨',
      title: 'AI Detects Moments',
      desc: 'AI identifies key cricket actions and important segments.',
      details: 'Our advanced AI analyzes your video and automatically detects key cricket moments like batting strokes, bowling actions, and fielding plays.',
    },
    {
      icon: '⏱️',
      title: 'Timeline Review',
      desc: 'Browse clips with timestamps and jump to highlights instantly.',
      details: 'Review organized clips with precise timestamps. Jump to any highlight instantly and focus on the moments that matter most.',
    },
    {
      icon: '✅',
      title: 'Feedback + Dashboard',
      desc: 'Get insights, suggestions, and a visual performance summary.',
      details: 'Receive personalized feedback, improvement suggestions, and comprehensive performance analytics on your dashboard.',
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
          <h1 className="text-4xl md:text-5xl font-bold mb-4">How It Works</h1>
          <p className="text-white/70 text-lg max-w-2xl">Follow our simple 4-step process to get AI-powered cricket insights in minutes.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-2xl border border-white/20 p-6 backdrop-blur-xl"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="text-3xl">{step.icon}</div>
                <div>
                  <h3 className="text-xl font-bold">Step {i + 1}: {step.title}</h3>
                  <p className="text-white/60 text-sm">{step.desc}</p>
                </div>
              </div>
              <p className="text-white/70">{step.details}</p>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-16 glass rounded-3xl border border-white/20 p-8 backdrop-blur-xl">
          <h2 className="text-2xl font-bold mb-4">Processing Time</h2>
          <p className="text-white/70 mb-6">Estimated processing time: <span className="text-white font-semibold">2-5 minutes</span> depending on video length</p>
          <p className="text-white/60">Our AI works in real-time to analyze your cricket videos and provide instant feedback. Longer videos may take slightly more time, but you'll get comprehensive insights for every moment.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-16 text-center">
          <Link to="/register" className="px-8 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all font-semibold">
            Start Your Demo
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
