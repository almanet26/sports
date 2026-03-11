import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function CoachPendingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#070A14] via-[#0A0F1C] to-[#0D1117] text-white flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, -100, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -top-40 -left-40 w-80 h-80 bg-yellow-500/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, -100, 0],
            y: [0, 100, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -bottom-40 -right-40 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative w-full max-w-2xl"
      >
        {/* Main card */}
        <div className="glass rounded-3xl p-8 md:p-12 shadow-2xl border border-white/20 text-center">
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-r from-yellow-500 to-orange-600 mb-6 pulse-glow"
          >
            <i className="fas fa-clock text-white text-4xl"></i>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl md:text-4xl font-bold gradient-text mb-4"
          >
            Account Pending Verification
          </motion.h1>

          {/* Message */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-white/70 text-lg mb-8 leading-relaxed"
          >
            Your coach account is currently under review. Please wait until the Admin reviews your documents and verifies your credentials.
          </motion.p>

          {/* Info Box */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass rounded-2xl p-6 border border-white/20 mb-8"
          >
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-info-circle text-blue-400"></i>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white mb-1">What happens next?</p>
                  <p className="text-sm text-white/60">
                    Our admin team will review your submitted documents and credentials. This typically takes 24-48 hours.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-check-circle text-green-400"></i>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white mb-1">Once approved</p>
                  <p className="text-sm text-white/60">
                    You'll receive an email notification and will be able to access your coach dashboard immediately.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-envelope text-purple-400"></i>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white mb-1">Need help?</p>
                  <p className="text-sm text-white/60">
                    Contact our support team at support@sportvision.ai if you have any questions.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Status Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 mb-8"
          >
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
            <span className="font-semibold">Status: Pending Review</span>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              to="/"
              className="px-6 py-3 rounded-xl glass border border-white/20 hover:bg-white/10 transition-all duration-300 flex items-center justify-center gap-2"
            >
              <i className="fas fa-home"></i>
              Back to Home
            </Link>
            <Link
              to="/login"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 flex items-center justify-center gap-2 font-semibold"
            >
              <i className="fas fa-sign-in-alt"></i>
              Try Login Again
            </Link>
          </motion.div>
        </div>

        {/* Decorative elements */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="absolute -top-6 -right-6 w-12 h-12 rounded-full bg-gradient-to-r from-yellow-500 to-orange-600 blur-xl"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="absolute -bottom-6 -left-6 w-16 h-16 rounded-full bg-gradient-to-r from-orange-500 to-red-600 blur-xl"
        />
      </motion.div>
    </div>
  );
}
