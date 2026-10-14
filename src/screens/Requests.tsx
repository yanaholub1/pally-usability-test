import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import logoPrimary from '../assets/illustrations/logo-primary.svg'
import { Icon } from '../components/Icon'
import { EventCard, PlayersCard } from '../components/cards'
import { Avatar, Badge, BallHero, Button, CardWithTray, IconButton, InfoRow, SectionHeader, StatsCard, SummaryCard, TButton, Toast, useTimeout } from '../components/ui'
import { HomeScaffold } from './Home'
import { MoreInfo } from './CreateMatch'
import { HOST, attendanceBucket, clubs, courts, requestersFor, sportsBucket, type Requester } from '../data'
import { SPOTS, dayAt, endTime, fmt, genderLabel, levelRange, useApp } from '../state'
import { motion } from '../motion'
import { track } from '../log'

export function useRequesters() {
  const { config } = useApp()
  return useMemo(() => requestersFor(config.gender ?? 'any'), [config.gender])
}

function minExpiry(rs: Requester[]) {
  return Math.min(...rs.map((r) => r.expiresInH))
}

/* ───────────── Home after booking: the notification arrives ───────────── */
export function HomeMatchScreen() {
  const { config, push, requestsArrived, setRequestsArrived, decisions, openProfile } = useApp()
  const requesters = useRequesters()
  const club = clubs.find((c) => c.id === config.clubId)!
  const d = dayAt(config.dayIndex)
  const [banner, setBanner] = useState<'hidden' | 'shown' | 'leaving'>('hidden')
  const pending = requesters.filter((r) => !decisions[r.id])
  const admitted = requesters.filter((r) => decisions[r.id] === 'admitted')

  useTimeout(() => {
    if (requestsArrived) return
    setRequestsArrived(true)
    setBanner('shown')
    track('notification_shown', 'join-requests')
  }, requestsArrived ? null : motion.bannerDelay)

  useTimeout(() => hideBanner('auto'), banner === 'shown' && motion.bannerAutoHide ? motion.bannerAutoHide : null)

  function hideBanner(reason: string) {
    if (banner !== 'shown') return
    track('notification_hidden', 'join-requests', { reason })
    setBanner('leaving')
    setTimeout(() => setBanner('hidden'), 260)
  }

  const touchY = useRef<number | null>(null)

  const lineup = [
    { name: HOST.name, photo: HOST.photo, level: HOST.level.toFixed(1), you: true, id: 'me', onTap: () => openProfile('me') },
    ...admitted.map((r) => ({ name: r.name, photo: r.photo, level: r.level.toFixed(1), id: r.id, onTap: () => openProfile(r.id) })),
  ]
  while (lineup.length < 4) lineup.push({ available: true } as never)

  const card = (
    <div className="stack gap12">
      <SectionHeader title="Upcoming activities" link="See all" />
      <EventCard
        trackId="home:my-match"
        onOpen={() => push('matchDetails')}
        header={{
          tone: 'blue',
          content: requestsArrived && pending.length ? (
            <>
              <Badge variant="attention" dot>{pending.length} {pending.length === 1 ? 'request' : 'requests'}</Badge>
              <span className="status-text"><Icon name="hour-glass" size={14} /> Expires in {minExpiry(pending)}h</span>
            </>
          ) : (
            <span className="status-text status-text--brand">• You’re in</span>
          ),
        }}
        tags={[{ icon: 'ball', label: 'Match' }, ...(config.gender && config.gender !== 'any' ? [{ icon: 'venus', label: genderLabel[config.gender] }] : []), { icon: 'racket', label: config.type === 'competitive' ? 'Competitive' : 'Casual' }]}
        title={`${fmt.long(d)} • ${config.time}`}
        lineup={lineup}
        location={`${club.name} • ${courts.find((c) => c.id === config.courtId)?.name ?? 'Court 1'}`}
        action={
          requestsArrived && pending.length ? (
            <Button icon="incoming" trackId="home:see-requests" onClick={() => push('requests')}>See requests</Button>
          ) : (
            <Button variant="secondary" icon="chat" trackId="home:message">Message</Button>
          )
        }
      />
    </div>
  )

  return (
    <>
      <HomeScaffold summary="1 upcoming" top={card} />
      {banner !== 'hidden' && (
        <TButton
          className={`banner ${banner === 'leaving' ? 'leaving' : ''}`}
          trackId="notification:tap"
          onClick={() => { hideBanner('tap'); push('requests') }}
          onTouchStart={(e) => { touchY.current = e.touches[0].clientY }}
          onTouchMove={(e) => { if (touchY.current !== null && e.touches[0].clientY - touchY.current < -25) { touchY.current = null; hideBanner('swipe') } }}
        >
          <img className="banner__icon" src={logoPrimary} alt="" />
          <span className="banner__text">
            <span className="banner__app"><span>Pally</span><span>now</span></span>
            <b style={{ fontWeight: 600 }}>{requesters.length} players want to join your match</b>
            <br />
            {requesters[0].name}, {requesters[1].name} and {requesters.length - 2} others asked to play on {fmt.short(d).split(',')[0]} at {config.time}.
          </span>
        </TButton>
      )}
    </>
  )
}

/* ───────────── Match details (host view) ───────────── */
// Task 2 plays the header ball drop once: on whichever of Match details / Requests opens first
let task2BallsPlayed = false

export function MatchDetailsScreen() {
  const { config, push, back, requestsArrived, decisions, openProfile } = useApp()
  const requesters = useRequesters()
  const club = clubs.find((c) => c.id === config.clubId)!
  const court = courts.find((c) => c.id === config.courtId)!
  const d = dayAt(config.dayIndex)
  const [lo, hi] = levelRange(config, HOST.level)
  const pending = requesters.filter((r) => !decisions[r.id])
  const admitted = requesters.filter((r) => decisions[r.id] === 'admitted')
  const slots = [
    { name: HOST.name, photo: HOST.photo, level: HOST.level.toFixed(1), you: true, id: 'me', onTap: () => openProfile('me') },
    ...admitted.map((r) => ({ name: r.name, photo: r.photo, level: r.level.toFixed(1), you: false, id: r.id, onTap: () => openProfile(r.id) })),
  ]
  const [dropBalls] = useState(() => {
    const play = !task2BallsPlayed
    task2BallsPlayed = true
    return play
  })
  const summaryActions = [
    { icon: 'chat', label: 'Message', trackId: 'details:message' },
    { icon: 'person-plus', label: 'Invite players', trackId: 'details:invite' },
    { icon: 'map', label: 'Find on map', trackId: 'details:map' },
  ]
  return (
    <div className="screen">
      <div className="screen__scroll">
        <BallHero onBack={back} animateBalls={dropBalls} />
        <div className="sheet-body stack gap20" style={{ padding: '24px 20px 40px' }}>
          {requestsArrived && pending.length > 0 ? (
            <CardWithTray emphasis="brand" action="See requests" trackId="details:see-requests" onAction={() => push('requests')}>
              <SummaryCard status="info" statusLabel={`${pending.length} ${pending.length === 1 ? 'player' : 'players'} requested to join`} title="Open match" subtitle="Visible on “Find”" actions={summaryActions} />
            </CardWithTray>
          ) : (
            <SummaryCard status="joined" statusLabel="You’re in this match" title="Open match" subtitle="Visible on “Find”" actions={summaryActions} />
          )}
          <CardWithTray action="Add to calendar" trackId="details:add-to-calendar">
            <div className="info-card">
              <InfoRow icon="calendar"><b>{fmt.long(d)}</b> • <span className="nowrap">{config.time}–{endTime(config.time ?? '18:30', config.duration)}</span></InfoRow>
              <InfoRow icon="location-pin"><b>{club.name}</b> • {court.name} • {court.short}</InfoRow>
              <InfoRow icon="racket"><b>{config.type === 'competitive' ? 'Competitive' : 'Casual'}</b> • {config.type === 'competitive' ? 'Results affect your level' : 'Results don’t affect your level'}</InfoRow>
              <InfoRow icon="person-shield"><b>Your approval is required</b> • You are the match host</InfoRow>
            </div>
          </CardWithTray>
          <StatsCard items={[['Gender', genderLabel[config.gender ?? 'any']], ['Level', `${lo.toFixed(1)} – ${hi.toFixed(1)}`], ['Price', `€${(court.price / 4).toFixed(2)}`]]} />
          <div className="stack gap12">
            <SectionHeader title="Players" />
            <PlayersCard slots={slots} />
          </div>
          <MoreInfo dayIndex={config.dayIndex} time={config.time ?? '18:30'} />
        </div>
      </div>
    </div>
  )
}

/* ───────────── Requests to join ───────────── */
function RequestCard({ r, matchFull, decided, onDecide, onProfile }: { r: Requester; matchFull: boolean; decided: boolean; onDecide: (d: 'admitted' | 'declined') => void; onProfile: () => void }) {
  const [leavingLocal, setLeaving] = useState(false)
  const leaving = leavingLocal || decided
  const act = (d: 'admitted' | 'declined') => {
    setLeaving(true)
    setTimeout(() => onDecide(d), motion.cardExitDuration)
  }
  return (
    <div className={`request-card ${leaving ? 'leaving' : ''}`}>
      <TButton className="request-card__player" trackId={`request:${r.id}:profile`} trackData={{ via: 'card' }} onClick={onProfile} aria-label={`View ${r.name}'s profile`}>
        <Avatar name={r.name} photo={r.photo} level={r.levelEstimated ? `~${r.level.toFixed(1)}` : r.level.toFixed(1)} size={64} />
        <span className="stack gap4 grow">
          <span className="label16 ellipsis" style={{ lineHeight: '24px' }}>{r.name}</span>
          <span className="status-text status-text--brand">{r.status}</span>
        </span>
      </TButton>
      <span className="request-card__expiry status-text"><Icon name="hour-glass" size={14} /> Expires in {r.expiresInH}h</span>
      <div className="row gap8" style={{ flexWrap: 'wrap' }}>
        {r.attendance !== null && <Badge icon="badge">{attendanceBucket(r.attendance)}</Badge>}
        {r.sportsmanship !== null && <Badge icon="handshake">{sportsBucket(r.sportsmanship)}</Badge>}
        <Badge icon="field">{r.side === 'Either' ? 'Plays both sides' : `Plays on the ${r.side.toLowerCase()}`}</Badge>
        {r.mutualFriends > 0 && <Badge icon="group">{r.mutualFriends} mutual {r.mutualFriends === 1 ? 'friend' : 'friends'}</Badge>}
      </div>
      <div className="row gap8">
        <Button variant="danger2" icon="close" fill trackId={`request:${r.id}:decline`} trackData={{ name: r.name }} onClick={() => act('declined')}>Decline</Button>
        <Button variant="secondary" icon="checkmark" fill disabled={matchFull} trackId={`request:${r.id}:admit`} trackData={{ name: r.name, matchFull }} onClick={() => act('admitted')}>Admit</Button>
      </div>
    </div>
  )
}


/* ───────── Requests summary that collapses into a pinned header (Figma: "Requests — many, scrolled") ─────────
   In the page it is the full StatsCard (strip, title, labels + values). Once the card reaches the spot under the
   title bar, a pinned copy takes over at exactly the same place and shrinks as you keep scrolling: the title and
   labels fade out and their space closes 1:1 with the scroll, so nothing below jumps. The title bar and white panel
   fade in over the same distance. */
type Strip = { tone: 'info' | 'full'; label: string }
const EXP = { pad: 20, title: 36, titleGap: 20, label: 20, labelGap: 2 }
const COL = { pad: 12 }
const COLLAPSE_DISTANCE = (EXP.pad - COL.pad) * 2 + EXP.title + EXP.titleGap + EXP.label + EXP.labelGap // 94 px of scroll
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function SummaryBody({ strip, items, p }: { strip: Strip; items: [string, string][]; p: number }) {
  const fade = Math.max(0, 1 - p * 3) // text fades out in the first third, before its space closes
  const pad = lerp(EXP.pad, COL.pad, p)
  return (
    <div className="req-summary">
      <p className={`summary-card__strip req-summary__strip--${strip.tone}`}>{strip.label}</p>
      <div style={{ padding: `${pad}px 20px` }}>
        <p className="h2" style={{ textAlign: 'center', height: lerp(EXP.title, 0, p), marginBottom: lerp(EXP.titleGap, 0, p), opacity: fade, overflow: 'hidden', whiteSpace: 'nowrap' }}>Requests to join match</p>
        <div className="stats-card__items">
          {items.map(([label, value]) => (
            <div key={label} className="stats-card__col">
              <span className="stats-card__text" style={{ gap: lerp(EXP.labelGap, 0, p) }}>
                <span className="stats-card__label" style={{ height: lerp(EXP.label, 0, p), opacity: fade, overflow: 'hidden' }}>{label}</span>
                <span className="stats-card__value">{value}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CollapsingSummary({ strip, items, onBack }: { strip: Strip; items: [string, string][]; onBack: () => void }) {
  const inflow = useRef<HTMLDivElement>(null)
  const pinSlot = useRef<HTMLDivElement>(null)
  const [p, setP] = useState(-1) // -1 = not pinned
  const [host, setHost] = useState<HTMLElement | null>(null) // the pinned copy renders into the screen, outside the scroller
  useEffect(() => { setHost(inflow.current?.closest('.screen') as HTMLElement | null) }, [])
  useEffect(() => {
    const el = inflow.current
    const scroller = el?.closest('.screen__scroll') as HTMLElement | null
    const screen = el?.closest('.screen') as HTMLElement | null
    if (!el || !scroller || !screen) return
    let last = -2
    const check = () => {
      const pinTop = pinSlot.current?.offsetTop ?? 0 // where the pinned card sits (under the title bar)
      const top = el.getBoundingClientRect().top - screen.getBoundingClientRect().top
      const next = top > pinTop ? -1 : Math.min(1, (pinTop - top) / COLLAPSE_DISTANCE)
      if (Math.abs(next - last) > 0.001) { last = next; setP(next) }
    }
    check()
    scroller.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => { scroller.removeEventListener('scroll', check); window.removeEventListener('resize', check) }
  }, [host])
  const pinned = p >= 0
  const pp = Math.max(0, p)
  useEffect(() => { if (p >= 1) track('requests_header_collapsed', 'requests') }, [p >= 1]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div ref={inflow} style={{ visibility: pinned ? 'hidden' : 'visible' }}><SummaryBody strip={strip} items={items} p={0} /></div>
      {host && createPortal(
        <div className={`req-pin ${pinned ? 'req-pin--on' : ''} ${pp > 0.5 ? 'req-pin--dark-status' : ''}`} aria-hidden={!pinned}>
          <div className="req-pin__bg" style={{ opacity: pp, boxShadow: `0 4px 12px rgba(0,0,0,${0.06 * pp})` }} />
          <div className="hdr__row req-pin__bar" style={{ opacity: pp, pointerEvents: pp > 0.5 ? 'auto' : 'none' }}>
            <IconButton icon="chevron-left" label="Back" onClick={onBack} trackId="requests:pinned:back" />
            <p className="h5 req-pin__title">Requests to join</p>
            <IconButton icon="share" label="Share" trackId="requests:pinned:share" />
          </div>
          <div ref={pinSlot} className="req-pin__card">{pinned && <SummaryBody strip={strip} items={items} p={pp} />}</div>
        </div>,
        host,
      )}
    </>
  )
}

export function RequestsScreen() {
  const { config, back, decisions, decide, openProfile, milestone } = useApp()
  const [dropBalls] = useState(() => {
    const play = !task2BallsPlayed
    task2BallsPlayed = true
    return play
  })
  const requesters = useRequesters()
  const [lo, hi] = levelRange(config, HOST.level)
  const admittedCount = Object.values(decisions).filter((d) => d === 'admitted').length
  const spotsLeft = SPOTS - admittedCount
  const pending = requesters.filter((r) => !decisions[r.id])
  const [snack, setSnack] = useState<{ id: string; text: string; tone: 'success' | 'neutral'; key: number } | null>(null)
  const [snackLeaving, setSnackLeaving] = useState(false)

  useEffect(() => {
    if (!snack) return
    setSnackLeaving(false)
    // kit: toasts with an action stay at least 6 s
    const visible = Math.max(6000, motion.snackbarVisibleFor)
    const t1 = setTimeout(() => setSnackLeaving(true), visible)
    const t2 = setTimeout(() => setSnack(null), visible + motion.snackbarDuration)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [snack])

  useEffect(() => {
    if (spotsLeft === 0) milestone('match_full')
    if (pending.length === 0) milestone('all_requests_decided')
  }, [spotsLeft, pending.length]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="screen">
      <div className="screen__scroll">
        <BallHero onBack={back} animateBalls={dropBalls} />
        <div className="sheet-body stack gap20" style={{ padding: '24px 20px 120px' }}>
          <CollapsingSummary
            onBack={back}
            strip={spotsLeft ? { tone: 'info', label: `${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left` } : { tone: 'full', label: 'Match full' }}
            items={[['Gender', genderLabel[config.gender ?? 'any']], ['Level', `${lo.toFixed(1)} – ${hi.toFixed(1)}`], ['Type', config.type === 'competitive' ? 'Competitive' : 'Casual']]}
          />
          {requesters.map((r) => (
            <div key={r.id} className={`collapse ${decisions[r.id] ? 'gone' : ''}`}>
              <div aria-hidden={!!decisions[r.id]}>
                {(
                  <RequestCard
                    key={decisions[r.id] ?? 'pending'}
                    decided={!!decisions[r.id]}
                    r={r}
                    matchFull={spotsLeft === 0}
                    onProfile={() => openProfile(r.id)}
                    onDecide={(d) => {
                      decide(r.id, d)
                      setSnack({ id: r.id, text: d === 'admitted' ? `${r.name} admitted` : 'Request declined', tone: d === 'admitted' ? 'success' : 'neutral', key: Date.now() })
                    }}
                  />
                )}
              </div>
            </div>
          ))}
          {pending.length === 0 && (
            <div className="card stack gap8" style={{ padding: 16, alignItems: 'center', textAlign: 'center' }}>
              <Icon name="checkmark" size={32} />
              <p className="h5">All requests reviewed</p>
              <p className="body14 muted">You admitted {admittedCount} {admittedCount === 1 ? 'player' : 'players'}.</p>
            </div>
          )}
        </div>
      </div>
      {snack && (
        <Toast
          key={snack.key}
          tone={snack.tone}
          message={snack.text}
          action="Undo"
          onAction={() => { decide(snack.id, null); setSnack(null) }}
          onClose={() => setSnack(null)}
          leaving={snackLeaving}
          trackPrefix={`toast:${snack.id}`}
        />
      )}
    </div>
  )
}

