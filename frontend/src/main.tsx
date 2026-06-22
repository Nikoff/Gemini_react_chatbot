import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './App.css'
// Import the context provider we created earlier
import { StatsProvider } from './context/StatsContext.tsx' 

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StatsProvider>
      <App />
    </StatsProvider>
  </React.StrictMode>,
)