import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import PublicRfiPage from './PublicRfiPage.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>{window.location.pathname.startsWith('/rfi/respond') ? <PublicRfiPage /> : <App />}</React.StrictMode>,
)

