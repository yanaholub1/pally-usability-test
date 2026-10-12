import type { CSSProperties, ReactNode } from 'react'

/**
 * Icons. Exported SVGs dropped into src/assets/icons/<name>.svg take priority
 * (rendered as a CSS mask so they pick up the current text colour). Until then
 * a hand-drawn stand-in with the same stroke style is used.
 */
const exported = import.meta.glob('../assets/icons/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const exportedByName: Record<string, string> = {}
for (const [path, url] of Object.entries(exported)) {
  const name = path.split('/').pop()!.replace(/\.svg$/, '').replace(/^icon[-_/]?/, '')
  exportedByName[name] = url
}

const p = (d: string) => <path d={d} />

const fallback: Record<string, ReactNode> = {
  'chevron-left': p('M14.5 6 8.5 12l6 6'),
  'chevron-right': p('m9.5 6 6 6-6 6'),
  'chevron-down': p('m6 9.5 6 6 6-6'),
  close: p('M6.5 6.5l11 11M17.5 6.5l-11 11'),
  bell: <>{p('M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15z')}{p('M10 20.5a2 2 0 0 0 4 0')}</>,
  settings: <><circle cx="12" cy="12" r="3" />{p('M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5M18.54 5.46l-1.77 1.77M7.23 16.77l-1.77 1.77M18.54 18.54l-1.77-1.77M7.23 7.23 5.46 5.46')}<circle cx="12" cy="12" r="6.25" /></>,
  ball: <><circle cx="12" cy="12" r="8.5" />{p('M5.5 6.5c3 2 3 9 0 11M18.5 6.5c-3 2-3 9 0 11')}</>,
  trophy: <>{p('M8 4h8v5a4 4 0 0 1-8 0z')}{p('M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4v3h-4z')}</>,
  field: <><rect x="3.5" y="5" width="17" height="14" rx="1.5" />{p('M12 5v14M7.5 5v14M16.5 5v14M7.5 12h9')}</>,
  hat: <>{p('M2.5 9.5 12 5l9.5 4.5L12 14z')}{p('M6.5 11.5v4c3 2.5 8 2.5 11 0v-4M21.5 9.5v5')}</>,
  house: <>{p('M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z')}</>,
  search: <><circle cx="11" cy="11" r="6.5" />{p('m16 16 4.5 4.5')}</>,
  chat: p('M4.5 5.5h15v10h-9l-4.5 3.5v-3.5h-1.5z'),
  profile: <><circle cx="12" cy="8.5" r="3.75" />{p('M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5')}</>,
  users: <><circle cx="9" cy="9" r="3.25" /><circle cx="16.5" cy="8" r="2.5" />{p('M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M15 13.5c2.8-.6 5 1 5.5 4')}</>,
  'person-shield': <><circle cx="10" cy="8.5" r="3.5" />{p('M4 20c.7-3.4 3.2-5.3 6-5.3 1 0 1.9.2 2.7.6')}{p('M17.5 13.5l3 1.2v2.2c0 1.9-1.3 3.3-3 3.8-1.7-.5-3-1.9-3-3.8v-2.2z')}</>,
  'person-check': <><circle cx="10" cy="8.5" r="3.5" />{p('M4 20c.7-3.4 3.2-5.3 6-5.3 1.3 0 2.4.3 3.4.9')}{p('m15 17.5 2 2 3.5-4')}</>,
  'person-plus': <><circle cx="10" cy="8.5" r="3.5" />{p('M4 20c.7-3.4 3.2-5.3 6-5.3 1.3 0 2.4.3 3.4.9M18 13.5v6M15 16.5h6')}</>,
  calendar: <><rect x="4" y="5.5" width="16" height="14.5" rx="2" />{p('M4 10h16M8.5 3.5v4M15.5 3.5v4')}</>,
  'calendar-x': <><rect x="4" y="5.5" width="16" height="14.5" rx="2" />{p('M4 10h16M8.5 3.5v4M15.5 3.5v4M10 13.5l4 4M14 13.5l-4 4')}</>,
  clock: <><circle cx="12" cy="12" r="8.5" />{p('M12 7.5V12l3 2')}</>,
  'location-pin': <>{p('M12 21s6.5-5.6 6.5-11a6.5 6.5 0 1 0-13 0c0 5.4 6.5 11 6.5 11z')}<circle cx="12" cy="10" r="2.5" /></>,
  map: <>{p('M3.5 6.5 9 4.5l6 2 5.5-2v13l-5.5 2-6-2-5.5 2z')}{p('M9 4.5v13M15 6.5v13')}</>,
  plus: p('M12 5v14M5 12h14'),
  filter: p('M4 7h16M7 12h10M10 17h4'),
  heart: p('M12 19.5s-7.5-4.4-7.5-9.7A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6c0 5.3-7.5 9.7-7.5 9.7z'),
  share: <>{p('M12 15V4M8 7.5 12 3.5l4 4')}{p('M7 11H5.5v9h13v-9H17')}</>,
  info: <><circle cx="12" cy="12" r="8.5" />{p('M12 11v5.5M12 7.75v.5')}</>,
  badge: <>{p('M12 3.5l2.2 1.6 2.7-.1.8 2.6 2.2 1.6-.9 2.6.9 2.6-2.2 1.6-.8 2.6-2.7-.1L12 20.5l-2.2-1.6-2.7.1-.8-2.6-2.2-1.6.9-2.6-.9-2.6 2.2-1.6.8-2.6 2.7.1z')}{p('m9 12 2 2 4-4')}</>,
  handshake: <>{p('M3 10.5 6.5 7l3.5 1.5 2-1 2 .5 3.5-1.5 3.5 3.5')}{p('M6 13.5l4.5 4.5c.7.7 1.8.7 2.5 0l4.5-4.5M3 10.5l3 3M21 10.5l-3 3M10 8.5l-2.5 3 1.5 1.5 3-2.5 3.5 3')}</>,
  group: <><circle cx="12" cy="8" r="2.75" /><circle cx="5.5" cy="10" r="2.25" /><circle cx="18.5" cy="10" r="2.25" />{p('M7.5 19c.5-3 2.3-4.5 4.5-4.5s4 1.5 4.5 4.5M2 18.5c.3-2 1.6-3.2 3.5-3.2M22 18.5c-.3-2-1.6-3.2-3.5-3.2')}</>,
  checkmark: p('m5 12.5 4.5 4.5L19 7.5'),
  'hour-glass': <>{p('M6.5 3.5h11M6.5 20.5h11M8 3.5c0 4.5 4 5.5 4 8.5s-4 4-4 8.5M16 3.5c0 4.5-4 5.5-4 8.5s4 4 4 8.5')}</>,
  level: <>{p('M6 19v-4M12 19V10M18 19V5')}</>,
  racket: <>{p('M14.5 3.5a6 6 0 1 1-4.2 10.2 6 6 0 0 1 4.2-10.2z')}{p('M10.3 13.7 4 20M6.5 15.5l2 2')}<circle cx="14.5" cy="9.5" r=".2" /></>,
  venus: <><circle cx="12" cy="9" r="5" />{p('M12 14v7M9 18h6')}</>,
  wallet: <>{p('M4 7.5h14.5a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18V7.5zM4 7.5 15.5 4.5V7.5')}<circle cx="16" cy="13.5" r="1" /></>,
  edit: p('M5 19h3.5L19 8.5 15.5 5 5 15.5z'),
  smile: <><circle cx="12" cy="12" r="8.5" />{p('M8.5 14c1.8 2 5.2 2 7 0M9 9.5v.5M15 9.5v.5')}</>,
  follow: <><circle cx="10" cy="8.5" r="3.5" />{p('M4 20c.7-3.4 3.2-5.3 6-5.3M18 13.5v6M15 16.5h6')}</>,
}

type Props = { name: string; size?: number; className?: string; style?: CSSProperties; strokeWidth?: number }

export function Icon({ name, size = 24, className, style, strokeWidth = 1.5 }: Props) {
  const url = exportedByName[name]
  if (url) {
    return (
      <span
        aria-hidden
        className={className}
        style={{
          display: 'inline-block', width: size, height: size, flexShrink: 0,
          backgroundColor: 'currentColor',
          WebkitMask: `url("${url}") center / contain no-repeat`,
          mask: `url("${url}") center / contain no-repeat`,
          ...style,
        }}
      />
    )
  }
  return (
    <svg
      aria-hidden
      className={className}
      style={{ flexShrink: 0, ...style }}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {fallback[name] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  )
}
