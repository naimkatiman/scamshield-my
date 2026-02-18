import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Shield, Globe, LogIn, LogOut, User, LayoutDashboard, Activity, Trophy, Home, Menu, X, type LucideIcon } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useLocale } from '../../context/LocaleContext'
import { cn } from '../../lib/utils'
import { ROUTES } from '../../lib/constants'

interface NavLinkItem {
  to: string
  label: string
  icon: LucideIcon
}

export function Header() {
  const { user, isAuthenticated, quota, login, logout } = useAuth()
  const { locale, setLocale, t } = useLocale()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = useMemo<NavLinkItem[]>(() => {
    const links: NavLinkItem[] = [
      { to: ROUTES.HOME, label: t('nav.home'), icon: Home },
      { to: ROUTES.CHECK, label: t('nav.manual_toolkit'), icon: Activity },
      { to: ROUTES.INTELLIGENCE, label: t('nav.intelligence'), icon: Activity },
      { to: ROUTES.LEADERBOARD, label: t('nav.leaderboard'), icon: Trophy },
    ]

    if (isAuthenticated) {
      links.push({ to: ROUTES.DASHBOARD, label: t('nav.dashboard'), icon: LayoutDashboard })
    }

    return links
  }, [isAuthenticated, t])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const toggleLocale = () => {
    setLocale(locale === 'en' ? 'bm' : 'en')
  }

  const isActiveRoute = (target: string) => {
    if (target === ROUTES.HOME) return location.pathname === ROUTES.HOME
    return location.pathname === target || location.pathname.startsWith(`${target}/`)
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-50 border-b border-white/[0.06] bg-noir-950/85 px-4 py-3 backdrop-blur-xl"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-3">
          <Link to={ROUTES.HOME} className="group flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full border border-cyber/30 bg-cyber/10">
              <Shield size={18} className="text-cyber" />
              <span className="live-dot absolute -right-0.5 -top-0.5 !h-2.5 !w-2.5" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-lg font-bold text-slate-200 transition-colors group-hover:text-white">
                SCAM<span className="text-cyber">SHIELD</span>
              </span>
              <span className="font-mono text-[10px] tracking-wider text-slate-600">MY</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => {
              const Icon = link.icon
              const active = isActiveRoute(link.to)

              return (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs tracking-wide transition-all',
                    active
                      ? 'border-cyber/30 bg-cyber/[0.08] text-cyber'
                      : 'border-transparent text-slate-500 hover:border-white/[0.08] hover:bg-white/[0.03] hover:text-slate-200'
                  )}
                >
                  <Icon size={12} />
                  {link.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            {quota && (
              <span className="hidden items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1 font-mono text-[10px] text-slate-500 sm:flex">
                <span className="text-slate-400">{quota.used}</span>/<span>{quota.limit}</span>
              </span>
            )}

            <button
              onClick={toggleLocale}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-mono text-[10px] text-slate-400 transition-all hover:border-white/20 hover:text-slate-200"
              aria-label="Switch language"
            >
              <Globe size={12} />
              {locale === 'en' ? 'BM' : 'EN'}
            </button>

            <div className="hidden md:flex md:items-center md:gap-2">
              {isAuthenticated ? (
                <>
                  <span className="hidden items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1 font-mono text-[10px] text-slate-500 lg:flex">
                    <User size={11} />
                    {user?.email?.split('@')[0]}
                  </span>
                  <button
                    onClick={logout}
                    className="rounded-lg border border-white/10 p-1.5 text-slate-500 transition-all hover:border-white/20 hover:text-slate-300"
                    aria-label={t('nav.signout')}
                  >
                    <LogOut size={14} />
                  </button>
                </>
              ) : (
                <button
                  onClick={login}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] text-slate-400 transition-all hover:border-white/20 hover:text-slate-200"
                >
                  <LogIn size={12} />
                  {t('nav.signin')}
                </button>
              )}
            </div>

            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex items-center rounded-lg border border-white/10 p-1.5 text-slate-400 transition-all hover:border-white/20 hover:text-slate-200 md:hidden"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mt-3 rounded-xl border border-white/[0.08] bg-noir-900/95 p-2 md:hidden"
            >
              <nav className="space-y-1">
                {navLinks.map((link) => {
                  const Icon = link.icon
                  const active = isActiveRoute(link.to)

                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-xs transition-all',
                        active
                          ? 'border-cyber/30 bg-cyber/[0.08] text-cyber'
                          : 'border-transparent text-slate-400 hover:border-white/[0.08] hover:bg-white/[0.03] hover:text-slate-200'
                      )}
                    >
                      <Icon size={12} />
                      {link.label}
                    </Link>
                  )
                })}
              </nav>

              <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3">
                {isAuthenticated ? (
                  <>
                    <div className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[11px] text-slate-400">
                      {user?.email?.split('@')[0]}
                    </div>
                    <button
                      onClick={logout}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 font-mono text-[11px] text-slate-400 transition-all hover:border-white/20 hover:text-slate-200"
                    >
                      <LogOut size={13} />
                      {t('nav.signout')}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={login}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[11px] text-slate-400 transition-all hover:border-white/20 hover:text-slate-200"
                  >
                    <LogIn size={13} />
                    {t('nav.signin')}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  )
}
