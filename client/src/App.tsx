import { useEffect } from 'react'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Background } from './components/layout/Background'
import { Header } from './components/layout/Header'
import { Footer } from './components/layout/Footer'
import { ChatFAB } from './components/chat/ChatFAB'
import { Landing } from './pages/Landing'
import { VerdictFlow } from './pages/VerdictFlow'
import { Intelligence } from './pages/Intelligence'
import { Dashboard } from './pages/Dashboard'
import { Leaderboard } from './pages/Leaderboard'
import { CreativeShowcase } from './components/demo/CreativeShowcase'
import { useAuth } from './context/AuthContext'

const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] as const },
}

function ScrollToTopOnRouteChange() {
  const location = useLocation()

  useEffect(() => {
    if (location.hash) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
  }, [location.pathname, location.hash])

  return null
}

export function App() {
  const location = useLocation()
  const { user } = useAuth()

  return (
    <div className="relative min-h-screen">
      <a
        href="#main-content"
        className="sr-only z-[9999] rounded-md bg-cyber px-3 py-2 font-mono text-xs font-semibold text-noir-950 focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <ScrollToTopOnRouteChange />
      <Background />
      <Header />

      <main id="main-content" className="relative z-10 min-h-[calc(100vh-12rem)]">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="/app"
              element={<Navigate to={user ? "/dashboard" : "/"} replace />}
            />
            <Route
              path="/"
              element={
                <motion.div {...pageTransition}>
                  <Landing />
                </motion.div>
              }
            />
            <Route
              path="/check"
              element={
                <motion.div {...pageTransition}>
                  <VerdictFlow />
                </motion.div>
              }
            />
            <Route
              path="/intelligence"
              element={
                <motion.div {...pageTransition}>
                  <Intelligence />
                </motion.div>
              }
            />
            <Route
              path="/dashboard"
              element={
                <motion.div {...pageTransition}>
                  <Dashboard />
                </motion.div>
              }
            />
            <Route
              path="/leaderboard"
              element={
                <motion.div {...pageTransition}>
                  <Leaderboard />
                </motion.div>
              }
            />
            <Route
              path="/showcase"
              element={
                <motion.div {...pageTransition}>
                  <CreativeShowcase />
                </motion.div>
              }
            />
          </Routes>
        </AnimatePresence>
      </main>

      <Footer />
      <ChatFAB />
    </div>
  )
}
