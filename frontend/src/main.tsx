import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { fetchSettings } from './modules/settings/api'

;(window as Window & { __ANT_APP_BOOTED__?: boolean }).__ANT_APP_BOOTED__ = true
void fetchSettings()

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)

