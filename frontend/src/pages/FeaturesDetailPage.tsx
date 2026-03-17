import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function FeaturesDetailPage() {
  const features = [
    {
      icon: '🧠',
      title: 'Action Detection',
      desc: 'Automatically detect batting, bowling, and fielding actions with 98% accuracy',
      details: [
        'Detect important cricket actions automatically',
        'Real-time motion and action recognition',
        'Identify key moments in your videos',
        'Multi-angle action detection'
      ]
    },
    {
      icon: '📊',
      title: 'Technique Analysis',
      desc: 'Analyzes your technique with 94% accuracy and provides biomechanical insights',
      details: [
        'Detailed biomechanical analysis',
        'Generate improvement tips & patterns',
        'Highlight strengths and areas to improve',
        'Personalized coaching recommendations'
      ]
    },
    {
      icon: '💡',
      title: 'Smart Recommendations',
      desc: 'Get personalized coaching recommendations based on performance analysis',
      details: [
        'Personalized improvement suggestions',
        'Coaching insights',
        'Technique optimization tips',
        'Performance-based recommendations'
      ]
    },
    {
      icon: '🎯',
      title: 'Motion Tracking',
      desc: 'Real-time motion detection and tracking to identify key moments',
      details: [
        'Real-time motion detection',
        'Frame-by-frame analysis',
        'Movement pattern recognition',
        'Automatic key moment identification'
      ]
    },
    {
      icon: '📈',
      title: 'Performance Metrics',
      desc: 'Generates comprehensive performance metrics and trends',
      details: [
        'Weekly trends and performance analytics',
        'Visual charts + feedback',
        'Downloadable reports and insights',
        'Performance comparison over time'
      ]
    },
    {
      icon: '🎬',
      title: 'Auto Highlight Generation',
      desc: 'Automatically create highlight reels from your videos',
      details: [
        'Intelligent scene detection',
        'Auto-generate highlight reels',
        'Smart clip organization',
        'One-click highlight creation'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white pt-32 pb-20 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-6xl font-black text-white mb-6">
            Powerful Features
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Discover all the advanced capabilities that make CricIQ the ultimate cricket analysis platform
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 hover:border-purple-500 transition"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="text-5xl">{feature.icon}</div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">{feature.title}</h2>
                  <p className="text-gray-300">{feature.desc}</p>
                </div>
              </div>

              <div className="space-y-3 mt-6 border-t border-slate-700 pt-6">
                {feature.details.map((detail, j) => (
                  <div key={j} className="flex items-start gap-3">
                    <span className="text-purple-400 font-bold mt-1">✓</span>
                    <span className="text-gray-300">{detail}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="text-center mt-16"
        >
          <Link
            to="/register"
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded transition inline-block"
          >
            Start Using These Features
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
