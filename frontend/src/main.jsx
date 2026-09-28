import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { AiAssistantProvider } from './context/AiAssistantContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <LanguageProvider>
        <AuthProvider>
          <AiAssistantProvider>
            <App />
          </AiAssistantProvider>
        </AuthProvider>
      </LanguageProvider>
    </HashRouter>
  </React.StrictMode>,
)
