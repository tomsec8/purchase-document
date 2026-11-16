import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import './index.css'

const framed = window.top !== window.self

if (framed) {
  document.getElementById('root')!.textContent = 'Open this page directly, not inside another site.'
} else {
  registerSW({ immediate: true })
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
