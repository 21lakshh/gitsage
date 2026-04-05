"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { signInWithGitHubAction, signOutAction } from "@/src/actions/auth"
import { Github } from "lucide-react"

export function Navbar({ isLoggedIn }: { isLoggedIn?: boolean }) {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? "bg-background/80 backdrop-blur-md border-b border-border" : ""
          }`}
      >
        <nav className="flex items-center justify-between px-6 py-4 my-0 md:px-12 md:py-5">
          {/* Logo */}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              window.scrollTo({ top: 0, behavior: "smooth" })
            }}
            className="group flex items-center gap-2"
          >
            <span className="font-mono text-xs tracking-widest text-muted-foreground">gitsage</span>
            <span className="w-1.5 h-1.5 rounded-full bg-accent group-hover:scale-150 transition-transform duration-300" />
          </a>

          {/* GitHub Action Connect */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-3 mr-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="font-mono text-xs tracking-wider text-muted-foreground">SYSTEM ONLINE</span>
            </div>

            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                <form action={signOutAction}>
                  <motion.button
                    type="submit"
                    data-cursor-hover
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="relative flex items-center gap-2 px-5 py-2 border border-white/20 rounded-full font-mono text-[10px] tracking-widest uppercase bg-transparent backdrop-blur-sm hover:bg-white hover:text-red-600 transition-colors duration-500 text-red-400"
                  >
                    Logout
                  </motion.button>
                </form>
              </div>
            ) : (
              <form action={signInWithGitHubAction}>
                <motion.button
                  type="submit"
                  data-cursor-hover
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative flex items-center gap-2 px-5 py-2 border border-white/20 rounded-full font-mono text-[10px] tracking-widest uppercase bg-transparent backdrop-blur-sm hover:bg-white hover:text-black transition-colors duration-500"
                >
                  <Github className="w-3 h-3" />
                  Connect
                </motion.button>
              </form>
            )}
          </div>
        </nav>
      </motion.header>
    </>
  )
}
