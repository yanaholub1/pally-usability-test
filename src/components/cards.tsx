import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { asset } from './assets'
import { Avatar, Badge, Button, IconButton, TButton } from './ui'
import { track } from '../log'

export type LineupSlot = { name?: string; photo?: string; level?: string; badgeIcon?: string; available?: boolean; you?: boolean }

/** Event card. `header` mirrors the Figma EventCard Header property. */
export function EventCard({
  header, tags, title, date, lineup, location, action, layout = 'match', trackId, onOpen,
}: {
  header?: { tone: 'blue' | 'grey' | 'lime'; content: ReactNode }
  tags: { icon?: string; label: string; accent?: boolean }[]
  title: string
  /** Lessons/tournaments: date line under the title (matches use the date as the title) */
  date?: string
  lineup: LineupSlot[]
  location: string
  action: ReactNode
  /** Lineup layout (kit Lineup, Density=Full): 2 v 2 match, or a lead (coach) row above the players */
  layout?: 'match' | 'lead'
  trackId: string
  onOpen?: () => void
}) {
  const card = (
    <div className={`event-card ${header ? '' : 'event-card--bordered'}`}>
      <div className="event-card__tags">
        {tags.map((t) => (
          <Badge key={t.label} icon={t.icon} variant={t.accent ? 'accent' : undefined}>{t.label}</Badge>
        ))}
      </div>
      <div>
        <div className="stack gap8" style={{ marginBottom: 16 }}>
          <p className="h5">{title}</p>
          {date && <span className="row gap4"><Icon name="calendar" size={18} /><span className="label16">{date}</span></span>}
        </div>
        {layout === 'lead' ? (
          <LeadLineup slots={lineup} />
        ) : (
          <div className="lineup-full">
            {[lineup.slice(0, 2), lineup.slice(2, 4)].map((team, ti) => (
              <div key={ti} style={{ display: 'contents' }}>
                {ti === 1 && <div className="lineup-full__divider" />}
                <div className="lineup-full__team">
                  {team.map((s, i) => (
                    <Avatar key={i} size={64} name={s.name} photo={s.photo} level={s.level} available={s.available} showName nameNode={s.available ? 'Available' : s.you ? 'You' : s.name} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="event-card__footer">
        <span className="row gap4 grow">
          <Icon name="location-pin" size={18} />
          <span className="label16 ellipsis">{location}</span>
        </span>
        <IconButton icon="map" label="Open map" variant="secondary" trackId={`${trackId}:map`} />
        {action}
      </div>
    </div>
  )
  // The whole card opens the event; taps on its own buttons (map, Join, See requests…) don't.
  const open = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    track('tap', `${trackId}:open`, onOpen ? undefined : { note: 'no details page in prototype' })
    onOpen?.()
  }
  const tappable = { 'data-track': `${trackId}:open`, role: 'link', tabIndex: 0, onClick: open, className: 'event-tap' }
  if (!header) return <div {...tappable}>{card}</div>
  return (
    <div {...tappable}><div className={`event-frame ${header.tone === 'blue' ? 'event-frame--blue' : header.tone === 'lime' ? '' : 'event-frame--grey'}`} style={header.tone === 'lime' ? { background: 'var(--lime-soft)' } : undefined}>
      <div className="event-frame__strip">{header.content}</div>
      {card}
    </div></div>
  )
}

/** Lineup, Layout=Lead + players: lead on its own row with name; players below (names only for 1–2 players) */
function LeadLineup({ slots }: { slots: LineupSlot[] }) {
  const [lead, ...players] = slots
  const showNames = players.length <= 2
  return (
    <div className="stack gap12">
      <Avatar name={lead.name} photo={lead.photo} badgeIcon={lead.badgeIcon} level={lead.level} showName />
      <div className="row gap8">
        {players.map((s, i) => (
          <Avatar key={i} name={s.name} photo={s.photo} level={s.level} available={s.available} showName={showNames} nameNode={s.available ? 'Available' : s.name} />
        ))}
      </div>
    </div>
  )
}

export function ClubCard({ name, address, photo, onBook, trackId }: { name: string; address: string; photo: string; onBook: () => void; trackId: string }) {
  const src = asset('clubs', photo)
  return (
    <div className="club-card" style={src ? { backgroundImage: `url(${src})` } : { backgroundImage: 'linear-gradient(160deg,#5b7fb8 0%,#1f4fa3 45%,#123a7a 100%)' }}>
      <div className="club-card__scrim" />
      <div className="row gap12" style={{ position: 'relative' }}>
        <div className="row gap8 grow">
          <Badge icon="calendar" variant="media">10+ slots</Badge>
          <Badge variant="media">From €17/hour</Badge>
        </div>
        <IconButton icon="heart" label="Save club" trackId={`${trackId}:save`} />
      </div>
      <div className="row gap12" style={{ position: 'relative', color: '#fff' }}>
        <div className="grow stack gap8">
          <p className="h5 ellipsis">{name}</p>
          <span className="row gap4"><Icon name="location-pin" size={18} /><span className="label14 ellipsis">{address}</span></span>
        </div>
        <IconButton icon="map" label="Open map" variant="secondary" trackId={`${trackId}:map`} />
        <Button variant="secondary" icon="calendar" trackId={`${trackId}:see-times`} onClick={onBook}>See times</Button>
      </div>
    </div>
  )
}

export function PromoBanner() {
  const art = asset('illustrations', 'promo-court')
  return (
    <div style={{ background: 'var(--lime-soft)', border: '1px solid var(--lime-border)', borderRadius: 28, padding: 4 }}>
      <p className="caption" style={{ textAlign: 'center', height: 24, paddingTop: 4 }}>30-day free trial of Pally+</p>
      <div style={{ background: '#fff', borderRadius: 24, padding: 12, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {art && <img src={art} alt="" style={{ position: 'absolute', right: 0, bottom: 0, width: 352, height: 118 }} />}
        <div style={{ position: 'relative' }}>
          <p className="caption muted">Get match suggestions</p>
          <p className="h5">Spend time playing, not planning</p>
        </div>
        <div style={{ position: 'relative' }}>
          <Button trackId="promo:add-preferences">Add preferences</Button>
        </div>
      </div>
    </div>
  )
}

export function EmptyState({ illustration, fallbackIcon, title, desc, action, actionIcon, trackId }: { illustration: string; fallbackIcon: string; title: string; desc: string; action: string; actionIcon: string; trackId: string }) {
  const art = asset('illustrations', illustration)
  return (
    <div className="card stack gap16" style={{ padding: 12 }}>
      {art ? <img src={art} width={72} height={72} alt="" /> : (
        <span style={{ width: 72, height: 72, display: 'grid', placeItems: 'center', color: 'var(--brand-300)', background: 'var(--brand-50)', borderRadius: 20 }}>
          <Icon name={fallbackIcon} size={40} strokeWidth={1.2} />
        </span>
      )}
      <div className="stack gap8">
        <div className="stack gap4">
          <p className="h5">{title}</p>
          <p className="body16 muted">{desc}</p>
        </div>
        <div><Button variant="secondary" icon={actionIcon} trackId={trackId}>{action}</Button></div>
      </div>
    </div>
  )
}

/** Players section on event details: Lineup (Match, Full) inside a card */
export function PlayersCard({ slots }: { slots: LineupSlot[] }) {
  const all = [0, 1, 2, 3].map((i) => slots[i] ?? { available: true })
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="lineup-full">
        {[all.slice(0, 2), all.slice(2, 4)].map((team, ti) => (
          <div key={ti} style={{ display: 'contents' }}>
            {ti === 1 && <div className="lineup-full__divider" />}
            <div className="lineup-full__team">
              {team.map((s, i) => (
                <Avatar key={i} size={64} name={s.name} photo={s.photo} level={s.level} available={s.available} showName nameNode={s.available ? 'Available' : s.you ? 'You' : s.name} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** PromoBanner, Layout=Link — whole banner is one tap target (payment page) */
export function PromoLink() {
  const art = asset('illustrations', 'promo-coins')
  return (
    <TButton trackId="promo:pally-plus" style={{ display: 'block', width: '100%', background: 'var(--lime-soft)', border: '1px solid var(--lime-border)', borderRadius: 28, padding: 4 }}>
      <p className="caption" style={{ textAlign: 'center', height: 24, paddingTop: 4 }}>30-day free trial</p>
      <span style={{ background: '#fff', borderRadius: 24, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        {art ? <img src={art} width={54} height={56} alt="" style={{ objectFit: 'contain' }} /> : <span style={{ width: 54, height: 56, borderRadius: 16, background: 'var(--lime-soft)', flexShrink: 0 }} />}
        <span className="grow stack gap4" style={{ textAlign: 'left' }}>
          <span className="h6">Subscribe to Pally+</span>
          <span className="body16 muted">Forget about booking fees, get feedback on your game and more!</span>
        </span>
        <Icon name="chevron-right" size={20} />
      </span>
    </TButton>
  )
}
