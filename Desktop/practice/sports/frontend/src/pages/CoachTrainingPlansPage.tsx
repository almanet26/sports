import { motion } from 'framer-motion';

export default function CoachTrainingPlansPage() {
  return (
    <div className="text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 mb-6 border border-white/20"
      >
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          <i className="fas fa-book-open text-orange-400"></i>
          Training Plans
        </h1>
        <p className="text-white/70 mt-2">Create and manage customized training programs</p>
      </motion.div>

      <div className="glass rounded-2xl p-8 border border-white/20 text-center">
        <i className="fas fa-dumbbell text-5xl text-orange-400 mb-4"></i>
        <h3 className="text-2xl font-semibold mb-2">Build Training Programs</h3>
        <p className="text-white/60">Design personalized training plans for your players</p>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="mt-6 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl font-medium"
        >
          Coming Soon
        </motion.button>
      </div>
    </div>
  );
}
