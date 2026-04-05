"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { Github } from "lucide-react"
import { signInWithGitHubAction } from "@/src/actions/auth"
import Link from "next/link"

export function FinalCTA({ isLoggedIn }: { isLoggedIn?: boolean }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section className="py-24 px-4 bg-[#050505] relative z-20">
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-4xl mx-auto text-center"
      >
        <h2
          className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight"
          style={{ fontFamily: "var(--font-cal-sans)" }}
        >
          Ready to map your codebase?
        </h2>
        <p className="text-lg sm:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
          Join leading teams already building with gitsage. See who actually owns your code.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          {isLoggedIn ? (
            <Link href="/repositories" className="w-full sm:w-auto">
              <motion.button
                data-cursor-hover
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative flex items-center justify-center gap-3 px-8 py-4 border border-white/20 rounded-full font-mono text-sm tracking-widest uppercase bg-transparent backdrop-blur-sm hover:bg-white hover:text-black transition-colors duration-500 w-full sm:w-auto text-white"
              >
                Go to Dashboard
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              </motion.button>
            </Link>
          ) : (
            <form action={signInWithGitHubAction}>
              <motion.button
                type="submit"
                data-cursor-hover
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative flex items-center justify-center gap-3 px-8 py-4 border border-white/20 rounded-full font-mono text-sm tracking-widest uppercase bg-transparent backdrop-blur-sm hover:bg-white hover:text-black transition-colors duration-500 w-full sm:w-auto text-white"
              >
                <Github className="w-5 h-5" />
                Connect GitHub
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#2563eb] rounded-full animate-pulse" />
              </motion.button>
            </form>
          )}
        </div>

        <p className="mt-8 text-sm text-zinc-500">Free to use for open source repositories.</p>
      </motion.div>
    </section>
  )
}
