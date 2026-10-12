import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { applyMotionVariables } from './motion'
import Prototype from './App'
import type { ScreenId } from './state'

applyMotionVariables()

// Review shortcut: ?screen=requests opens the prototype at that screen (with a booked match).
const params = new URLSearchParams(location.search)
const start = (params.get('screen') as ScreenId | null) ?? 'home'
const jumpedPastBooking = !['home', 'find', 'bookCourt', 'club'].includes(start)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="stage">
      <Prototype start={start} initialConfig={jumpedPastBooking ? { time: '18:30', gender: 'any' } : undefined} />
    </div>
  </StrictMode>,
)
