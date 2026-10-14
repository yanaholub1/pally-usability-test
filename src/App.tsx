import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Ctx, defaultConfig, type AppCtx, type Decision, type MatchConfig, type ScreenId } from './state'
import { HomeIndicator, StatusBar } from './components/ui'
import { HomeEmpty } from './screens/Home'
import {
  ApprovalScreen, BookCourtScreen, BookedScreen, ClubScreen, FindScreen, GenderScreen, MatchTypeScreen, PaymentScreen, ReviewScreen, VisibilityScreen,
} from './screens/CreateMatch'
import { HomeMatchScreen, MatchDetailsScreen, RequestsScreen } from './screens/Requests'
import { ProfileOverlay } from './screens/Profile'
import { OwnProfileOverlay } from './screens/OwnProfile'
import { requestersFor } from './data'
import { setCurrentScreen, setLastPointer, track } from './log'

const screens: Record<ScreenId, () => React.ReactElement> = {
  home: HomeEmpty,
  find: FindScreen,
  bookCourt: BookCourtScreen,
  club: ClubScreen,
  visibility: VisibilityScreen,
  matchType: MatchTypeScreen,
  gender: GenderScreen,
  approval: ApprovalScreen,
  review: ReviewScreen,
  payment: PaymentScreen,
  booked: BookedScreen,
  homeMatch: HomeMatchScreen,
  matchDetails: MatchDetailsScreen,
  requests: RequestsScreen,
}

/** Screens whose top is blue, so the fake status bar turns white */
const lightStatus: ScreenId[] = ['home', 'homeMatch', 'club', 'review', 'booked', 'matchDetails', 'requests']

type Props = {
  /** Where the prototype starts. The test wrapper sets this per task. */
  start?: ScreenId
  initialConfig?: Partial<MatchConfig>
  onMilestone?: (name: string) => void
  /** The test wrapper keeps the participant's match settings so Task 2 shows their own match */
  onConfig?: (config: MatchConfig) => void
}

export default function Prototype({ start = 'home', initialConfig, onMilestone, onConfig }: Props) {
  const [stack, setStack] = useState<ScreenId[]>([start])
  const [dir, setDir] = useState<'push' | 'pop' | 'fade'>('fade')
  const [nonce, setNonce] = useState(0)
  const [config, setConfigState] = useState<MatchConfig>({ ...defaultConfig, ...initialConfig })
  const [requestsArrived, setRequestsArrived] = useState(start === 'requests' || start === 'matchDetails')
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [profile, setProfile] = useState<string | null>(null)
  const milestones = useRef(new Set<string>())
  // Which Home the tab bar returns to: empty Home before the match is booked, Home with the match after
  const homeScreen = useRef<ScreenId>(['homeMatch', 'matchDetails', 'requests'].includes(start) ? 'homeMatch' : 'home')

  const current = stack[stack.length - 1]
  useEffect(() => { onConfig?.(config) }, [config]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setCurrentScreen(current)
    track('screen_view', current)
  }, [current, nonce])

  const ctx: AppCtx = useMemo(
    () => ({
      config,
      setConfig: (patch) => {
        setConfigState((c) => ({ ...c, ...patch }))
        track('config_change', Object.keys(patch).join(','), patch as Record<string, unknown>)
      },
      push: (id) => { setDir('push'); setStack((s) => [...s, id]); setNonce((n) => n + 1) },
      back: () => {
        setDir('pop')
        setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
        setNonce((n) => n + 1)
      },
      reset: (id) => {
        if (id === 'homeMatch') homeScreen.current = 'homeMatch'
        setDir('fade'); setStack([id]); setNonce((n) => n + 1)
      },
      goTab: (tab) => {
        // Messages and Profile aren't built: the tap is logged by the tab button, nothing else happens
        if (tab !== 'home' && tab !== 'find') return
        const target: ScreenId = tab === 'home' ? homeScreen.current : 'find'
        setStack((s) => {
          if (s[s.length - 1] === target && s.length === 1) return s
          return [target]
        })
        setDir('fade'); setNonce((n) => n + 1)
      },
      requestsArrived,
      setRequestsArrived,
      decisions,
      decide: (id, d) => {
        setDecisions((prev) => {
          const next = { ...prev }
          if (d) next[id] = d
          else delete next[id]
          return next
        })
        track(d ? `request_${d}` : 'request_undo', id)
      },
      openProfile: (id) => setProfile(id),
      milestone: (name) => {
        if (milestones.current.has(name)) return
        milestones.current.add(name)
        track('milestone', name)
        onMilestone?.(name)
      },
    }),
    [config, requestsArrived, decisions, onMilestone],
  )

  // Log taps that land on nothing interactive: they show where people expected something to happen.
  // Only real taps count: the finger must lift close to where it went down (a scroll or swipe isn't a tap).
  const deviceRef = useRef<HTMLDivElement>(null)
  const press = useRef<{ x: number; y: number; at: number; el: HTMLElement } | null>(null)
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const rect = deviceRef.current!.getBoundingClientRect()
    setLastPointer(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height)
    press.current = { x: e.clientX, y: e.clientY, at: performance.now(), el: e.target as HTMLElement }
  }, [])
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const p = press.current
    press.current = null
    if (!p || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10 || performance.now() - p.at > 700) return
    const el = p.el
    if (el.closest('button, a, input, textarea, [role="slider"], [data-track]')) return
    const rect = deviceRef.current!.getBoundingClientRect()
    const label = (el.closest('[aria-label]') as HTMLElement | null)?.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 60) ?? ''
    track('tap_dead', label, { x: Math.round(e.clientX - rect.left), y: Math.round(e.clientY - rect.top), w: Math.round(rect.width), h: Math.round(rect.height) })
  }, [])

  // Scroll depth: when a list stops moving, log how far down it is (and the deepest point reached on this screen)
  useEffect(() => {
    const dev = deviceRef.current
    if (!dev) return
    const deepest = new WeakMap<Element, number>()
    let t: ReturnType<typeof setTimeout> | null = null
    let el: HTMLElement | null = null
    const onScroll = (e: Event) => {
      const target = e.target as HTMLElement
      if (!target || !(target instanceof HTMLElement) || target.scrollHeight <= target.clientHeight) return
      el = target
      if (t) clearTimeout(t)
      t = setTimeout(() => {
        if (!el) return
        const max = el.scrollHeight - el.clientHeight
        const depth = max > 0 ? Math.round((el.scrollTop / max) * 100) : 0
        const prev = deepest.get(el) ?? 0
        if (depth > prev) deepest.set(el, depth)
        track('scroll', el.className.split(' ')[0] || 'scroll', { top: Math.round(el.scrollTop), max: Math.round(max), depth, deepest: Math.max(prev, depth), view_h: el.clientHeight })
      }, 450)
    }
    dev.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => { dev.removeEventListener('scroll', onScroll, { capture: true }); if (t) clearTimeout(t) }
  }, [])

  const Screen = screens[current]
  const profileRequester = profile ? requestersFor(config.gender ?? 'any').find((r) => r.id === profile) : null

  return (
    <Ctx.Provider value={ctx}>
      <div className="device device--framed" ref={deviceRef} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { press.current = null }}>
        <StatusBar light={profile ? true : lightStatus.includes(current)} />
        <div key={`${current}-${nonce}`} className={`screen-host screen--${dir}`} style={{ position: 'absolute', inset: 0 }}>
          <Screen />
        </div>
        {profileRequester && <ProfileOverlay r={profileRequester} returnScreen={current} onClose={() => setProfile(null)} />}
        {profile === 'me' && <OwnProfileOverlay returnScreen={current} onClose={() => setProfile(null)} />}
        <HomeIndicator />
      </div>
    </Ctx.Provider>
  )
}
