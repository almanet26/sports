import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 * i, duration: 0.6, ease: 'easeOut' as const },
  }),
};

interface StatProps {
  label: string;
  value: string;
}

function Stat({ label, value }: StatProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -5 }}
      className="glass rounded-2xl border border-white/20 p-5 backdrop-blur-xl hover:border-white/30 transition-all duration-300 group cursor-pointer"
    >
      <p className="text-white text-2xl font-bold group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-purple-500 group-hover:bg-clip-text transition-all duration-300">
        {value}
      </p>
      <p className="text-white/60 text-sm mt-1">{label}</p>
    </motion.div>
  );
}

interface TrustBadgeProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

function TrustBadge({ icon, title, desc }: TrustBadgeProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      className="glass rounded-2xl border border-white/20 px-4 py-3 backdrop-blur-xl flex items-start gap-3 hover:border-white/30 transition-all duration-300 group"
    >
      <div className="h-9 w-9 rounded-xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-white/20 grid place-items-center group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-white/60 mt-0.5">{desc}</p>
      </div>
    </motion.div>
  );
}

interface CategoryCardProps {
  icon: React.ReactNode;
  title: string;
  points: string[];
}

function CategoryCard({ icon, title, points }: CategoryCardProps) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ scale: 1.02, y: -5 }}
      className="glass rounded-2xl border border-white/20 p-6 backdrop-blur-xl hover:border-white/30 transition-all duration-300 group"
    >
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-white/20 grid place-items-center text-xl group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
        <div>
          <p className="font-semibold text-lg">{title}</p>
          <p className="text-xs text-white/60">Core module</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {points.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass rounded-2xl border border-white/20 p-3 text-sm text-white/75 hover:text-white hover:border-white/30 transition-all duration-300"
          >
            • {p}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

interface TestimonialCardProps {
  name: string;
  role: string;
  sport: string;
  msg: string;
  outcome: string;
}

function TestimonialCard({ name, role, sport, msg, outcome }: TestimonialCardProps) {
  return (
    <motion.div
      variants={fadeUp}
      className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{name}</p>
          <p className="text-xs text-white/60">
            {role} • {sport}
          </p>
        </div>
        <span className="text-xs text-white/60 border border-white/10 px-2 py-1 rounded-full">
          ★ 4.9
        </span>
      </div>

      <p className="mt-4 text-sm text-white/75 leading-relaxed">"{msg}"</p>

      <div className="mt-4 rounded-2xl border border-white/10 bg-[#0B1020] p-3 text-xs text-white/60">
        Outcome: <span className="text-white/75">{outcome}</span>
      </div>
    </motion.div>
  );
}

interface StepCardProps {
  idx: number;
  icon: string;
  title: string;
  desc: string;
}

function StepCard({ idx, icon, title, desc }: StepCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.5, delay: idx * 0.08 }}
      className="rounded-2xl border border-white/10 bg-[#0B1020] p-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-white/10 border border-white/10 grid place-items-center text-xl">
            {icon}
          </div>
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-xs text-white/60">Step {String(idx + 1).padStart(2, '0')}</p>
          </div>
        </div>

        <span className="text-xs text-white/60 border border-white/20 px-2 py-1 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20">
          Live
        </span>
      </div>

      <p className="mt-3 text-sm text-white/60 leading-relaxed">{desc}</p>

      <div className="mt-5 h-1 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full bg-white/60 rounded-full"
          animate={{ width: ['20%', '100%', '55%'] }}
          transition={{
            duration: 2.7,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
            delay: idx * 0.12,
          }}
        />
      </div>
    </motion.div>
  );
}

export default function LandingPage() {
  const sports = useMemo(
    () => [
      { id: 'cricket', name: 'Cricket', icon: '🏏', highlight: 'Cover Drive', tip: 'Earlier bat lift for better timing' },
      { id: 'football', name: 'Football', icon: '⚽', highlight: 'Passing Accuracy', tip: 'Open body angle before receiving the ball' },
      { id: 'basketball', name: 'Basketball', icon: '🏀', highlight: 'Shot Form', tip: 'Elbow alignment + consistent follow-through' },
      { id: 'tennis', name: 'Tennis', icon: '🎾', highlight: 'Forehand Timing', tip: 'Early preparation + contact in front' },
      { id: 'badminton', name: 'Badminton', icon: '🏸', highlight: 'Smash Technique', tip: 'Focus on wrist snap & landing balance' },
      { id: 'volleyball', name: 'Volleyball', icon: '🏐', highlight: 'Spike Power', tip: 'Jump timing and arm swing coordination' },
    ],
    []
  );

  const [selectedSport, setSelectedSport] = useState(sports[0]);

  const categories = useMemo(
    () => [
      {
        icon: <i className="fas fa-video text-2xl text-blue-400"></i>,
        title: 'Upload & Processing',
        points: [
          `Upload your ${selectedSport.name} training/match video`,
          'Auto-organize key moments into clips',
          'Clean preview flow for quick review',
        ],
      },
      {
        icon: <i className="fas fa-brain text-2xl text-purple-400"></i>,
        title: 'AI Insights & Feedback',
        points: [
          `Detect important ${selectedSport.name} actions automatically`,
          'Generate improvement tips & patterns',
          'Highlight strengths and areas to improve',
        ],
      },
      {
        icon: <i className="fas fa-chart-bar text-2xl text-green-400"></i>,
        title: 'Dashboard & Reports',
        points: [
          'Weekly trends and performance analytics',
          'Visual charts + feedback summary',
          'Downloadable reports and insights',
        ],
      },
    ],
    [selectedSport]
  );

  const steps = useMemo(
    () => [
      { icon: '⬆️', title: 'Upload Video', desc: `Upload your ${selectedSport.name} session video (demo upload flow).` },
      { icon: '✨', title: 'AI Detects Moments', desc: `AI identifies key ${selectedSport.name} actions and important segments.` },
      { icon: '⏱️', title: 'Timeline Review', desc: 'Browse clips with timestamps and jump to highlights instantly.' },
      { icon: '✅', title: 'Feedback + Dashboard', desc: 'Get insights, suggestions, and a visual performance summary.' },
    ],
    [selectedSport]
  );

  const testimonials = useMemo(
    () => [
      {
        name: 'Rahul Verma',
        role: 'Athlete',
        sport: 'Cricket',
        msg: 'The preview and timeline flow helps me focus on key moments without wasting time.',
        outcome: 'Faster review of practice sessions',
      },
      {
        name: 'Coach Meera Singh',
        role: 'Coach',
        sport: 'Multi-sport',
        msg: 'AI feedback is easy to understand, so I can guide players quickly in training.',
        outcome: 'Better coaching sessions in less time',
      },
      {
        name: 'Aman Khan',
        role: 'Beginner',
        sport: 'Badminton',
        msg: 'I like the dashboard charts. It makes my progress feel clear and motivating.',
        outcome: 'Improved consistency over weeks',
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#070A14] via-[#0A0F1C] to-[#0D1117] text-white overflow-x-hidden relative">
      {/* Background Glow Effects */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="pointer-events-none absolute -top-48 -left-48 h-[520px] w-[520px] rounded-full blur-3xl opacity-30 overflow-hidden"
        style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(96,165,250,0.8), rgba(96,165,250,0.0) 60%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="pointer-events-none absolute -bottom-56 -right-56 h-[560px] w-[560px] rounded-full blur-3xl opacity-30 overflow-hidden"
        style={{
          background: 'radial-gradient(circle at 40% 40%, rgba(167,103,255,0.8), rgba(167,103,255,0.0) 60%)',
        }}
      />

      {/* Floating Elements */}
      <motion.div
        animate={{ y: [-20, 20, -20] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/4 right-1/4 w-32 h-32 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-full blur-2xl"
      />
      <motion.div
        animate={{ y: [20, -20, 20] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-1/3 left-1/3 w-24 h-24 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-full blur-2xl"
      />

      {/* Navbar */}
      <header className="relative z-10">
        <div className="mx-auto max-w-6xl px-4 py-5 flex items-center justify-between">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 border border-white/20 grid place-items-center pulse-glow">
              <i className="fas fa-trophy text-white text-lg"></i>
            </div>
            <div>
              <p className="text-white font-bold leading-none gradient-text">SportVision AI</p>
              <p className="text-xs text-white/60">Multi-Sport Analysis Platform</p>
            </div>
          </motion.div>

          <nav className="hidden md:flex items-center gap-6 text-sm text-white/70">
            <a className="hover:text-white transition-colors duration-300" href="#features">
              Features
            </a>
            <a className="hover:text-white transition-colors duration-300" href="#demo">
              Demo
            </a>
            <a className="hover:text-white transition-colors duration-300" href="#testimonials">
              Testimonials
            </a>
            <a className="hover:text-white transition-colors duration-300" href="#cta">
              Start
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden sm:block px-4 py-2 rounded-xl glass border border-white/20 hover:bg-white/10 transition-all duration-300 text-sm"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 text-sm font-semibold shadow-lg hover:shadow-xl"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      {/* Banner Image */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 pt-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative h-48 md:h-64 rounded-3xl overflow-hidden glass border border-white/20"
        >
          <img
            src="https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1200&h=400&fit=crop&crop=center"
            alt="Sports Banner"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent flex items-center">
            <div className="px-8">
              <h2 className="text-2xl md:text-4xl font-bold text-white mb-2">Multi-Sport AI Analysis</h2>
              <p className="text-white/80 text-sm md:text-base">Professional insights for every athlete</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Hero */}
      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-4 pt-8 pb-14">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            {/* Left */}
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                  <span className="h-2 w-2 rounded-full bg-white/70" />
                  Multi-Sport • AI Insights
                </div>

                {/* Sport Selector */}
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1 flex items-center gap-2">
                  <span className="text-xs text-white/60">Sport:</span>
                  <select
                    value={selectedSport.id}
                    onChange={(e) => setSelectedSport(sports.find((s) => s.id === e.target.value) || sports[0])}
                    className="bg-transparent text-white text-xs outline-none cursor-pointer"
                  >
                    {sports.map((s) => (
                      <option key={s.id} value={s.id} className="text-black">
                        {s.icon} {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <h1 className="mt-4 text-4xl md:text-5xl font-bold leading-tight">
                Upload any sports video. <span className="text-white/80">Get AI insights.</span>
              </h1>

              <p className="mt-4 text-white/70 leading-relaxed">
                SportVision AI converts long training/match videos into clips, highlights, and coaching feedback — built for
                athletes and coaches across all sports to improve faster.
              </p>

              {/* Trust badges row */}
              <div className="mt-6 grid sm:grid-cols-3 gap-3">
                <TrustBadge
                  icon={<i className="fas fa-running text-blue-400"></i>}
                  title="Multi-sport support"
                  desc="Any sport, any level"
                />
                <TrustBadge
                  icon={<i className="fas fa-clock text-green-400"></i>}
                  title="Quick analysis"
                  desc="Instant highlights & insights"
                />
                <TrustBadge
                  icon={<i className="fas fa-chart-line text-purple-400"></i>}
                  title="Performance tracking"
                  desc="Progress analytics & reports"
                />
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to="/register"
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-2"
                >
                  <i className="fas fa-upload"></i>
                  Get Started
                </Link>

                <Link
                  to="/login"
                  className="px-6 py-3 rounded-2xl glass border border-white/20 hover:bg-white/10 transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
                >
                  <i className="fas fa-sign-in-alt"></i>
                  Sign In
                </Link>
              </div>

              <p className="mt-3 text-xs text-white/45">AI-powered sports analysis platform for athletes and coaches</p>

              <div className="mt-8 grid grid-cols-3 gap-4">
                <Stat label="Clips Organized" value="120+" />
                <Stat label="Insights Generated" value="300+" />
                <Stat label="Progress Lift" value="15%" />
              </div>
            </motion.div>

            {/* Right Preview */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="relative"
            >
              <div className="glass rounded-3xl border border-white/20 p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-semibold">Sports Gallery</p>
                  <span className="text-xs text-white/70 border border-white/20 px-2 py-1 rounded-full">
                    {selectedSport.icon} {selectedSport.name}
                  </span>
                </div>

                {/* Sports Images Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { src: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=300&h=200&fit=crop&crop=center', alt: 'Cricket', gradient: 'from-blue-500/20 to-purple-500/20' },
                    { src: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=300&h=200&fit=crop&crop=center', alt: 'Football', gradient: 'from-green-500/20 to-blue-500/20' },
                    { src: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=300&h=200&fit=crop&crop=center', alt: 'Basketball', gradient: 'from-orange-500/20 to-red-500/20' },
                    { src: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=300&h=200&fit=crop&crop=center', alt: 'Badminton', gradient: 'from-purple-500/20 to-pink-500/20' },
                  ].map((img, i) => (
                    <motion.div
                      key={i}
                      whileHover={{ scale: 1.05 }}
                      className={`aspect-video rounded-xl bg-gradient-to-br ${img.gradient} border border-white/20 flex items-center justify-center overflow-hidden`}
                    >
                      <img
                        src={img.src}
                        alt={img.alt}
                        className="w-full h-full object-cover rounded-xl opacity-80 hover:opacity-100 transition-opacity"
                      />
                    </motion.div>
                  ))}
                </div>

                {/* AI Analysis Preview */}
                <div className="glass rounded-2xl border border-white/20 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <p className="text-sm font-medium">AI Analysis Active</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/60">Motion Detection</span>
                      <span className="text-green-400">98%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-white/60">Technique Analysis</span>
                      <span className="text-blue-400">94%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-white/60">Performance Insights</span>
                      <span className="text-purple-400">91%</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-14">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={fadeUp} custom={1}>
            <h2 className="text-2xl md:text-3xl font-bold">Core Features</h2>
            <p className="mt-2 text-white/70 max-w-xl">
              We grouped features into modules so the workflow is easy to understand and demo-ready.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="mt-8 grid lg:grid-cols-3 gap-5"
          >
            {categories.map((c, i) => (
              <CategoryCard key={i} icon={c.icon} title={c.title} points={c.points} />
            ))}
          </motion.div>
        </section>

        {/* Demo Timeline */}
        <section id="demo" className="mx-auto max-w-6xl px-4 pb-14">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
            <h2 className="text-2xl md:text-3xl font-bold">Demo Timeline</h2>
            <p className="mt-2 text-white/70">Upload → AI detects moments → review clips → get feedback and dashboard insights.</p>

            <div className="mt-2 text-xs text-white/45">
              Estimated processing time: <span className="text-white/65">2-5 minutes</span> depending on video length
            </div>

            <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {steps.map((x, i) => (
                <StepCard key={i} idx={i} icon={x.icon} title={x.title} desc={x.desc} />
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="mx-auto max-w-6xl px-4 pb-14">
          <h2 className="text-2xl md:text-3xl font-bold">Testimonials</h2>
          <p className="mt-2 text-white/70 max-w-xl">Real feedback from athletes and coaches using SportVision AI.</p>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="mt-8 grid md:grid-cols-3 gap-5"
          >
            {testimonials.map((t, i) => (
              <TestimonialCard key={i} name={t.name} role={t.role} sport={t.sport} msg={t.msg} outcome={t.outcome} />
            ))}
          </motion.div>
        </section>

        {/* CTA */}
        <section id="cta" className="mx-auto max-w-6xl px-4 pb-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-3xl border border-white/20 p-8 md:p-10 shadow-2xl hover:border-white/30 transition-all duration-300"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <h3 className="text-2xl md:text-3xl font-bold gradient-text">Ready to improve your athletic performance?</h3>
                <p className="mt-2 text-white/70 max-w-xl">
                  Create an account, upload any sports video, and explore insights with our AI-powered dashboard.
                </p>
              </div>

              <div className="flex gap-4 flex-wrap">
                <Link
                  to="/register"
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Create Account
                </Link>
                <Link
                  to="/login"
                  className="px-6 py-3 rounded-2xl glass border border-white/20 hover:bg-white/10 transition-all duration-300 transform hover:scale-105"
                >
                  Sign In
                </Link>
              </div>
            </div>

            <div className="mt-8 text-xs text-white/50 flex items-center gap-2">
              <span>✨</span>
              SportVision AI • Multi-sport • AI-Powered Analysis
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <p className="text-sm text-white/60">© {new Date().getFullYear()} SportVision AI • Advanced Sports Analytics</p>

            <div className="flex gap-4 text-sm text-white/60 flex-wrap">
              <a className="hover:text-white transition" href="#features">
                Features
              </a>
              <a className="hover:text-white transition" href="#demo">
                Demo
              </a>
              <a className="hover:text-white transition" href="#testimonials">
                Testimonials
              </a>

              <span className="text-white/30">•</span>
              <span className="text-white/50">Professional Analytics Platform</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
