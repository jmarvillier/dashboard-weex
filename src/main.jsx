import { StrictMode } from 'react'
import { createRoot }  from 'react-dom/client'
import './styles/variables.css'
import './styles/shell.css'
import './styles/landing.css'
import './styles/dashboard.css'
import './styles/data-panel.css'
import './styles/entry-form.css'
import './styles/data-menu.css'
import './styles/pair-card.css'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
