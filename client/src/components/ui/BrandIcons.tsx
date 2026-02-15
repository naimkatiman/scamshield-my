import React from 'react'

interface BrandIconProps {
  className?: string
  size?: number
}

export function TelegramIcon({ className = "", size = 16 }: BrandIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM17.56 7.75L15.54 16.79C15.46 17.14 15.13 17.38 14.76 17.38C14.35 17.38 14 17.08 13.93 16.68L13 12L9.5 10.5L6.44 8.56C6.16 8.38 6 8.06 6 7.71C6 7.32 6.32 7 6.71 7L16.79 6.44C17.18 6.44 17.5 6.76 17.5 7.15C17.5 7.38 17.41 7.59 17.25 7.75H17.56Z" 
        fill="currentColor"
      />
    </svg>
  )
}

export function GoogleIcon({ className = "", size = 16 }: BrandIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" 
        fill="#4285F4"
      />
      <path 
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" 
        fill="#34A853"
      />
      <path 
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" 
        fill="#FBBC05"
      />
      <path 
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" 
        fill="#EA4335"
      />
    </svg>
  )
}

export function CoinGeckoIcon({ className = "", size = 16 }: BrandIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="10" fill="#00D4AA"/>
      <path 
        d="M8 12C8 10.5 9.5 9 11 9H13C14.5 9 16 10.5 16 12C16 13.5 14.5 15 13 15H11C9.5 15 8 13.5 8 12Z" 
        fill="white"
      />
      <circle cx="10" cy="11" r="1" fill="#00D4AA"/>
      <circle cx="14" cy="13" r="1" fill="#00D4AA"/>
    </svg>
  )
}

export function WhatsAppIcon({ className = "", size = 16 }: BrandIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.58 20 4 16.42 4 12C4 7.58 7.58 4 12 4C16.42 4 20 7.58 20 12C20 16.42 16.42 20 12 20Z" 
        fill="#25D366"
      />
      <path 
        d="M17.5 11.97C17.5 9.49 15.5 7.5 13.03 7.5H10.97C8.49 7.5 6.5 9.49 6.5 11.97V14.03C6.5 16.51 8.49 18.5 10.97 18.5H13.03C15.5 18.5 17.5 16.51 17.5 14.03V11.97Z" 
        fill="#25D366"
      />
      <path 
        d="M8.5 15.5L9.5 14.5C10.5 13.5 11.5 13.5 12.5 14.5L13.5 15.5C14.5 16.5 15.5 16.5 16.5 15.5V14.5C16.5 13.5 15.5 12.5 14.5 12.5H9.5C8.5 12.5 7.5 13.5 7.5 14.5V15.5C7.5 16.5 8.5 16.5 8.5 15.5Z" 
        fill="white"
      />
    </svg>
  )
}

export function FacebookIcon({ className = "", size = 16 }: BrandIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" 
        fill="#1877F2"
      />
    </svg>
  )
}

export function InstagramIcon({ className = "", size = 16 }: BrandIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z" 
        fill="currentColor"
      />
      <path 
        d="M12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a3.999 3.999 0 110-7.998 3.999 3.999 0 010 7.998z" 
        fill="currentColor"
      />
      <circle cx="18.406" cy="5.594" r="1.44" fill="currentColor"/>
    </svg>
  )
}

export function TikTokIcon({ className = "", size = 16 }: BrandIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16.5 8.5C16.5 10.5 15.5 11.5 13.5 11.5V13.5C15.5 13.5 16.5 14.5 16.5 16.5V17.5C16.5 18.5 15.5 19.5 14.5 19.5H9.5C8.5 19.5 7.5 18.5 7.5 17.5V6.5C7.5 5.5 8.5 4.5 9.5 4.5H14.5C15.5 4.5 16.5 5.5 16.5 6.5V8.5Z" 
        fill="currentColor"
      />
      <path 
        d="M14 8H13V11H14V8Z" 
        fill="white"
      />
      <path 
        d="M10 6V16H14V14H12V6H10Z" 
        fill="white"
      />
    </svg>
  )
}

export function XIcon({ className = "", size = 16 }: BrandIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" 
        fill="currentColor"
      />
    </svg>
  )
}

export function ShopeeIcon({ className = "", size = 16 }: BrandIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM8 7H16C16.5 7 17 7.5 17 8V16C17 16.5 16.5 17 16 17H8C7.5 17 7 16.5 7 16V8C7 7.5 7.5 7 8 7Z" 
        fill="#EE4D2D"
      />
      <path 
        d="M9 9H15V15H9V9Z" 
        fill="white"
      />
      <circle cx="10.5" cy="10.5" r="1" fill="#EE4D2D"/>
      <circle cx="13.5" cy="13.5" r="1" fill="#EE4D2D"/>
    </svg>
  )
}
