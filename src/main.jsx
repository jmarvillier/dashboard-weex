import { StrictMode } from 'react'
import { createRoot }  from 'react-dom/client'
import './styles/variables.css'
import './styles/shell.css'        // ← Layout principal (sidebar + topbar)
import './styles/dashboard.css'   // ← KPI, tables, cards
import './styles/data-panel.css'  // ← Landing, DataPanel, PairesView
import './styles/entry-form.css'  // ← EntryForm, ExportXlsx
import './styles/data-menu.css'   // ← DataBrowser
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
