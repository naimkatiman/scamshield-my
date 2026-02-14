import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X } from 'lucide-react'
import { ChatDrawer } from './ChatDrawer'

export function ChatFAB() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* FAB Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 left-6 z-[9000] flex h-12 w-12 items-center justify-center rounded-full bg-cyber text-noir-950 shadow-lg shadow-cyber/30 hover:bg-cyber-bright transition-colors"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X size={20} />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MessageCircle size={20} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Drawer */}
      <AnimatePresence>
        {open && <ChatDrawer onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  )
}
