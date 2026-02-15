import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Globe, LogIn, LogOut, User, LayoutDashboard, Activity, Trophy } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useLocale } from '../../context/LocaleContext'
import { cn } from '../../lib/utils'
import { ROUTES } from '../../lib/constants'

export function Header() {
  const { user, isAuthenticated, quota, login, logout } = useAuth()
  const { locale, setLocale, t } = useLocale()
  const location = useLocation()

  const navLinks = [
    { to: ROUTES.HOME, label: t('nav.home'), icon: Shield },
    { to: ROUTES.CHECK, label: t('nav.manual_toolkit'), icon: Activity },
    { to: ROUTES.INTELLIGENCE, label: t('nav.intelligence'), icon: Activity },
    { to: ROUTES.LEADERBOARD, label: t('nav.leaderboard'), icon: Trophy },
  ]

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-50 glass-card !rounded-none border-x-0 border-t-0 px-4 py-3"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full border border-cyber/30 bg-cyber/10">
            <Shield size={18} className="text-cyber" />
            <span className="live-dot absolute -top-0.5 -right-0.5 !h-2.5 !w-2.5" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-lg font-bold text-slate-200 group-hover:text-white transition-colors">
              SCAM<span className="text-cyber">SHIELD</span>
            </span>
            <span className="font-mono text-[10px] text-slate-600 tracking-wider">MY</span>
          </div>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(link => {
            const active = location.pathname === link.to
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'relative px-3 py-1.5 rounded-lg font-mono text-xs tracking-wide transition-colors',
                  active ? 'text-cyber' : 'text-slate-500 hover:text-slate-300'
                )}
              >
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 rounded-lg bg-cyber/[0.08] border border-cyber/20"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <span className="relative z-10">{link.label}</span>
              </Link>
            )
          })}
          {isAuthenticated && (
            <Link
              to={ROUTES.DASHBOARD}
              className={cn(
                'relative px-3 py-1.5 rounded-lg font-mono text-xs tracking-wide transition-colors',
                location.pathname === ROUTES.DASHBOARD ? 'text-cyber' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <span className="relative z-10 flex items-center gap-1.5">
                <LayoutDashboard size={12} />
                {t('nav.dashboard')}
              </span>
            </Link>
          )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Quota */}
          {quota && (
            <span className="hidden sm:flex font-mono text-[10px] text-slate-600 items-center gap-1.5">
              {quota.used}/{quota.limit}
            </span>
          )}

          {/* Language toggle */}
          <button
            onClick={() => setLocale(locale === 'en' ? 'bm' : 'en')}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-mono text-[10px] text-slate-400 hover:text-slate-200 hover:border-white/20 transition-all"
          >
            <Globe size={12} />
            {locale === 'en' ? 'BM' : 'EN'}
          </button>

          {/* Auth */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] text-slate-500">
                <User size={12} />
                {user?.email?.split('@')[0]}
              </span>
              <button onClick={logout} className="rounded-lg border border-white/10 p-1.5 text-slate-500 hover:text-slate-300 hover:border-white/20 transition-all">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button onClick={login} className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/10 px-3 py-1.5 font-mono text-[10px] text-slate-400 hover:text-slate-200 hover:border-white/20 transition-all">
              <LogIn size={12} />
              <span className="hidden sm:inline">{t('nav.signin')}</span>
            </button>
          )}
        </div>
      </div>
    </motion.header>
  )
}
