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
import { setCurrentScreen, track } from './log'

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
  const deviceRef = useRef<HTMLDivElement>(null)
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = e.target as HTMLElement
    if (el.closest('button, a, input, [role="slider"], [data-track]')) return
    const rect = deviceRef.current!.getBoundingClientRect()
    const label = (el.closest('[aria-label]') as HTMLElement | null)?.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 60) ?? ''
    track('tap_dead', label, { x: Math.round(e.clientX - rect.left), y: Math.round(e.clientY - rect.top), w: Math.round(rect.width) })
  }, [])

  const Screen = screens[current]
  const profileRequester = profile ? requestersFor(config.gender ?? 'any').find((r) => r.id === profile) : null

  return (
    <Ctx.Provider value={ctx}>
      <div className="device device--framed" ref={deviceRef} onPointerDown={onPointerDown}>
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
