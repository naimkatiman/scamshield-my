import { motion } from 'framer-motion'
import Lottie from 'lottie-react'
import loadingScanData from '../../assets/lottie/loading-scan.json'

export function VerdictLoading() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex flex-col items-center py-16"
    >
      <div className="w-24 h-24 mb-6">
        <Lottie animationData={loadingScanData} loop className="w-full h-full" />
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="font-mono text-sm text-cyber/70 tracking-wider"
      >
        Scanning threat databases...
      </motion.p>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: '200px' }}
        transition={{ duration: 1.8, ease: 'linear' }}
        className="mt-4 h-0.5 rounded-full bg-gradient-to-r from-transparent via-cyber to-transparent"
      />
    </motion.div>
  )
}
