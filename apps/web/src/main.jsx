import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { applyZLayers } from './state/derive.js'

/* Before render, so no first frame resolves a layer to `auto`. */
applyZLayers(document.documentElement)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
