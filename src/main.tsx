import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyStoredTheme } from './theme'
import { ThemeProvider } from './hooks/useTheme'

const build =
  String(
    import.meta.env.VITE_BUILD_TIME ??
      import.meta.env.VITE_BUILD_SHA ??
      import.meta.env.VITE_APP_VERSION ??
      ''
  ).trim() || 'unknown'

;(globalThis as Record<string, unknown>).__SCREENFISH_WEB_BUILD__ = build

applyStoredTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
