/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        noir: {
          950: '#030712',
          900: '#0a0e1a',
          850: '#0f1629',
          800: '#131b2e',
          700: '#1a2340',
          600: '#243052',
          500: '#334155',
        },
        cyber: {
          DEFAULT: '#06b6d4',
          bright: '#22d3ee',
          dim: '#0891b2',
          glow: '#67e8f9',
          muted: '#164e63',
        },
        threat: {
          critical: '#ef4444',
          high: '#f97316',
          medium: '#eab308',
          low: '#22c55e',
          glow: '#fca5a5',
        },
        safe: {
          DEFAULT: '#10b981',
          bright: '#34d399',
          dim: '#059669',
        },
        brand: {
          DEFAULT: '#2563eb',
          light: '#3b82f6',
          dark: '#1d4ed8',
        },
      },
      fontFamily: {
        display: ['Oxanium', 'sans-serif'],
        body: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        scan: 'scan 4s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'slide-in-right': 'slideInRight 0.4s ease-out forwards',
        blink: 'blink 1s step-end infinite',
        'grid-pulse': 'gridPulse 8s ease-in-out infinite',
        'threat-pulse': 'threatPulse 1.5s ease-in-out infinite',
        'data-stream': 'dataStream 20s linear infinite',
        'shield-pulse': 'shieldPulse 3s ease-in-out infinite',
      },
      keyframes: {
        scan: {
          '0%, 100%': { transform: 'translateX(-100%)', opacity: '0' },
          '50%': { transform: 'translateX(100%)', opacity: '0.6' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(-20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        gridPulse: {
          '0%, 100%': { opacity: '0.03' },
          '50%': { opacity: '0.07' },
        },
        threatPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)' },
          '50%': { boxShadow: '0 0 20px 4px rgba(239, 68, 68, 0.3)' },
        },
        dataStream: {
          from: { backgroundPosition: '0 0' },
          to: { backgroundPosition: '0 100%' },
        },
        shieldPulse: {
          '0%, 100%': { transform: 'scale(1)', filter: 'drop-shadow(0 0 8px rgba(6,182,212,0.3))' },
          '50%': { transform: 'scale(1.05)', filter: 'drop-shadow(0 0 20px rgba(6,182,212,0.6))' },
        },
      },
      backgroundImage: {
        'grid-pattern': `linear-gradient(rgba(6, 182, 212, 0.05) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(6, 182, 212, 0.05) 1px, transparent 1px)`,
        noise: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
      },
      backgroundSize: {
        grid: '40px 40px',
      },
    },
  },
  plugins: [],
}
