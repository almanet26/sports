import { motion } from 'framer-motion';

export default function CoachEarningsPage() {
  return (
    <div className="text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 mb-6 border border-white/20"
      >
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          <i className="fas fa-dollar-sign text-green-400"></i>
          Earnings
        </h1>
        <p className="text-white/70 mt-2">Track your income and payment history</p>
      </motion.div>

      <div className="glass rounded-2xl p-8 border border-white/20 text-center">
        <i className="fas fa-wallet text-5xl text-green-400 mb-4"></i>
        <h3 className="text-2xl font-semibold mb-2">Financial Dashboard</h3>
        <p className="text-white/60">Monitor your earnings, payments, and financial reports</p>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="mt-6 px-6 py-3 bg-gradient-to-r from-green-500 to-teal-600 rounded-xl font-medium"
        >
          Coming Soon
        </motion.button>
      </div>
    </div>
  );
}
