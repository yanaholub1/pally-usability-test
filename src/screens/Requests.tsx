import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { EventCard, PlayersCard } from '../components/cards'
import { Avatar, Badge, BallHero, Button, CardWithTray, InfoRow, SectionHeader, StatsCard, SummaryCard, TButton, Toast, useTimeout } from '../components/ui'
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
  const { config, push, requestsArrived, setRequestsArrived, decisions } = useApp()
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
    { name: HOST.name, photo: HOST.photo, level: HOST.level.toFixed(1), you: true },
    ...admitted.map((r) => ({ name: r.name, photo: r.photo, level: r.level.toFixed(1) })),
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
        location={club.name}
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
      <HomeScaffold summary={`1 upcoming${requestsArrived && pending.length ? ` · ${pending.length} to review` : ''}`} top={card} />
      {banner !== 'hidden' && (
        <TButton
          className={`banner ${banner === 'leaving' ? 'leaving' : ''}`}
          trackId="notification:tap"
          onClick={() => { hideBanner('tap'); push('requests') }}
          onTouchStart={(e) => { touchY.current = e.touches[0].clientY }}
          onTouchMove={(e) => { if (touchY.current !== null && e.touches[0].clientY - touchY.current < -25) { touchY.current = null; hideBanner('swipe') } }}
        >
          <span className="banner__icon"><Icon name="ball" size={22} /></span>
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
let ballsHavePlayed = false // the ball drop plays once per session, the first time Match details opens

export function MatchDetailsScreen() {
  const { config, push, back, requestsArrived, decisions } = useApp()
  const requesters = useRequesters()
  const club = clubs.find((c) => c.id === config.clubId)!
  const court = courts.find((c) => c.id === config.courtId)!
  const d = dayAt(config.dayIndex)
  const [lo, hi] = levelRange(config, HOST.level)
  const pending = requesters.filter((r) => !decisions[r.id])
  const admitted = requesters.filter((r) => decisions[r.id] === 'admitted')
  const slots = [
    { name: HOST.name, photo: HOST.photo, level: HOST.level.toFixed(1), you: true },
    ...admitted.map((r) => ({ name: r.name, photo: r.photo, level: r.level.toFixed(1), you: false })),
  ]
  const [dropBalls] = useState(() => {
    const play = !ballsHavePlayed
    ballsHavePlayed = true
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
            <CardWithTray action="See requests" trackId="details:see-requests" onAction={() => push('requests')}>
              <SummaryCard status="action" statusLabel={`${pending.length} players requested to join`} title="Open match" subtitle="Visible on “Find”" actions={summaryActions} />
            </CardWithTray>
          ) : (
            <SummaryCard status="joined" statusLabel="You’re in this match" title="Open match" subtitle="Visible on “Find”" actions={summaryActions} />
          )}
          <CardWithTray action="Add to calendar" trackId="details:add-to-calendar">
            <div className="info-card">
              <InfoRow icon="calendar"><b>{fmt.long(d)}</b> • {config.time}–{endTime(config.time ?? '18:30', config.duration)}</InfoRow>
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

export function RequestsScreen() {
  const { config, back, decisions, decide, openProfile, milestone } = useApp()
  const requesters = useRequesters()
  const court = courts.find((c) => c.id === config.courtId)!
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
        <BallHero onBack={back} />
        <div className="sheet-body stack gap20" style={{ padding: '24px 20px 120px' }}>
          <StatsCard title="Requests to join match" items={[['Gender', genderLabel[config.gender ?? 'any']], ['Level', `${lo.toFixed(1)} – ${hi.toFixed(1)}`], ['Price', `€${(court.price / 4).toFixed(2)}`]]}>
            <p className="caption" style={{ textAlign: 'center', marginTop: -4, color: spotsLeft ? 'var(--brand-900)' : 'var(--coral-700)' }}>
              {spotsLeft ? `${spotsLeft} of ${SPOTS} spots left` : 'Match full'}
            </p>
          </StatsCard>
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

