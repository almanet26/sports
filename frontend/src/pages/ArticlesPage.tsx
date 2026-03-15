import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useThemeStore } from '../store/themeStore';

export default function ArticlesPage() {
  const { theme } = useThemeStore();

  const articles = [
    {
      icon: '🏏',
      title: 'Mastering Batting Techniques',
      category: 'Batting',
      content: 'Learn the fundamentals of proper batting stance, grip, and swing mechanics to improve your consistency at the crease. This comprehensive guide covers everything from basic positioning to advanced shot selection strategies used by professional cricketers.',
      tips: [
        'Maintain a balanced stance with feet shoulder-width apart',
        'Keep your head still and eyes on the ball',
        'Practice proper grip pressure for better control',
        'Develop muscle memory through consistent practice',
        'Study different bowling styles and adapt your technique',
      ],
    },
    {
      icon: '⚡',
      title: 'Bowling Action Analysis',
      category: 'Bowling',
      content: 'Understand the key components of an effective bowling action and how AI can help identify areas for improvement. Our AI technology analyzes your bowling mechanics frame-by-frame to provide actionable feedback.',
      tips: [
        'Maintain a smooth run-up approach',
        'Keep your bowling arm straight during delivery',
        'Focus on consistent line and length',
        'Develop variations in pace and spin',
        'Use AI feedback to refine your technique',
      ],
    },
    {
      icon: '📊',
      title: 'Performance Metrics Explained',
      category: 'Analytics',
      content: 'Deep dive into cricket analytics and how to interpret performance data to track your progress over time. Understanding key metrics helps you identify strengths and areas for improvement in your game.',
      tips: [
        'Track your batting average and strike rate',
        'Monitor bowling economy and wicket rate',
        'Analyze performance against different opponents',
        'Use historical data to identify trends',
        'Set measurable goals based on analytics',
      ],
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
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Cricket Tips & Insights</h1>
          <p className="text-white/70 text-lg max-w-2xl">Expert articles and guides to help you improve your cricket skills and performance with AI-powered analysis.</p>
        </motion.div>

        <div className="grid md:grid-cols-1 gap-8">
          {articles.map((article, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass rounded-3xl border border-purple-500/30 p-8 backdrop-blur-xl"
            >
              <div className="flex items-start gap-6 mb-6">
                <div className="text-5xl">{article.icon}</div>
                <div className="flex-1">
                  <span className="inline-block text-xs px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 mb-3">
                    {article.category}
                  </span>
                  <h2 className="text-3xl font-bold mb-3">{article.title}</h2>
                  <p className="text-white/80 text-lg leading-relaxed">{article.content}</p>
                </div>
              </div>

              <div className="mt-8">
                <h3 className="text-xl font-bold mb-4">Key Tips:</h3>
                <ul className="grid md:grid-cols-2 gap-3">
                  {article.tips.map((tip, j) => (
                    <li key={j} className="flex items-start gap-3 text-white/80">
                      <span className="text-purple-400 font-bold mt-1">✓</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-16 text-center">
          <Link to="/register" className="px-8 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 transition-all font-semibold">
            Start Improving Your Game
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
