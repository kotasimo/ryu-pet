import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ModelApp from './model/ModelApp'
import AutonomousApp from './model/AutonomousApp'
import './style.css'

const isAnalysisRoute = window.location.pathname.replace(/\/$/, '') === '/analyze'
const isPetRoute = window.location.pathname.replace(/\/$/, '') === '/pet'
createRoot(document.getElementById('root')!).render(<React.StrictMode>{isAnalysisRoute ? <App /> : isPetRoute ? <ModelApp /> : <AutonomousApp />}</React.StrictMode>)
