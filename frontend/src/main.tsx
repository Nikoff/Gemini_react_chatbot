import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './App.css'
import './themes.css'
import { StatsProvider } from './context/StatsContext.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'
import { I18nProvider } from './context/I18nContext.tsx'
import { ErrorBoundaryWrapper } from './components/ErrorBoundaryWrapper'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <ErrorBoundaryWrapper>
        <ThemeProvider>
          <StatsProvider>
            <App />
          </StatsProvider>
        </ThemeProvider>
      </ErrorBoundaryWrapper>
    </I18nProvider>
  </React.StrictMode>,
)
