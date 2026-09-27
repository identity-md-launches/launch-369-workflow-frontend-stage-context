import { createRoot } from 'react-dom/client'
import App from './App'
import { loadConfig } from './config'
import { errorMessage } from './chain'
import './styles.css'

const root = createRoot(document.getElementById('root')!)
root.render(<main className="boot" role="status"><span className="eyebrow">Gradients</span><h1>Finding your spectrum.</h1><p>Loading the verified deployment configuration…</p></main>)
loadConfig().then(config => root.render(<App config={config} />)).catch(error => {
  root.render(<main className="boot"><span className="eyebrow">Gradients</span><h1>Unable to load the collection.</h1><p role="alert">{errorMessage(error)}</p><button onClick={() => location.reload()}>Reload configuration</button></main>)
})
