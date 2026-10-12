import { useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from 'react'
import { Icon } from './Icon'
import { asset } from './assets'
import { track } from '../log'

/* ───────── Tracked button: every tap is logged with a readable id ───────── */
type TBProps = ButtonHTMLAttributes<HTMLButtonElement> & { trackId: string; trackData?: Record<string, unknown> }
export function TButton({ trackId, trackData, onClick, children, disabled, ...rest }: TBProps) {
  // Never use the native disabled attribute: taps on disabled controls are logged as findings.
  return (
    <button
      type="button"
      data-track={trackId}
      aria-disabled={disabled || undefined}
      {...rest}
      onClick={(e) => {
        track(disabled ? 'tap_disabled' : 'tap', trackId, trackData)
        if (!disabled) onClick?.(e)
      }}
    >
      {children}
    </button>
  )
}

type BtnProps = {
  variant?: 'primary' | 'secondary' | 'neutral' | 'ghost' | 'danger2' | 'black' | 'on-brand'
  size?: 'sm' | 'lg'
  icon?: string
  fill?: boolean
  disabled?: boolean
  trackId: string
  trackData?: Record<string, unknown>
  onClick?: () => void
  children?: ReactNode
  ariaLabel?: string
  className?: string
}
export function Button({ variant = 'primary', size = 'sm', icon, fill, disabled, trackId, trackData, onClick, children, ariaLabel, className }: BtnProps) {
  const cls = ['btn', `btn--${variant}`, size === 'lg' && 'btn--lg', icon && children && 'btn--icon-lead', fill && 'btn--fill', className].filter(Boolean).join(' ')
  // Disabled buttons stay tappable for logging (a tap on a disabled button is a finding)
  return (
    <TButton className={cls} trackId={trackId} trackData={trackData} disabled={disabled} onClick={onClick} aria-label={ariaLabel}>
      {icon && <Icon name={icon} size={20} />}
      {children}
    </TButton>
  )
}

export function IconButton({ icon, label, variant = 'neutral', onClick, trackId }: { icon: string; label: string; variant?: 'neutral' | 'secondary'; onClick?: () => void; trackId: string }) {
  return (
    <TButton className={`btn btn--${variant} icon-btn`} aria-label={label} trackId={trackId} onClick={onClick}>
      <Icon name={icon} size={20} />
    </TButton>
  )
}

/* ───────── Device chrome (only visible in the desktop frame) ───────── */
export function StatusBar({ light }: { light?: boolean }) {
  return (
    <div className={`statusbar ${light ? 'statusbar--light' : ''}`} aria-hidden>
      <span>9:41</span>
      <span className="statusbar__right">
        <span className="statusbar__bars"><i style={{ height: 4 }} /><i style={{ height: 6 }} /><i style={{ height: 8 }} /><i style={{ height: 10 }} /></span>
        <span>5G</span>
        <span className="statusbar__battery" />
      </span>
    </div>
  )
}
export const HomeIndicator = () => <div className="home-indicator" aria-hidden />

/* ───────── Headers ───────── */
export function StepHeader({ step, total = 6, onBack }: { step: number; total?: number; onBack: () => void }) {
  return (
    <div className="hdr">
      <div className="hdr__row">
        <IconButton icon="chevron-left" label="Back" onClick={onBack} trackId="back" />
        <div className="steps" role="progressbar" aria-valuenow={step} aria-valuemax={total} aria-label={`Step ${step} of ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <i key={i} className={i + 1 < step ? 'done' : i + 1 === step ? 'current' : ''} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function TitleHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className="hdr">
      <div className="hdr__row">
        {onBack ? <IconButton icon="chevron-left" label="Back" onClick={onBack} trackId="back" /> : <div style={{ width: 40 }} />}
        <div className="hdr__spacer" />
      </div>
      <p className="h5 hdr__title">{title}</p>
    </div>
  )
}

/** Hero header with the lime ball pattern (match pages) */
export function BallHero({ onBack, right }: { onBack: () => void; right?: ReactNode }) {
  const art = asset('illustrations', 'header-balls')
  return (
    <div className="hero brand-bg">
      {art ? (
        <img src={art} alt="" className="hero__balls" style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
      ) : (
        <BallPattern />
      )}
      <div className="hero__topbar">
        <IconButton icon="chevron-left" label="Back" onClick={onBack} trackId="back" />
        <div className="hdr__spacer" />
        {right ?? <IconButton icon="share" label="Share" trackId="share" />}
      </div>
    </div>
  )
}

function BallPattern() {
  const balls = [
    [-6, 136, 52], [48, 112, 46], [92, 92, 50], [140, 134, 44], [186, 122, 48], [234, 102, 46], [282, 94, 50], [318, 128, 46], [362, 146, 44],
  ]
  return (
    <svg className="hero__balls" viewBox="0 0 402 188" preserveAspectRatio="xMidYMax slice">
      {balls.map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${i * 37})`}>
          <circle r={r / 2} fill="#c2fe06" stroke="#ffffff" strokeWidth="2.5" />
          <path d={`M${-r / 2.3} ${-r / 6} C ${-r / 6} ${-r / 5}, ${-r / 8} ${r / 3}, ${-r / 4} ${r / 2.4}`} fill="none" stroke="#fff" strokeWidth="2" />
          <path d={`M${r / 2.3} ${r / 6} C ${r / 6} ${r / 5}, ${r / 8} ${-r / 3}, ${r / 4} ${-r / 2.4}`} fill="none" stroke="#fff" strokeWidth="2" />
        </g>
      ))}
    </svg>
  )
}

/* ───────── Building blocks ───────── */
export function SectionHeader({ title, info, link, onLink }: { title: string; info?: boolean; link?: string; onLink?: () => void }) {
  return (
    <div className="section-header">
      <div className="section-header__title">
        <p className="h5">{title}</p>
        {info && <TButton trackId={`info:${title}`} aria-label={`About ${title.toLowerCase()}`} style={{ display: 'grid' }}><Icon name="info" size={20} /></TButton>}
      </div>
      {link && <TButton className="link" trackId={`link:${title}`} onClick={onLink}>{link}</TButton>}
    </div>
  )
}

export function Badge({ icon, dot, children, variant }: { icon?: string; dot?: boolean; children: ReactNode; variant?: 'media' | 'accent' | 'attention' }) {
  return (
    <span className={`badge ${(icon || dot) && variant !== 'attention' ? 'badge--lead' : ''} ${variant ? `badge--${variant}` : ''}`}>
      {dot && <span className="badge__dot" />}
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  )
}

export function RadioCard({
  title, desc, icon, selected, disabled, trailing, details, onSelect, trackId,
}: {
  title: string; desc?: ReactNode; icon?: string; selected: boolean; disabled?: boolean; trailing?: ReactNode; details?: ReactNode; onSelect: () => void; trackId: string
}) {
  return (
    <div className={`rcard ${selected ? 'on' : ''} ${disabled ? 'disabled' : ''} ${selected && details ? 'has-details' : ''}`}>
      <TButton className="rcard__main" role="radio" aria-checked={selected} disabled={disabled} trackId={trackId} onClick={onSelect}>
        {icon && <Icon name={icon} size={24} />}
        <span className="rcard__text">
          <span className="rcard__title">{title}</span>
          {desc && <span className="rcard__desc">{desc}</span>}
        </span>
        {trailing ?? <span className={`radio ${selected ? 'on' : ''}`} />}
      </TButton>
      {selected && details && <div className="rcard__details">{details}</div>}
    </div>
  )
}

export function Chip({ selected, children, onClick, trackId, style }: { selected?: boolean; children: ReactNode; onClick?: () => void; trackId: string; style?: React.CSSProperties }) {
  return (
    <TButton className={`chip ${selected ? 'on' : ''}`} aria-pressed={selected} trackId={trackId} onClick={onClick} style={style}>
      {children}
    </TButton>
  )
}

export function Segmented({ items, value, onChange, trackPrefix }: { items: string[]; value: string; onChange: (v: string) => void; trackPrefix: string }) {
  return (
    <div className="segmented" role="tablist">
      {items.map((it) => (
        <TButton key={it} role="tab" aria-selected={it === value} className={it === value ? 'on' : ''} trackId={`${trackPrefix}:${it}`} onClick={() => onChange(it)}>
          {it}
        </TButton>
      ))}
    </div>
  )
}

export function BottomBar({ children }: { children: ReactNode }) {
  return <div className="bottom-bar">{children}</div>
}

export function InfoRow({ icon, children, onClick, trackId }: { icon: string; children: ReactNode; onClick?: () => void; trackId?: string }) {
  if (onClick && trackId) {
    return (
      <TButton className="info-row info-row--tap" trackId={trackId} onClick={onClick}>
        <Icon name={icon} />
        <span className="info-row__text">{children}</span>
        <Icon name="chevron-right" size={20} />
      </TButton>
    )
  }
  return (
    <div className="info-row">
      <Icon name={icon} />
      <span className="info-row__text">{children}</span>
    </div>
  )
}

/* ───────── Avatars ───────── */
const tints = ['#2f6fe4', '#a855f7', '#0ea5a4', '#f97316', '#e11d48', '#65a30d', '#0d265e', '#ca8a04']
function tintFor(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 997
  return tints[h % tints.length]
}

export function Avatar({ name, photo, level, size = 56, available, showName, nameNode }: { name?: string; photo?: string; level?: string; size?: number; available?: boolean; showName?: boolean; nameNode?: ReactNode }) {
  const src = photo ? asset('avatars', photo) : undefined
  const mascotAvailable = asset('illustrations', 'mascot-available')
  const mascotPlaceholder = asset('illustrations', 'mascot-placeholder')
  const tile = available ? (
    <div className="avatar__tile avatar__tile--available">
      {mascotAvailable ? <img src={mascotAvailable} alt="" className="avatar__mascot" /> : <span className="mascot" />}
    </div>
  ) : src ? (
    <div className="avatar__tile"><img src={src} alt="" /></div>
  ) : mascotPlaceholder ? (
    <div className="avatar__tile"><img src={mascotPlaceholder} alt="" className="avatar__mascot" /></div>
  ) : (
    <div className="avatar__tile avatar__tile--initials" style={{ background: tintFor(name ?? '?'), fontSize: size * 0.36 }}>{(name ?? '?').slice(0, 1)}</div>
  )
  const sizeCls = size >= 64 ? 'avatar--l' : size <= 44 ? 'avatar--s' : 'avatar--m'
  const av = (
    <div className={`avatar ${sizeCls}`} style={{ width: size, height: size }}>
      {tile}
      {level && <LevelBadge level={level} />}
    </div>
  )
  if (!showName) return av
  return (
    <div className="avatar-with-name">
      {av}
      <span className="label16 ellipsis" style={{ fontWeight: 500 }}>{nameNode ?? name}</span>
    </div>
  )
}

/** Level badge (kit: Level badge, Type=Player) — lime ball with seams */
export function LevelBadge({ level }: { level: string }) {
  return (
    <span className="avatar__level">
      <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden>
        <circle cx="12" cy="12" r="11.25" fill="#c2fe06" stroke="#fff" strokeWidth="1.5" />
        <path d="M3.2 5.6C7.6 7.4 9.2 12.8 6.8 20.6M20.8 18.4C16.4 16.6 14.8 11.2 17.2 3.4" fill="none" stroke="#dbf766" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span>{level}</span>
    </span>
  )
}

/** Toast (kit: Toast) — top of the screen, Success / Neutral, optional action + close */
export function Toast({ tone, message, action, onAction, onClose, leaving, trackPrefix }: { tone: 'success' | 'neutral'; message: string; action?: string; onAction?: () => void; onClose: () => void; leaving?: boolean; trackPrefix: string }) {
  return (
    <div className={`toast toast--${tone} ${leaving ? 'leaving' : ''}`} role="status" aria-live="polite">
      <span className="toast__msg">
        <Icon name={tone === 'success' ? 'checkmark' : 'info'} size={20} />
        <span className="ellipsis">{message}</span>
      </span>
      {action && <TButton className="toast__action" trackId={`${trackPrefix}:action`} onClick={onAction}>{action}</TButton>}
      <TButton className="btn btn--neutral icon-btn icon-btn--xs" aria-label="Close" trackId={`${trackPrefix}:close`} onClick={onClose} style={{ width: 32, height: 32 }}>
        <Icon name="close" size={16} />
      </TButton>
    </div>
  )
}

/** EventDetails/StatsCard — 2–3 facts, optional H2 title */
export function StatsCard({ title, items, children }: { title?: string; items: [string, string][]; children?: ReactNode }) {
  return (
    <div className="stats-card">
      {title && <p className="h2" style={{ textAlign: 'center' }}>{title}</p>}
      <div className="stats-card__items">
        {items.map(([label, value]) => (
          <div key={label} className="stats-card__col">
            <span className="stats-card__label">{label}</span>
            <span className="stats-card__value">{value}</span>
          </div>
        ))}
      </div>
      {children}
    </div>
  )
}

/** EventDetails/SummaryCard — status strip, H2 title, subtitle, ActionButtons */
export function SummaryCard({ status, statusLabel, title, subtitle, actions }: { status?: 'action' | 'joined' | 'info'; statusLabel?: string; title: string; subtitle?: string; actions?: { icon: string; label: string; trackId: string; onClick?: () => void }[] }) {
  return (
    <div className="summary-card" style={status ? undefined : { paddingTop: 16 }}>
      {status && <p className={`summary-card__strip summary-card__strip--${status}`}>{statusLabel}</p>}
      <div className="summary-card__title">
        <p className="h2">{title}</p>
        {subtitle && <p className="body16 muted">{subtitle}</p>}
      </div>
      {actions && (
        <div className="summary-card__actions">
          {actions.map((a) => (
            <TButton key={a.label} className="action-btn" trackId={a.trackId} onClick={a.onClick}>
              <span className="action-btn__circle"><Icon name={a.icon} /></span>
              <span className="ellipsis" style={{ maxWidth: '100%' }}>{a.label}</span>
            </TButton>
          ))}
        </div>
      )}
    </div>
  )
}

/** EventDetails/CardWithTray — a card with a grey tray (one Ghost action) tucked underneath */
export function CardWithTray({ children, action, trackId, onAction }: { children: ReactNode; action: string; trackId: string; onAction?: () => void }) {
  return (
    <div className="with-tray">
      <div>{children}</div>
      <div className="card-tray"><Button variant="ghost" trackId={trackId} onClick={onAction}>{action}</Button></div>
    </div>
  )
}

/* ───────── Bottom sheet with exit animation ───────── */
export function Sheet({ open, onClose, title, children, trackId }: { open: boolean; onClose: () => void; title: string; children: ReactNode; trackId: string }) {
  const [render, setRender] = useState(open)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (open) {
      setRender(true)
      setLeaving(false)
      track('sheet_open', trackId)
    } else if (render) {
      setLeaving(true)
      const t = setTimeout(() => setRender(false), 320)
      return () => clearTimeout(t)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!render) return null
  return (
    <>
      <div className={`scrim ${leaving ? 'leaving' : ''}`} onClick={onClose} data-track={`${trackId}:scrim`} />
      <div className={`bsheet ${leaving ? 'leaving' : ''}`} role="dialog" aria-label={title}>
        <div className="bsheet__head">
          <IconButton icon="close" label="Close" onClick={onClose} trackId={`${trackId}:close`} />
          <p className="h5 bsheet__title">{title}</p>
        </div>
        {children}
      </div>
    </>
  )
}

/* ───────── Nav bar ───────── */
export function NavBar({ active }: { active: 'home' | 'find' | 'messages' | 'profile' }) {
  const items: [typeof active, string, string][] = [
    ['home', 'house', 'Home'],
    ['find', 'search', 'Find'],
    ['messages', 'chat', 'Messages'],
    ['profile', 'profile', 'Profile'],
  ]
  return (
    <nav className="navbar">
      {items.map(([k, ic, label]) => (
        <TButton key={k} className={k === active ? 'on' : ''} trackId={`nav:${k}`}>
          <Icon name={ic} />
          {label}
        </TButton>
      ))}
    </nav>
  )
}

/* ───────── Score visuals ───────── */
export function ProgressRing({ value }: { value: number }) {
  const r = 30
  const c = 2 * Math.PI * r
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b8dbff" />
          <stop offset="1" stopColor="#2583ff" />
        </linearGradient>
      </defs>
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="5" />
      <circle cx="36" cy="36" r={r} fill="none" stroke="url(#ringGrad)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 36 36)" />
    </svg>
  )
}

export function Smiley({ mood }: { mood: 'happy' | 'neutral' | 'unhappy' }) {
  const file = asset('illustrations', `smiley-${mood}`)
  if (file) return <img src={file} width={72} height={72} alt="" />
  const mouth = mood === 'happy' ? 'M26 42c5 6 15 6 20 0' : mood === 'neutral' ? 'M27 45h18' : 'M26 48c5-6 15-6 20 0'
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="smileGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b8dbff" />
          <stop offset="1" stopColor="#2583ff" />
        </linearGradient>
      </defs>
      <circle cx="36" cy="36" r="30" fill="none" stroke="url(#smileGrad)" strokeWidth="3.5" />
      <circle cx="27" cy="30" r="2.5" fill="#b8dbff" />
      <circle cx="45" cy="30" r="2.5" fill="#b8dbff" />
      <path d={mouth} fill="none" stroke="url(#smileGrad)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}

/** Small hook: call fn once after ms, cleared on unmount */
export function useTimeout(fn: () => void, ms: number | null) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (ms === null) return
    const t = setTimeout(() => ref.current(), ms)
    return () => clearTimeout(t)
  }, [ms])
}
