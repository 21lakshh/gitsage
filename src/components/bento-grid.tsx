"use client"

import { motion, useInView, type Variants } from "framer-motion"
import { useRef } from "react"
import { GitCommit, Users, Network, TrendingDown, GitMerge } from "lucide-react"

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
}

// --- SUB-COMPONENTS ---

function TargetPRCard() {
  return (
    <motion.div
      variants={itemVariants}
      className="md:col-span-2 group relative p-8 rounded-[2rem] bg-zinc-950/50 border border-white/10 hover:border-white/20 transition-all duration-500 overflow-hidden"
    >
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#58a6ff]/15 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#a855f7]/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/3 opacity-30 group-hover:opacity-60 transition-opacity duration-700" />

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[32px_32px] mask-[radial-gradient(ellipse_70%_70%_at_70%_50%,#000_10%,transparent_100%)] pointer-events-none opacity-40 group-hover:opacity-80 transition-opacity duration-500" />

      <div className="relative z-10 flex flex-col md:flex-row h-full gap-8">
        {/* Left Side: Content */}
        <div className="flex flex-col justify-between flex-1 max-w-sm">
          <div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 w-fit mb-6 shadow-inner backdrop-blur-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-linear-to-br from-[#58a6ff]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <Network className="w-6 h-6 text-[#58a6ff] relative z-10" />
            </div>
            <h3 className="text-2xl font-medium text-white mb-3 tracking-tight">
              Target the right PR reviewers
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Find the developer who has been shaping the code that changed most recently, rather than pinging a teammate who touched it a year ago.
            </p>
          </div>

          <div className="hidden md:flex items-center gap-3 mt-8">
            <div className="flex -space-x-2">
              <img src="https://github.com/shadcn.png" className="w-8 h-8 rounded-full border-2 border-zinc-950" alt="" />
              <img src="https://github.com/leerob.png" className="w-8 h-8 rounded-full border-2 border-zinc-950" alt="" />
              <div className="w-8 h-8 rounded-full border-2 border-zinc-950 bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 font-medium">+3</div>
            </div>
            <span className="text-xs text-zinc-500 font-medium">Mapped from GitHub history</span>
          </div>
        </div>

        {/* Right Side: Animated Graph */}
        <div className="flex-1 relative min-h-[300px] md:min-h-full flex items-center justify-center mt-8 md:mt-0">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="lineGrad1" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#58a6ff" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#58a6ff" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="lineGrad2" x1="1" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="lineGrad3" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.1" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Connecting Lines with flow animations */}
            <motion.path
              d="M 200 150 Q 140 100 80 80"
              stroke="url(#lineGrad1)"
              strokeWidth="2"
              fill="none"
              className="opacity-40 group-hover:opacity-60 transition-opacity duration-500"
            />
            <motion.path
              d="M 200 150 Q 140 100 80 80"
              stroke="#58a6ff"
              strokeWidth="2"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: [0, 1, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              filter="url(#glow)"
            />

            <motion.path
              d="M 200 150 Q 250 110 320 80"
              stroke="url(#lineGrad2)"
              strokeWidth="2"
              fill="none"
              className="opacity-30 group-hover:opacity-50 transition-opacity duration-500"
            />
            <motion.path
              d="M 200 150 Q 250 110 320 80"
              stroke="#10b981"
              strokeWidth="2"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: [0, 1, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              filter="url(#glow)"
            />

            <motion.path
              d="M 200 150 Q 170 200 120 250"
              stroke="url(#lineGrad3)"
              strokeWidth="2"
              fill="none"
              className="opacity-20 group-hover:opacity-40 transition-opacity duration-500"
            />
            <motion.path
              d="M 200 150 Q 170 200 120 250"
              stroke="#a855f7"
              strokeWidth="2"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: [0, 1, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              filter="url(#glow)"
            />

            {/* Orbiting particles around center */}
            <motion.g
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: "200px 150px" }}
            >
              <circle cx="160" cy="150" r="1.5" fill="#58a6ff" className="opacity-80" filter="url(#glow)" />
              <circle cx="240" cy="150" r="1.5" fill="#10b981" className="opacity-80" filter="url(#glow)" />
              <circle cx="200" cy="110" r="1.5" fill="#a855f7" className="opacity-80" filter="url(#glow)" />
            </motion.g>
          </svg>

          {/* Graph Nodes */}

          {/* Node 1: Dev Lead */}
          <motion.div
            className="absolute top-[18%] left-[12%] group/node z-20"
            whileHover={{ scale: 1.05 }}
          >
            <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-900/90 backdrop-blur-md border border-[#58a6ff]/40 shadow-[0_0_20px_rgba(88,166,255,0.15)] group-hover/node:shadow-[0_0_25px_rgba(88,166,255,0.3)] group-hover/node:border-[#58a6ff]/60 transition-all">
              <img src="https://github.com/shadcn.png" alt="Dev" className="w-9 h-9 rounded-lg opacity-90" />
              <div className="absolute -bottom-8 whitespace-nowrap px-2.5 py-1 rounded-md bg-zinc-900/95 border border-zinc-800 text-[10px] text-zinc-300 opacity-0 group-hover/node:opacity-100 transition-opacity shadow-xl z-50 pointer-events-none">
                <span className="text-[#58a6ff] font-medium">95%</span> ownership
              </div>
            </div>
            {/* Ping animation */}
            <motion.div
              className="absolute inset-0 rounded-xl border border-[#58a6ff]"
              animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 0 }}
            />
          </motion.div>

          {/* Node 2: CI/CD Bot or Another Dev */}
          <motion.div
            className="absolute top-[15%] right-[12%] group/node z-20"
            whileHover={{ scale: 1.05 }}
          >
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-900/90 backdrop-blur-md border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.1)] group-hover/node:shadow-[0_0_20px_rgba(16,185,129,0.2)] group-hover/node:border-emerald-500/60 transition-all">
              <img src="https://github.com/leerob.png" alt="Dev" className="w-7 h-7 rounded-lg opacity-90" />
              <div className="absolute -bottom-8 whitespace-nowrap px-2.5 py-1 rounded-md bg-zinc-900/95 border border-zinc-800 text-[10px] text-zinc-300 opacity-0 group-hover/node:opacity-100 transition-opacity shadow-xl z-50 pointer-events-none">
                <span className="text-emerald-400 font-medium">Auto</span> review
              </div>
            </div>
            <motion.div
              className="absolute inset-0 rounded-xl border border-emerald-500"
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0] }}
              transition={{ duration: 3, repeat: Infinity, delay: 1 }}
            />
          </motion.div>

          {/* Node 3: Another Dev */}
          <motion.div
            className="absolute bottom-[10%] left-[22%] group/node z-20"
            whileHover={{ scale: 1.05 }}
          >
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-900/90 backdrop-blur-md border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.1)] group-hover/node:shadow-[0_0_20px_rgba(168,85,247,0.2)] transition-all">
              <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-medium text-purple-400">
                JD
              </div>
              <div className="absolute -bottom-8 whitespace-nowrap px-2.5 py-1 rounded-md bg-zinc-900/95 border border-zinc-800 text-[10px] text-zinc-300 opacity-0 group-hover/node:opacity-100 transition-opacity shadow-xl z-50 pointer-events-none">
                <span className="text-purple-400 font-medium">Stale</span> code
              </div>
            </div>
          </motion.div>

          {/* Central Target Node: The PR Target */}
          <motion.div
            className="absolute w-24 h-24 rounded-2xl bg-zinc-950/90 backdrop-blur-md border border-[#58a6ff]/50 group-hover:border-[#58a6ff]/80 flex flex-col items-center justify-center z-30 shadow-[0_0_30px_rgba(88,166,255,0.2)] group-hover:shadow-[0_0_40px_rgba(88,166,255,0.3)] transition-all duration-500"
            animate={{
              y: [-3, 3, -3],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-[#58a6ff]/20 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <div className="bg-zinc-900/90 p-2 rounded-xl mb-1.5 border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="m9 15 2 2 4-4" /></svg>
            </div>
            <span className="text-[11px] font-mono font-medium tracking-tight text-white/90">/src/core</span>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}

function DecayCurve() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  return (
    <svg ref={ref} viewBox="0 0 100 60" className="w-full h-24 mt-4 overflow-visible">
      <defs>
        <linearGradient id="decayGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#58a6ff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#58a6ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {isInView && (
        <>
          <line x1="0" y1="60" x2="100" y2="60" stroke="#333" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="0" y1="0" x2="0" y2="60" stroke="#333" strokeWidth="1" strokeDasharray="2 2" />
          <path d="M 0 0 Q 30 50 100 58 L 100 60 L 0 60 Z" fill="url(#decayGrad)" />
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            d="M 0 0 Q 30 50 100 58"
            fill="none"
            stroke="#58a6ff"
            strokeWidth="2"
          />
        </>
      )}
    </svg>
  )
}

function RiskIndicator() {
  return (
    <div className="mt-6 flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-zinc-400">/src/lib/utils.ts</span>
        <span className="text-red-400">CRITICAL</span>
      </div>
      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden flex">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "74%" }}
          transition={{ duration: 1, delay: 0.5 }}
          className="h-full bg-red-500/80"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "26%" }}
          transition={{ duration: 1, delay: 0.7 }}
          className="h-full bg-zinc-600"
        />
      </div>
      <div className="flex justify-between text-[10px] text-zinc-500">
        <span>Owner covers &gt;70%</span>
        <span>Bus Factor: 1</span>
      </div>
    </div>
  )
}

function GitHistoryAnimation() {
  return (
    <div className="mt-6 h-16 relative flex items-center">
      <div className="absolute w-full h-[2px] bg-zinc-800 top-1/2 -translate-y-1/2" />
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
        className="absolute w-full h-[2px] bg-emerald-500/50 top-1/2 -translate-y-1/2 origin-left"
      />
      {[0, 40, 80].map((left, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: i * 0.4 + 0.5, type: "spring" }}
          className="absolute w-3 h-3 rounded-full bg-zinc-900 border-2 border-emerald-400 top-1/2 -translate-y-1/2"
          style={{ left: `${left}%` }}
        />
      ))}
    </div>
  )
}

// --- MAIN GRID COMPONENT ---

export function BentoGrid() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section id="features" className="py-24 px-4 bg-[#050505] relative z-20">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="font-mono text-xs tracking-[0.3em] text-[#58a6ff] mb-4 uppercase">Analytics</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-white mb-4">
            Always-current ownership <span className="italic font-serif text-zinc-400">intelligence</span>
          </h2>
          <p className="font-mono text-sm tracking-wider text-zinc-500 max-w-2xl mx-auto uppercase">
            gitsage combines GitHub history, recency scoring, and a visual repo graph.
          </p>
        </motion.div>

        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {/* Target PR Reviewers Hero Card */}
          <TargetPRCard />

          {/* Bus Factor */}
          <motion.div
            variants={itemVariants}
            className="group relative p-8 rounded-4xl bg-zinc-950/50 border border-white/5 hover:bg-white/4 transition-colors"
          >
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 w-fit mb-5">
              <Users className="w-5 h-5 text-red-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Expose bus-factor risk</h3>
            <p className="text-zinc-400 text-sm">Surface fragile modules that hinge on one person covering the vast majority of recent edits.</p>
            <RiskIndicator />
          </motion.div>

          {/* Recency Scoring */}
          <motion.div
            variants={itemVariants}
            className="group relative p-8 rounded-4xl bg-zinc-950/50 border border-white/5 hover:bg-white/4 transition-colors"
          >
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 w-fit mb-5">
              <TrendingDown className="w-5 h-5 text-zinc-300" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Recency-weighted Math</h3>
            <p className="text-zinc-400 text-sm">
              Commits degrade over a 45-day half-life. A massive rewrite from two years ago yields to a targeted refactor from yesterday.
            </p>
            <DecayCurve />
          </motion.div>

          {/* Git Sync */}
          <motion.div
            variants={itemVariants}
            className="group relative p-8 rounded-4xl bg-zinc-950/50 border border-white/5 hover:bg-white/4 transition-colors"
          >
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 w-fit mb-5">
              <GitCommit className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Live GitHub History</h3>
            <p className="text-zinc-400 text-sm">
              Syncs natively via Octokit. We pull the raw Git tree and process file-level diffs to map ownership.
            </p>
            <GitHistoryAnimation />
          </motion.div>

          {/* Context Onboarding */}
          <motion.div
            variants={itemVariants}
            className="group relative p-8 rounded-4xl bg-zinc-950/50 border border-white/5 hover:bg-white/4 transition-colors"
          >
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 w-fit mb-5">
              <GitMerge className="w-5 h-5 text-zinc-300" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Onboard with context</h3>
            <p className="text-zinc-400 text-sm">
              Give new engineers a live map of domain experts across the repo without asking anyone to maintain stale markdown docs.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-full text-zinc-300">File Tree</span>
              <span className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-full text-zinc-300">Line Count</span>
              <span className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-full text-zinc-300">Heatmaps</span>
            </div>
          </motion.div>

        </motion.div>
      </div>
    </section>
  )
}