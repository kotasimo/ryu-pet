import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ModelApp from './model/ModelApp'
import './style.css'

const isAnalysisRoute = window.location.pathname.replace(/\/$/, '') === '/analyze'
createRoot(document.getElementById('root')!).render(<React.StrictMode>{isAnalysisRoute ? <App /> : <ModelApp />}</React.StrictMode>)
