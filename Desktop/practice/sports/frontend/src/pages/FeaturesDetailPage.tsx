import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Crosshair, Brain, Lightbulb, Activity, BarChart2, Film, Check } from 'lucide-react';

const features = [
  {
    Icon: Crosshair,
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
    Icon: Brain,
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
    Icon: Lightbulb,
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
    Icon: Activity,
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
    Icon: BarChart2,
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
    Icon: Film,
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

export default function FeaturesDetailPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white pt-24 pb-20 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Back link */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-10"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition text-sm font-medium group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-6xl font-black text-white mb-6">
            Powerful Features
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Discover all the advanced capabilities that make PitchVision the ultimate cricket analysis platform
          </p>
        </motion.div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {features.map(({ Icon, title, desc, details }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300 group"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 bg-[image:var(--primary-gradient)] rounded-xl flex items-center justify-center flex-shrink-0 group-hover:shadow-lg group-hover:shadow-purple-500/40 transition-all duration-300">
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">{title}</h2>
                  <p className="text-gray-400 text-sm">{desc}</p>
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-700 pt-6">
                {details.map((detail, j) => (
                  <div key={j} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300 text-sm">{detail}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <Link
            to="/register"
            className="px-8 py-3 bg-[image:var(--primary-gradient)] hover:opacity-90 text-white font-bold rounded transition inline-block shadow-lg hover:shadow-xl"
          >
            Start Using These Features
          </Link>
        </motion.div>

      </div>
    </div>
  );
}
