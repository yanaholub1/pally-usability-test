/**
 * All animation timings live here. Change a number, push, and Vercel redeploys.
 * Durations are in milliseconds. Easings are CSS cubic-bezier curves.
 */
export const motion = {
  // Moving between screens (push slides in from the right, back slides out)
  screenDuration: 320,
  screenEasing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',

  // Bottom sheets (e.g. "Find or start an activity", "Before you continue")
  sheetDuration: 320,
  sheetEasing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  scrimOpacity: 0.3, // kit: component/overlay/background (black 30%)

  // Player profile opening over the requests list
  profileDuration: 340,
  profileEasing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',

  // Join-request notification banner
  bannerDelay: 3500, // how long after landing on Home the banner appears
  bannerDuration: 420,
  bannerEasing: 'cubic-bezier(0.18, 0.89, 0.32, 1.12)', // slight overshoot
  bannerAutoHide: 7000, // 0 = stays until tapped or swiped

  // A request card leaving the list after Admit / Decline
  cardExitDuration: 260,
  cardCollapseDuration: 220,

  // "Laura admitted · Undo" confirmation
  snackbarDuration: 260,
  snackbarVisibleFor: 4000,

  // Pressed state on buttons and cards
  pressDuration: 120,
} as const

/** Writes the values above as CSS variables so stylesheets can use them. */
export function applyMotionVariables() {
  const root = document.documentElement.style
  root.setProperty('--motion-screen', `${motion.screenDuration}ms`)
  root.setProperty('--ease-screen', motion.screenEasing)
  root.setProperty('--motion-sheet', `${motion.sheetDuration}ms`)
  root.setProperty('--ease-sheet', motion.sheetEasing)
  root.setProperty('--scrim-opacity', String(motion.scrimOpacity))
  root.setProperty('--motion-profile', `${motion.profileDuration}ms`)
  root.setProperty('--ease-profile', motion.profileEasing)
  root.setProperty('--motion-banner', `${motion.bannerDuration}ms`)
  root.setProperty('--ease-banner', motion.bannerEasing)
  root.setProperty('--motion-card-exit', `${motion.cardExitDuration}ms`)
  root.setProperty('--motion-card-collapse', `${motion.cardCollapseDuration}ms`)
  root.setProperty('--motion-snackbar', `${motion.snackbarDuration}ms`)
  root.setProperty('--motion-press', `${motion.pressDuration}ms`)
}
