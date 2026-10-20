import { StrictMode } from 'react'
import { render } from '@testing-library/react'
import App from '../../../src/CadernoAtlas.Web/src/App'

export function renderApp({ strict = false } = {}) {
  const application = strict ? <StrictMode><App /></StrictMode> : <App />
  return render(application)
}