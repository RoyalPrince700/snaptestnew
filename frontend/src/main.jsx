import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'
import { ConversationProvider } from './contexts/ConversationContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ConversationProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConversationProvider>
    </AuthProvider>
  </StrictMode>,
)
