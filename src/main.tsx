import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/maven-pro/400.css'
import '@fontsource/maven-pro/500.css'
import '@fontsource/maven-pro/600.css'
import '@fontsource/inter/600.css'
import './styles.css'
import { applyMotionVariables } from './motion'
import Prototype from './App'
import TestApp from './test/TestApp'
import type { ScreenId } from './state'

applyMotionVariables()

// The link participants get (/) runs the usability test.
// Review shortcuts (nothing is saved): ?prototype opens the bare prototype, ?screen=requests jumps to a screen.
// ?mode=moderated or ?mode=pilot tags a test session.
// ?results opens the private results page (sign-in required); loaded separately so participants never download it.
const params = new URLSearchParams(location.search)
const ResultsApp = lazy(() => import('./results/ResultsApp'))
const review = params.has('screen') || params.has('prototype')
const start = (params.get('screen') as ScreenId | null) ?? 'home'
const jumpedPastBooking = !['home', 'find', 'bookCourt', 'club'].includes(start)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {params.has('results') ? (
      <Suspense fallback={null}><ResultsApp /></Suspense>
    ) : review ? (
      <div className="stage">
        <Prototype start={start} initialConfig={jumpedPastBooking ? { time: '18:30', gender: 'any' } : undefined} />
      </div>
    ) : (
      <TestApp />
    )}
  </StrictMode>,
)
