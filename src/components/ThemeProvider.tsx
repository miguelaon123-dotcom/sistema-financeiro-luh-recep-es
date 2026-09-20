'use client'

import { useEffect, useState, createContext, useContext } from 'react'

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'light',
  toggle: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  // Lê preferência salva (ou preferência do sistema) ao montar
  useEffect(() => {
    const saved = localStorage.getItem('luh-theme') as Theme | null
    const preferred = saved ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    apply(preferred)
    setTheme(preferred)
  }, [])

  function apply(t: Theme) {
    document.documentElement.classList.toggle('dark', t === 'dark')
  }

  function toggle() {
    setTheme(prev => {
      const next: Theme = prev === 'light' ? 'dark' : 'light'
      apply(next)
      localStorage.setItem('luh-theme', next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}
