import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useThemeStore } from '../store/themeStore';

export default function FeaturesPage() {
  const { theme } = useThemeStore();

  const features = [
    {
      icon: <i className="fas fa-video text-4xl text-blue-400"></i>,
      title: 'Upload & Processing',
      desc: 'Seamlessly upload your cricket training and match videos. Our AI automatically organizes key moments into clips for quick review.',
      details: [
        'Support for multiple video formats',
        'Auto-organize key moments into clips',
        'Clean preview flow for quick review',
        'Fast processing with AI detection',
      ],
    },
    {
      icon: <i className="fas fa-brain text-4xl text-purple-400"></i>,
      title: 'AI Insights & Feedback',
      desc: 'Get intelligent analysis of your cricket performance with actionable feedback.',
      details: [
        'Detect important cricket actions automatically',
        'Generate improvement tips & patterns',
        'Highlight strengths and areas to improve',
        'Personalized coaching recommendations',
      ],
    },
    {
      icon: <i className="fas fa-chart-bar text-4xl text-green-400"></i>,
      title: 'Dashboard & Reports',
      desc: 'Track your progress with comprehensive analytics and visual reports.',
      details: [
        'Weekly trends and performance analytics',
        'Visual charts + feedback summary',
        'Downloadable reports and insights',
        'Performance comparison over time',
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
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Features</h1>
          <p className="text-white/70 text-lg max-w-2xl">Explore all the powerful features that make Cricket Analytics AI the ultimate tool for cricket performance analysis.</p>
        </motion.div>

        <div className="grid md:grid-cols-1 gap-8">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass rounded-3xl border border-white/20 p-8 backdrop-blur-xl"
            >
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">{feature.icon}</div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">{feature.title}</h2>
                  <p className="text-white/70 mb-6">{feature.desc}</p>
                  <ul className="grid md:grid-cols-2 gap-3">
                    {feature.details.map((detail, j) => (
                      <li key={j} className="flex items-center gap-2 text-white/80">
                        <span className="text-blue-400">✓</span> {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-16 text-center">
          <Link to="/register" className="px-8 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all font-semibold">
            Get Started Now
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
