import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

if (location.hash === '#thumbs') {
  // hidden window: no UI, only renders thumbnails
  import('./lib/thumbWorker').then((m) => m.startThumbWorker())
} else {
  import('./App').then(({ default: App }) => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>
    )
  })
}