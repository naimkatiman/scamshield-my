import { motion } from 'framer-motion'
import { TelegramIcon } from '../ui/BrandIcons'

export function ChatFAB() {
  return (
    <motion.a
      href="https://t.me/ScamShieldMY"
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-6 left-6 z-[9000] flex h-12 w-12 items-center justify-center rounded-full bg-[#0088cc] text-white shadow-lg shadow-[#0088cc]/30 hover:bg-[#0088cc]/90 transition-colors"
      aria-label="Join Telegram Support Group"
    >
      <TelegramIcon size={22} />
    </motion.a>
  )
}
