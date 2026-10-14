import { useEffect, useRef } from 'react'
import { motion } from '../motion'

/**
 * Header ball pattern — "Ball pattern (animated · bucket drop)" from the Pally UI kit
 * (Header instance 483:84942). 30 balls in a pile; 16 of them drop in.
 * Keyframe values/timings are taken verbatim from Figma's motion export; the Figma
 * timeline loops every 2 s, here it plays once (see motion.ballDrop).
 */

// Pile frame offset inside the 402 × 188 header. Each ball is the kit's 48 px illustration/tennis-ball;
// x/y below are its Figma origin (top-left corner), and rotation/flip pivot on that corner, as in Figma.
const PILE_X = -23
const PILE_Y = 92

type Drop = {
  r0: number // start rotation
  x0: number // start x offset
  y0: number // start y offset
  tS: number // hold until (fraction of the 2 s timeline)
  tL: number // landing
  tB: number // top of the small bounce
  tE: number // settled
  s1: number // squash start
  s2: number // squash peak
}

type Ball = { n: number; x: number; y: number; r: number; flip?: boolean; drop?: Drop }

// x/y = Figma origin inside the pile frame; r = resting rotation (CSS degrees); flip = scaleY -1
const BALLS: Ball[] = [
  { n: 1, x: 90.24, y: 265.979, r: -101.944 },
  { n: 2, x: 177.587, y: 265.87, r: 11.944, flip: true },
  { n: 3, x: 182.57, y: 243.287, r: -78.056, flip: true },
  { n: 4, x: 276.392, y: 266.473, r: -11.944 },
  { n: 5, x: 323.384, y: 265.87, r: -101.944 },
  { n: 6, x: 283.782, y: 207.742, r: 11.944, flip: true },
  { n: 7, x: 266.754, y: 224.733, r: -78.056, flip: true },
  { n: 8, x: 182.734, y: 205.023, r: -11.944 },
  { n: 9, x: 135.139, y: 217.674, r: -101.944 },
  { n: 10, x: 124.572, y: 217.674, r: 11.944, flip: true },
  { n: 11, x: 87.543, y: 168.874, r: -78.056, flip: true },
  { n: 12, x: 54.736, y: 131.189, r: -101.944, drop: { r0: -68.266, x0: -0.899, y0: -282.052, tS: 0.067, tL: 0.439, tB: 0.5075, tE: 0.591, s1: 0.4385, s2: 0.477 } },
  { n: 13, x: 9.738, y: 147.587, r: -101.944, drop: { r0: -77.733, x0: 6.422, y0: -312.642, tS: 0, tL: 0.383, tB: 0.4515, tE: 0.535, s1: 0.382, s2: 0.421 } },
  { n: 14, x: 19.737, y: 101.338, r: -101.944, drop: { r0: -140.431, x0: 0.416, y0: -224.276, tS: 0.1635, tL: 0.516, tB: 0.5845, tE: 0.668, s1: 0.515, s2: 0.554 } },
  { n: 15, x: 135.87, y: 112.107, r: -11.944 },
  { n: 16, x: 100.442, y: 119.794, r: 11.944, flip: true, drop: { r0: -14.701, x0: -9.728, y0: -248.776, tS: 0.1025, tL: 0.4635, tB: 0.532, tE: 0.6155, s1: 0.463, s2: 0.5015 } },
  { n: 17, x: 113.764, y: 90.792, r: -78.056, flip: true, drop: { r0: -102.721, x0: 11.382, y0: -227.403, tS: 0.192, tL: 0.5455, tB: 0.614, tE: 0.6975, s1: 0.545, s2: 0.5835 } },
  { n: 18, x: 187.831, y: 101.354, r: -78.056, flip: true, drop: { r0: -52.586, x0: 1.698, y0: -262.435, tS: 0.1435, tL: 0.509, tB: 0.5775, tE: 0.661, s1: 0.5085, s2: 0.547 } },
  { n: 19, x: 237.229, y: 98.985, r: -78.056, flip: true, drop: { r0: -39.877, x0: -12.463, y0: -230.486, tS: 0.152, tL: 0.506, tB: 0.5745, tE: 0.658, s1: 0.5055, s2: 0.544 } },
  { n: 20, x: 235.582, y: 72.786, r: 11.944, flip: true, drop: { r0: -20.743, x0: 0.455, y0: -245.131, tS: 0.211, tL: 0.5705, tB: 0.639, tE: 0.7225, s1: 0.57, s2: 0.6085 } },
  { n: 21, x: 331.215, y: 60.019, r: -78.056, flip: true, drop: { r0: -51.444, x0: -3.04, y0: -199.778, tS: 0.2355, tL: 0.579, tB: 0.6475, tE: 0.731, s1: 0.5785, s2: 0.617 } },
  { n: 22, x: 107.988, y: 59.252, r: 11.944, flip: true, drop: { r0: -15.991, x0: 5.83, y0: -213.411, tS: 0.228, tL: 0.576, tB: 0.6445, tE: 0.728, s1: 0.575, s2: 0.614 } },
  { n: 23, x: 211.925, y: 140.559, r: -78.056, flip: true, drop: { r0: -113.158, x0: 1.2, y0: -265.611, tS: 0.031, tL: 0.398, tB: 0.4665, tE: 0.55, s1: 0.3975, s2: 0.436 } },
  // Ball 24 is static in the Figma loop but peeks above the content sheet, so in a one-shot drop it looked stuck.
  // It now drops too, just ahead of its neighbour 23 (timings derived from ball 23).
  { n: 24, x: 214.789, y: 112.107, r: -101.944, drop: { r0: -128.4, x0: -4.2, y0: -258.0, tS: 0.012, tL: 0.379, tB: 0.4475, tE: 0.531, s1: 0.3785, s2: 0.417 } },
  { n: 25, x: 298.684, y: 125.236, r: 11.944, flip: true },
  { n: 26, x: 283.623, y: 130.919, r: -78.056, flip: true, drop: { r0: -47.795, x0: 11.849, y0: -289.438, tS: 0.089, tL: 0.4645, tB: 0.5325, tE: 0.6165, s1: 0.4635, s2: 0.5025 } },
  { n: 27, x: 331.216, y: 130.919, r: -78.056, flip: true, drop: { r0: -116.296, x0: 11.433, y0: -277.982, tS: 0.0975, tL: 0.468, tB: 0.5365, tE: 0.62, s1: 0.4675, s2: 0.506 } },
  { n: 28, x: 333.602, y: 129.691, r: 11.944, flip: true, drop: { r0: -12.896, x0: -3.522, y0: -286.139, tS: 0.051, tL: 0.425, tB: 0.493, tE: 0.5765, s1: 0.424, s2: 0.463 } },
  { n: 29, x: 314.593, y: 47.635, r: -11.944, drop: { r0: 15.345, x0: -2.129, y0: -224.989, tS: 0.1725, tL: 0.525, tB: 0.5935, tE: 0.677, s1: 0.5245, s2: 0.563 } },
  { n: 30, x: 374.583, y: 71.77, r: -11.944, drop: { r0: 26.801, x0: 1.606, y0: -245.583, tS: 0.1155, tL: 0.475, tB: 0.5435, tE: 0.627, s1: 0.474, s2: 0.513 } },
]

// motion.dev named easings → CSS
const EASE = { linear: 'linear', easeIn: 'cubic-bezier(0.42, 0, 1, 1)', easeOut: 'cubic-bezier(0, 0, 0.58, 1)' } as const

/** Builds WAAPI keyframes for one track: values at offsets, with the easing of each segment. */
function track(prop: string, values: string[], times: number[], eases: (keyof typeof EASE)[]): Keyframe[] {
  return values.map((v, i) => ({ [prop]: v, offset: times[i], ...(i < eases.length ? { easing: EASE[eases[i]] } : {}) }))
}

function BallArt() {
  // One ball from the kit's Ball component: lime fill, white seams, white ring.
  return (
    <svg viewBox="-1 -1 48 48" width="48" height="48" aria-hidden style={{ display: 'block' }}>
      <defs>
        <clipPath id="ball-clip"><circle cx="23" cy="23" r="21.75" /></clipPath>
      </defs>
      <circle cx="23" cy="23" r="22.4" fill="#C2FE06" />
      <g clipPath="url(#ball-clip)">
        <path d="M24.916 -10.932C23.134 -0.027 21.375 23.547 27.712 30.793C34.028 37.94 47.749 28.394 53.806 22.718M21.879 49.607C17.714 40.062 7.274 23.566 -0.982 34.307" stroke="white" strokeOpacity="0.9" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      </g>
      <circle cx="23" cy="23" r="21.7" fill="none" stroke="white" strokeWidth="3.2" />
    </svg>
  )
}

export function BallPile({ animate }: { animate: boolean }) {
  const refs = useRef<Record<number, { x: HTMLDivElement | null; y: HTMLDivElement | null; rs: HTMLDivElement | null }>>({})

  useEffect(() => {
    if (!animate) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const duration = motion.ballDropDuration
    const opts: KeyframeAnimationOptions = { duration, fill: 'backwards', delay: motion.ballDropDelay }
    const running: Animation[] = []
    for (const b of BALLS) {
      const d = b.drop
      const el = refs.current[b.n]
      if (!d || !el?.x || !el.y || !el.rs) continue
      const f = b.flip ? -1 : 1
      const hold = d.tS > 0
      running.push(
        el.x.animate(track('translate', [`${d.x0}px 0`, `${d.x0}px 0`, '0 0', '0 0'], [0, d.tS, d.tL, 1], ['linear', 'easeOut', 'linear']), opts),
        el.y.animate(track('translate', [`0 ${d.y0}px`, `0 ${d.y0}px`, '0 0', '0 -7px', '0 0', '0 0'], [0, d.tS, d.tL, d.tB, d.tE, 1], ['linear', 'easeIn', 'easeOut', 'easeIn', 'linear']), opts),
        el.rs.animate(
          hold
            ? track('rotate', [`${d.r0}deg`, `${d.r0}deg`, `${b.r}deg`, `${b.r}deg`], [0, d.tS, d.tE, 1], ['linear', 'easeOut', 'linear'])
            : track('rotate', [`${d.r0}deg`, `${b.r}deg`, `${b.r}deg`], [0, d.tE, 1], ['easeOut', 'linear']),
          opts,
        ),
        el.rs.animate(track('scale', [`1 ${f}`, `1 ${f}`, `1.06 ${0.92 * f}`, `1 ${f}`, `1 ${f}`], [0, d.s1, d.s2, d.tE, 1], ['linear', 'easeOut', 'easeOut', 'linear']), opts),
      )
    }
    return () => running.forEach((a) => a.cancel())
  }, [animate])

  return (
    <div aria-hidden style={{ position: 'absolute', left: PILE_X, top: PILE_Y, width: 431.28, height: 266.28, pointerEvents: 'none' }}>
      {BALLS.map((b) => (
        <div
          key={b.n}
          ref={(x) => { refs.current[b.n] = { ...(refs.current[b.n] ?? { y: null, rs: null }), x } }}
          style={{ position: 'absolute', left: b.x, top: b.y, width: 0, height: 0 }}
        >
          <div ref={(y) => { refs.current[b.n] = { ...(refs.current[b.n] ?? { x: null, rs: null }), y } }}>
            <div
              ref={(rs) => { refs.current[b.n] = { ...(refs.current[b.n] ?? { x: null, y: null }), rs } }}
              style={{ width: 48, height: 48, transformOrigin: '0 0', rotate: `${b.r}deg`, scale: b.flip ? '1 -1' : undefined }}
            >
              <BallArt />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
