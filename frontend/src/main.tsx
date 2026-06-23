import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './App.css'
import './themes.css'
import { StatsProvider } from './context/StatsContext.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <StatsProvider>
          <App />
        </StatsProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
