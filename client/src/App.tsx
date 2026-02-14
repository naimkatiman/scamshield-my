import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Background } from './components/layout/Background'
import { Header } from './components/layout/Header'
import { Footer } from './components/layout/Footer'
import { ChatFAB } from './components/chat/ChatFAB'
import { Landing } from './pages/Landing'
import { VerdictFlow } from './pages/VerdictFlow'
import { Intelligence } from './pages/Intelligence'
import { Dashboard } from './pages/Dashboard'

const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] as const },
}

export function App() {
  const location = useLocation()

  return (
    <div className="relative min-h-screen">
      <Background />
      <Header />

      <main className="relative z-10">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
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
          </Routes>
        </AnimatePresence>
      </main>

      <Footer />
      <ChatFAB />
    </div>
  )
}
