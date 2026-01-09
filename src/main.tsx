import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyStoredTheme } from './theme'
import { ThemeProvider } from './hooks/useTheme'

(globalThis as Record<string, unknown>).__SCREENFISH_WEB_BUILD__ = '2026-01-08'

applyStoredTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
